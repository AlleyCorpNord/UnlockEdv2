# Canvas OAuth2 Integration Architecture

## Overview

Multi-tenant Canvas authentication where each prison admin connects their own Canvas instance to UnlockEd.

```
Prison Admin's Canvas    UnlockEd Backend    UnlockEd Database
      ↓                       ↓                      ↓
   [OAuth2]  →  [Get Token]  →  [Store Encrypted]
      ↑                       ↓                      ↑
   [Use Token] ← [API Call]  ← [Retrieve Token]
```

## 1. Database Schema

Store Canvas connections per facility:

```sql
-- Canvas OAuth tokens table
CREATE TABLE canvas_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    canvas_url VARCHAR NOT NULL,
    access_token VARCHAR NOT NULL, -- encrypted
    refresh_token VARCHAR, -- nullable, if Canvas supports it
    token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(facility_id, canvas_url)
);

-- Track OAuth state during authentication
CREATE TABLE canvas_oauth_state (
    state_token VARCHAR PRIMARY KEY,
    facility_id UUID NOT NULL REFERENCES facilities(id),
    canvas_url VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '10 minutes'
);
```

## 2. Environment Variables

```bash
# In .env
CANVAS_OAUTH_CLIENT_ID=your_canvas_oauth_client_id
CANVAS_OAUTH_CLIENT_SECRET=your_canvas_oauth_client_secret
CANVAS_OAUTH_REDIRECT_URI=http://127.0.0.1/api/canvas/oauth/callback
ENCRYPTION_KEY=your-32-byte-encryption-key-for-tokens
```

## 3. Backend Models (Go)

```go
package canvas

import (
	"time"
)

// CanvasConnection stores OAuth token for a facility's Canvas instance
type CanvasConnection struct {
	ID             string
	FacilityID     string
	CanvasURL      string
	AccessToken    string    // encrypted
	RefreshToken   string    // encrypted
	TokenExpiresAt *time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// OAuthState tracks in-flight OAuth requests
type OAuthState struct {
	StateToken  string
	FacilityID  string
	CanvasURL   string
	CreatedAt   time.Time
	ExpiresAt   time.Time
}

// OAuthCallback response from Canvas
type OAuthCallback struct {
	Code  string `query:"code"`
	State string `query:"state"`
	Error string `query:"error"`
}

// TokenResponse from Canvas /login/oauth2/token endpoint
type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}
```

## 4. OAuth Routes

Add these routes to your backend:

```go
// routes/canvas.go
package routes

import (
	"github.com/labstack/echo/v4"
	"yourapp/canvas"
)

func RegisterCanvasRoutes(e *echo.Echo, handler *canvas.Handler) {
	canvas := e.Group("/api/canvas")
	
	// Admin initiates Canvas connection
	canvas.POST("/connect", handler.InitiateOAuth)
	
	// Canvas redirects back here after user grants permission
	canvas.GET("/oauth/callback", handler.HandleOAuthCallback)
	
	// Get connected Canvas instances for a facility
	canvas.GET("/connections", handler.GetConnections)
	
	// Disconnect a Canvas instance
	canvas.DELETE("/connections/:connectionID", handler.DisconnectCanvas)
}
```

## 5. Handler Implementation (Go)

