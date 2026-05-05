package handlers

import (
	"UnlockEdv2/src/models"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"
)

// Canvas OAuth request/response types
type InitiateCanvasOAuthRequest struct {
	FacilityID string `json:"facility_id" validate:"required"`
	CanvasURL  string `json:"canvas_url" validate:"required,url"`
}

type CanvasOAuthResponse struct {
	AuthURL string `json:"auth_url"`
	State   string `json:"state"`
}

type CanvasOAuthCallbackResponse struct {
	Code  string `query:"code"`
	State string `query:"state"`
	Error string `query:"error"`
}

type CanvasTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
}

type CanvasConnectionResponse struct {
	ID        string    `json:"id"`
	CanvasURL string    `json:"canvas_url"`
	CreatedAt time.Time `json:"created_at"`
}

type CanvasConfigRequest struct {
	ClientID     string `json:"client_id" validate:"required"`
	ClientSecret string `json:"client_secret" validate:"required"`
}

type CanvasConfigResponse struct {
	FacilityID string    `json:"facility_id"`
	ClientID   string    `json:"client_id"` // shows only first few chars for security
	UpdatedAt  time.Time `json:"updated_at"`
}

// registerCanvasRoutes registers all Canvas-related routes
func (srv *Server) registerCanvasRoutes() []routeDef {
	return []routeDef{
		{
			routeMethod: "POST /api/canvas/connect",
			handler:     srv.initiateCanvasOAuth,
			admin:       true,
		},
		{
			routeMethod: "GET /api/canvas/oauth/callback",
			handler:     srv.handleCanvasOAuthCallback,
			admin:       false,
		},
		{
			routeMethod: "GET /api/canvas/connections",
			handler:     srv.getCanvasConnections,
			admin:       true,
		},
		{
			routeMethod: "DELETE /api/canvas/connections/{connectionID}",
			handler:     srv.disconnectCanvas,
			admin:       true,
		},
		{
			routeMethod: "POST /api/canvas/config",
			handler:     srv.saveCanvasOAuthConfig,
			admin:       true,
		},
		{
			routeMethod: "GET /api/canvas/config",
			handler:     srv.getCanvasOAuthConfig,
			admin:       true,
		},
	}
}

// initiateCanvasOAuth - Step 1: Generate authorization URL
// POST /api/canvas/connect
func (srv *Server) initiateCanvasOAuth(w http.ResponseWriter, r *http.Request, log sLog) error {
	var req InitiateCanvasOAuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newJSONReqBodyServiceError(err)
	}

	// Convert string facility ID to int
	facilityID, err := strconv.Atoi(req.FacilityID)
	if err != nil {
		return newInvalidIdServiceError(err, "facility ID")
	}

	// Validate facility exists
	facility, err := srv.Db.GetFacilityByID(facilityID)
	if err != nil {
		log.add("facility_id", facilityID)
		return newDatabaseServiceError(err)
	}

	log.add("facility_id", facility.ID)
	log.add("canvas_url", req.CanvasURL)

	// Get Canvas OAuth config for facility
	canvasConfig, err := srv.Db.GetCanvasOAuthConfig(facility.ID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if canvasConfig == nil {
		return newBadRequestServiceError(
			errors.New("canvas oauth config not found"),
			"Canvas OAuth credentials not configured for this facility. Please configure them first.",
		)
	}

	// Decrypt credentials
	clientID, err := models.DecryptAccessKey(canvasConfig.ClientID)
	if err != nil {
		return newInternalServerServiceError(err, "failed to decrypt client ID")
	}

	// Generate random state token for CSRF protection
	stateToken := generateCanvasState()

	// Store state in NATS KV store (expires in 10 minutes)
	js, _ := srv.nats.JetStream()
	kvBucket, _ := js.KeyValue("canvas_oauth_state")

	stateData := models.CanvasOAuthState{
		StateToken: stateToken,
		FacilityID: facility.ID,
		CanvasURL:  req.CanvasURL,
		CreatedAt:  time.Now(),
		ExpiresAt:  time.Now().Add(10 * time.Minute),
	}

	stateBytes, _ := json.Marshal(stateData)
	kvBucket.Put(stateToken, stateBytes)

	// Build Canvas OAuth authorization URL
	canvasAuthURL := buildCanvasAuthURL(
		req.CanvasURL,
		clientID,
		os.Getenv("CANVAS_OAUTH_REDIRECT_URI"),
		stateToken,
	)

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(CanvasOAuthResponse{
		AuthURL: canvasAuthURL,
		State:   stateToken,
	})
}