```go
// canvas/handler.go
package canvas

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"net/url"

	"github.com/labstack/echo/v4"
)

type Handler struct {
	db          *sql.DB
	encryptor   *Encryptor
	httpClient  *http.Client
}

// InitiateOAuth - Step 1: Redirect admin to Canvas login
// POST /api/canvas/connect
// Body: { "facility_id": "...", "canvas_url": "https://your-canvas.instructure.com" }
func (h *Handler) InitiateOAuth(c echo.Context) error {
	var req struct {
		FacilityID string `json:"facility_id" validate:"required"`
		CanvasURL  string `json:"canvas_url" validate:"required,url"`
	}
	
	if err := c.BindAndValidate(&req); err != nil {
		return c.JSON(http.StatusBadRequest, err)
	}
	
	// Generate random state token for CSRF protection
	stateToken := generateState()
	
	// Store state in database with expiration
	err := h.db.QueryRow(`
		INSERT INTO canvas_oauth_state (state_token, facility_id, canvas_url)
		VALUES ($1, $2, $3)
		RETURNING state_token
	`, stateToken, req.FacilityID, req.CanvasURL).Scan(&stateToken)
	
	if err != nil {
		return c.JSON(http.StatusInternalServerError, err)
	}
	
	// Build Canvas OAuth URL
	canvasAuthURL := buildCanvasAuthURL(
		req.CanvasURL,
		getEnv("CANVAS_OAUTH_CLIENT_ID"),
		getEnv("CANVAS_OAUTH_REDIRECT_URI"),
		stateToken,
	)
	
	return c.JSON(http.StatusOK, map[string]string{
		"auth_url": canvasAuthURL,
	})
}

// HandleOAuthCallback - Step 2: Canvas redirects back with authorization code
// GET /api/canvas/oauth/callback?code=...&state=...
func (h *Handler) HandleOAuthCallback(c echo.Context) error {
	callback := &OAuthCallback{
		Code:  c.QueryParam("code"),
		State: c.QueryParam("state"),
		Error: c.QueryParam("error"),
	}
	
	if callback.Error != "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": callback.Error,
		})
	}
	
	// Verify state token (CSRF protection)
	var state OAuthState
	err := h.db.QueryRow(`
		SELECT state_token, facility_id, canvas_url, expires_at
		FROM canvas_oauth_state
		WHERE state_token = $1
	`, callback.State).Scan(&state.StateToken, &state.FacilityID, &state.CanvasURL, &state.ExpiresAt)
	
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{
			"error": "invalid state",
		})
	}
	
	// Exchange code for access token (Step 3)
	tokenResp, err := h.exchangeCodeForToken(state.CanvasURL, callback.Code)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, err)
	}
	
	// Encrypt and store token in database (Step 4)
	encryptedToken, err := h.encryptor.Encrypt(tokenResp.AccessToken)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, err)
	}
	
	encryptedRefresh := ""
	if tokenResp.RefreshToken != "" {
		encryptedRefresh, _ = h.encryptor.Encrypt(tokenResp.RefreshToken)
	}
	
	expiresAt := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	
	_, err = h.db.Exec(`
		INSERT INTO canvas_connections (facility_id, canvas_url, access_token, refresh_token, token_expires_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (facility_id, canvas_url) DO UPDATE SET
			access_token = $3,
			refresh_token = $4,
			token_expires_at = $5,
			updated_at = NOW()
	`, state.FacilityID, state.CanvasURL, encryptedToken, encryptedRefresh, expiresAt)
	
	if err != nil {
		return c.JSON(http.StatusInternalServerError, err)
	}
	
	// Clean up state token
	h.db.Exec("DELETE FROM canvas_oauth_state WHERE state_token = $1", callback.State)
	
	// Redirect to success page or return token
	return c.JSON(http.StatusOK, map[string]string{
		"message": "Canvas connected successfully",
		"facility_id": state.FacilityID,
		"canvas_url": state.CanvasURL,
	})
}

// GetConnections - Get all Canvas connections for a facility
// GET /api/canvas/connections
func (h *Handler) GetConnections(c echo.Context) error {
	facilityID := c.Get("facility_id").(string) // from auth middleware
	
	rows, err := h.db.Query(`
		SELECT id, canvas_url, created_at
		FROM canvas_connections
		WHERE facility_id = $1
	`, facilityID)
	
	if err != nil {
		return c.JSON(http.StatusInternalServerError, err)
	}
	defer rows.Close()
	
	var connections []map[string]interface{}
	for rows.Next() {
		var id, canvasURL string
		var createdAt time.Time
		
		rows.Scan(&id, &canvasURL, &createdAt)
		connections = append(connections, map[string]interface{}{
			"id": id,
			"canvas_url": canvasURL,
			"created_at": createdAt,
		})
	}
	
	return c.JSON(http.StatusOK, connections)
}

// DisconnectCanvas - Remove Canvas connection
// DELETE /api/canvas/connections/:connectionID
func (h *Handler) DisconnectCanvas(c echo.Context) error {
	facilityID := c.Get("facility_id").(string)
	connectionID := c.Param("connectionID")
	
	result, err := h.db.Exec(`
		DELETE FROM canvas_connections
		WHERE id = $1 AND facility_id = $2
	`, connectionID, facilityID)
	
	if err != nil {
		return c.JSON(http.StatusInternalServerError, err)
	}
	
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return c.JSON(http.StatusNotFound, map[string]string{
			"error": "connection not found",
		})
	}
	
	return c.JSON(http.StatusOK, map[string]string{
		"message": "Canvas disconnected",
	})
}

// Helper: Exchange authorization code for access token
func (h *Handler) exchangeCodeForToken(canvasURL, code string) (*TokenResponse, error) {
	tokenURL := canvasURL + "/login/oauth2/token"
	
	data := url.Values{
		"client_id":     {getEnv("CANVAS_OAUTH_CLIENT_ID")},
		"client_secret": {getEnv("CANVAS_OAUTH_CLIENT_SECRET")},
		"code":          {code},
		"redirect_uri":  {getEnv("CANVAS_OAUTH_REDIRECT_URI")},
		"grant_type":    {"authorization_code"},
	}
	
	resp, err := h.httpClient.PostForm(tokenURL, data)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var tokenResp TokenResponse
	json.NewDecoder(resp.Body).Decode(&tokenResp)
	
	return &tokenResp, nil
}

// Helper: Generate random state token
func generateState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// Helper: Build Canvas OAuth authorization URL
func buildCanvasAuthURL(canvasURL, clientID, redirectURI, state string) string {
	params := url.Values{
		"client_id":     {clientID},
		"response_type": {"code"},
		"redirect_uri":  {redirectURI},
		"state":         {state},
	}
	return canvasURL + "/login/oauth2/auth?" + params.Encode()
}

func getEnv(key string) string {
	return os.Getenv(key)
}
```

## 6. Canvas API Client

```go
// canvas/client.go
package canvas

import (
	"encoding/json"
	"fmt"
	"net/http"
)

// Client makes authenticated requests to Canvas API
type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

func NewClient(canvasURL, accessToken string) *Client {
	return &Client{
		baseURL:    canvasURL + "/api/v1",
		token:      accessToken,
		httpClient: &http.Client{},
	}
}

// GetCourses retrieves all courses from Canvas
func (c *Client) GetCourses(ctx context.Context) ([]Course, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/courses", nil)
	c.addAuthHeader(req)
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var courses []Course
	json.NewDecoder(resp.Body).Decode(&courses)
	return courses, nil
}

// GetUsers retrieves all users from Canvas
func (c *Client) GetUsers(ctx context.Context) ([]User, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/users", nil)
	c.addAuthHeader(req)
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var users []User
	json.NewDecoder(resp.Body).Decode(&users)
	return users, nil
}

// GetAssignments retrieves assignments for a course
func (c *Client) GetAssignments(ctx context.Context, courseID string) ([]Assignment, error) {
	url := fmt.Sprintf("%s/courses/%s/assignments", c.baseURL, courseID)
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	c.addAuthHeader(req)
	
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var assignments []Assignment
	json.NewDecoder(resp.Body).Decode(&assignments)
	return assignments, nil
}

func (c *Client) addAuthHeader(req *http.Request) {
	req.Header.Add("Authorization", "Bearer "+c.token)
}

// Data models
type Course struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Code     string `json:"course_code"`
	SISCourseID string `json:"sis_course_id"`
}

type User struct {
	ID       int    `json:"id"`
	LoginID  string `json:"login_id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	SISUserID string `json:"sis_user_id"`
}

type Assignment struct {
	ID     int    `json:"id"`
	Name   string `json:"name"`
	CourseID int `json:"course_id"`
}
```

## 7. Using Canvas Data in Your Backend

```go
// Example: Sync Canvas courses to UnlockEd
func (h *Handler) SyncCoursesForFacility(facilityID string) error {
	// Get Canvas connections for this facility
	var connection CanvasConnection
	err := h.db.QueryRow(`
		SELECT id, canvas_url, access_token
		FROM canvas_connections
		WHERE facility_id = $1
		LIMIT 1
	`, facilityID).Scan(&connection.ID, &connection.CanvasURL, &connection.AccessToken)
	
	if err != nil {
		return err
	}
	
	// Decrypt token
	token, err := h.encryptor.Decrypt(connection.AccessToken)
	if err != nil {
		return err
	}
	
	// Create Canvas client
	client := NewClient(connection.CanvasURL, token)
	
	// Fetch courses
	courses, err := client.GetCourses(context.Background())
	if err != nil {
		return err
	}
	
	// Sync to UnlockEd database
	for _, course := range courses {
		h.db.Exec(`
			INSERT INTO canvas_courses (facility_id, canvas_id, name, code)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (facility_id, canvas_id) DO UPDATE SET
				name = $3,
				code = $4
		`, facilityID, course.ID, course.Name, course.Code)
	}
	
	return nil
}
```

## 8. Frontend Flow (React/Vue)

```javascript
// User clicks "Connect Canvas" button
async function connectCanvas(facilityId, canvasUrl) {
  // Step 1: Get auth URL from backend
  const res = await fetch('/api/canvas/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      facility_id: facilityId,
      canvas_url: canvasUrl,
    }),
  });
  
  const { auth_url } = await res.json();
  
  // Step 2: Redirect admin to Canvas login
  window.location.href = auth_url;
  
  // Canvas redirects back to /api/canvas/oauth/callback
  // which handles token storage automatically
}
```

## 9. Security Considerations

- ✅ **State token**: Prevents CSRF attacks
- ✅ **Token encryption**: Store tokens encrypted in DB
- ✅ **Token rotation**: Implement refresh token flow if Canvas supports it
- ✅ **Token expiration**: Check `token_expires_at` before using
- ✅ **Scoped permissions**: Request minimum Canvas scopes needed
- ✅ **Secret management**: Use environment variables, never hardcode secrets

## Canvas OAuth App Setup

1. In Canvas (as admin):
   - Settings → Developer Keys → Create New Key
   - Application name: "UnlockEd"
   - Redirect URI: `http://127.0.0.1/api/canvas/oauth/callback`
   - Copy Client ID and Client Secret
   - Add to `.env`

2. Request scopes (if Canvas supports them):
   - `courses:read`
   - `users:read`
   - `assignments:read`
   - `submissions:read`