// handleCanvasOAuthCallback - Step 2: Canvas redirects back with authorization code
// GET /api/canvas/oauth/callback?code=...&state=...
func (srv *Server) handleCanvasOAuthCallback(w http.ResponseWriter, r *http.Request, log sLog) error {
	callback := &CanvasOAuthCallbackResponse{
		Code:  r.URL.Query().Get("code"),
		State: r.URL.Query().Get("state"),
		Error: r.URL.Query().Get("error"),
	}

	if callback.Error != "" {
		return newBadRequestServiceError(errors.New(callback.Error), "Canvas OAuth error")
	}

	if callback.Code == "" || callback.State == "" {
		return newBadRequestServiceError(errors.New("missing code or state"), "missing required parameters")
	}

	log.add("state", callback.State)

	// Retrieve and verify state token from NATS KV store
	js, _ := srv.nats.JetStream()
	kvBucket, _ := js.KeyValue("canvas_oauth_state")

	stateEntry, err := kvBucket.Get(callback.State)
	if err != nil {
		return newUnauthorizedServiceError()
	}

	var state models.CanvasOAuthState
	if err := json.Unmarshal(stateEntry.Value(), &state); err != nil {
		return newUnauthorizedServiceError()
	}

	// Verify state hasn't expired
	if time.Now().After(state.ExpiresAt) {
		return newUnauthorizedServiceError()
	}

	log.add("facility_id", state.FacilityID)

	// Decrypt credentials
	canvasConfig, err := srv.Db.GetCanvasOAuthConfig(state.FacilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if canvasConfig == nil {
		return newInternalServerServiceError(
			errors.New("canvas oauth config not found"),
			"Canvas OAuth credentials were not found",
		)
	}

	clientID, err := models.DecryptAccessKey(canvasConfig.ClientID)
	if err != nil {
		return newInternalServerServiceError(err, "failed to decrypt client ID")
	}

	clientSecret, err := models.DecryptAccessKey(canvasConfig.ClientSecret)
	if err != nil {
		return newInternalServerServiceError(err, "failed to decrypt client secret")
	}

	// Exchange code for access token (Step 3)
	tokenResp, err := srv.exchangeCanvasCodeForToken(state.CanvasURL, callback.Code, clientID, clientSecret)
	if err != nil {
		return newInternalServerServiceError(err, "failed to exchange authorization code")
	}

	// Encrypt and store token in database (Step 4)
	encryptedToken, err := models.EncryptAccessKey(tokenResp.AccessToken)
	if err != nil {
		return newInternalServerServiceError(err, "failed to encrypt token")
	}

	encryptedRefresh := ""
	if tokenResp.RefreshToken != "" {
		encryptedRefresh, _ = models.EncryptAccessKey(tokenResp.RefreshToken)
	}

	expiresAt := time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)

	// Save or update Canvas OAuth token
	canvasToken := models.CanvasOAuthToken{
		FacilityID:     state.FacilityID,
		CanvasURL:      state.CanvasURL,
		AccessToken:    encryptedToken,
		RefreshToken:   encryptedRefresh,
		TokenExpiresAt: &expiresAt,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := srv.Db.SaveCanvasOAuthToken(&canvasToken); err != nil {
		return newDatabaseServiceError(err)
	}

	// Clean up state token from NATS
	kvBucket.Delete(callback.State)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	return json.NewEncoder(w).Encode(map[string]interface{}{
		"message":     "Canvas connected successfully",
		"facility_id": state.FacilityID,
		"canvas_url":  state.CanvasURL,
	})
}

// getCanvasConnections - Get all Canvas connections for a facility
// GET /api/canvas/connections
func (srv *Server) getCanvasConnections(w http.ResponseWriter, r *http.Request, log sLog) error {
	// Extract facility ID from claims
	claims, ok := r.Context().Value(ClaimsKey).(*Claims)
	if !ok {
		return newUnauthorizedServiceError()
	}

	log.add("facility_id", claims.FacilityID)

	// Get all Canvas connections for this facility
	connections, err := srv.Db.GetCanvasConnections(claims.FacilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	var response []CanvasConnectionResponse
	for _, conn := range connections {
		response = append(response, CanvasConnectionResponse{
			ID:        conn.ID,
			CanvasURL: conn.CanvasURL,
			CreatedAt: conn.CreatedAt,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(response)
}

// saveCanvasOAuthConfig - POST /api/canvas/config
// Save Canvas OAuth configuration for a facility
func (srv *Server) saveCanvasOAuthConfig(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims, ok := r.Context().Value(ClaimsKey).(*Claims)
	if !ok {
		return newUnauthorizedServiceError()
	}

	var req CanvasConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newJSONReqBodyServiceError(err)
	}

	log.add("facility_id", claims.FacilityID)

	// Encrypt credentials
	encryptedClientID, err := models.EncryptAccessKey(req.ClientID)
	if err != nil {
		return newInternalServerServiceError(err, "failed to encrypt client ID")
	}

	encryptedClientSecret, err := models.EncryptAccessKey(req.ClientSecret)
	if err != nil {
		return newInternalServerServiceError(err, "failed to encrypt client secret")
	}

	config := models.CanvasOAuthConfig{
		FacilityID:   claims.FacilityID,
		ClientID:     encryptedClientID,
		ClientSecret: encryptedClientSecret,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := srv.Db.SaveCanvasOAuthConfig(&config); err != nil {
		return newDatabaseServiceError(err)
	}

	// Return masked response (don't expose actual credentials)
	maskedClientID := req.ClientID
	if len(maskedClientID) > 4 {
		maskedClientID = maskedClientID[:4] + "..." + maskedClientID[len(maskedClientID)-4:]
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(CanvasConfigResponse{
		FacilityID: strconv.FormatUint(uint64(claims.FacilityID), 10),
		ClientID:   maskedClientID,
		UpdatedAt:  time.Now(),
	})
}

// getCanvasOAuthConfig - GET /api/canvas/config
// Retrieve Canvas OAuth configuration for a facility (masked)
func (srv *Server) getCanvasOAuthConfig(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims, ok := r.Context().Value(ClaimsKey).(*Claims)
	if !ok {
		return newUnauthorizedServiceError()
	}

	log.add("facility_id", claims.FacilityID)

	config, err := srv.Db.GetCanvasOAuthConfig(claims.FacilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	if config == nil {
		w.Header().Set("Content-Type", "application/json")
		return json.NewEncoder(w).Encode(map[string]interface{}{
			"facility_id": strconv.FormatUint(uint64(claims.FacilityID), 10),
			"configured":  false,
		})
	}

	// Return masked response
	decryptedClientID, _ := models.DecryptAccessKey(config.ClientID)
	maskedClientID := decryptedClientID
	if len(maskedClientID) > 4 {
		maskedClientID = maskedClientID[:4] + "..." + maskedClientID[len(maskedClientID)-4:]
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(CanvasConfigResponse{
		FacilityID: strconv.FormatUint(uint64(claims.FacilityID), 10),
		ClientID:   maskedClientID,
		UpdatedAt:  config.UpdatedAt,
	})
}

// disconnectCanvas - Remove a Canvas connection
// DELETE /api/canvas/connections/{connectionID}
func (srv *Server) disconnectCanvas(w http.ResponseWriter, r *http.Request, log sLog) error {
	// Extract facility ID from claims and connection ID from path
	claims, ok := r.Context().Value(ClaimsKey).(*Claims)
	if !ok {
		return newUnauthorizedServiceError()
	}

	connectionID := r.PathValue("connectionID")
	if connectionID == "" {
		return newBadRequestServiceError(errors.New("missing connection ID"), "connection ID required")
	}

	log.add("facility_id", claims.FacilityID)
	log.add("connection_id", connectionID)

	// Delete the connection
	if err := srv.Db.DeleteCanvasConnection(connectionID, claims.FacilityID); err != nil {
		return newDatabaseServiceError(err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]string{
		"message": "Canvas connection deleted",
	})
}

// Helper: Exchange authorization code for access token
func (srv *Server) exchangeCanvasCodeForToken(canvasURL, code, clientID, clientSecret string) (*CanvasTokenResponse, error) {
	tokenURL := canvasURL + "/login/oauth2/token"

	data := url.Values{
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"code":          {code},
		"redirect_uri":  {os.Getenv("CANVAS_OAUTH_REDIRECT_URI")},
		"grant_type":    {"authorization_code"},
	}

	resp, err := srv.Client.PostForm(tokenURL, data)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("canvas token exchange failed")
	}

	var tokenResp CanvasTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}

	return &tokenResp, nil
}

// Helper: Generate random state token
func generateCanvasState() string {
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
	baseURL := canvasURL
	if canvasURL[len(canvasURL)-1] == '/' {
		baseURL = canvasURL[:len(canvasURL)-1]
	}
	return baseURL + "/login/oauth2/auth?" + params.Encode()
}
