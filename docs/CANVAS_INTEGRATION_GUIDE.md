# Canvas Integration Implementation Guide

## Overview

Canvas OAuth2 integration is now fully implemented in UnlockEdv2. Prison admins can securely connect their Canvas instances to UnlockEd through OAuth2 without sharing API credentials.

## Database Setup

A migration has been created (`00065_add_canvas_oauth_tables.sql`) that creates two tables:

1. **canvas_oauth_tokens** - Stores encrypted Canvas API access tokens per facility
   - `id` - UUID primary key
   - `facility_id` - FK to facilities table
   - `canvas_url` - Canvas instance URL
   - `access_token` - Encrypted Bearer token
   - `refresh_token` - Encrypted refresh token (if available)
   - `token_expires_at` - Token expiration timestamp
   - `state` - OAuth state for tracking requests

2. **canvas_oauth_state** - Temporary storage for OAuth state tokens (auto-expires after 10 minutes)
   - Used for CSRF protection during OAuth flow

Run migrations: `make migrate`

## Configuration

Add these environment variables to your `.env` file (from Canvas Admin Settings → Developer Keys):

```bash
CANVAS_OAUTH_CLIENT_ID=<your_client_id>
CANVAS_OAUTH_CLIENT_SECRET=<your_client_secret>
CANVAS_OAUTH_REDIRECT_URI=http://127.0.0.1/api/canvas/oauth/callback
```

## API Endpoints

### 1. Initiate Canvas Connection
```http
POST /api/canvas/connect
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "facility_id": "12345",
  "canvas_url": "https://your-canvas.instructure.com"
}

Response:
{
  "auth_url": "https://your-canvas.instructure.com/login/oauth2/auth?...",
  "state": "randomstatehex..."
}
```

The `auth_url` should be sent to the frontend, which redirects the admin to Canvas login.

### 2. OAuth Callback (Automatic)
Canvas redirects back to: `/api/canvas/oauth/callback?code=...&state=...`

The backend automatically:
- Verifies the state token
- Exchanges the authorization code for an access token
- Encrypts and stores the token
- Returns success response

### 3. Get Canvas Connections
```http
GET /api/canvas/connections
Authorization: Bearer <admin_token>
X-Facility-ID: 12345

Response:
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "canvas_url": "https://your-canvas.instructure.com",
    "created_at": "2026-04-30T10:30:00Z"
  }
]
```

### 4. Disconnect Canvas
```http
DELETE /api/canvas/connections/{connectionID}
Authorization: Bearer <admin_token>
X-Facility-ID: 12345

Response:
{
  "message": "Canvas connection deleted"
}
```

## Using Canvas API from Backend

### Get Canvas Client
```go
// Get a Canvas API client for a facility's Canvas instance
client, err := srv.GetCanvasClientForFacility(facilityID, canvasURL)
if err != nil {
    log.Errorf("error getting canvas client: %v", err)
    return
}

// Test the connection
err = client.TestConnection()
if err != nil {
    log.Errorf("token invalid: %v", err)
    return
}
```

### Sync Courses
```go
courses, err := client.GetCourses()
if err != nil {
    log.Errorf("error fetching courses: %v", err)
    return
}

for _, course := range courses {
    fmt.Printf("Course: %s (ID: %d)\n", course.Name, course.ID)
    // TODO: Save to UnlockEd database
}
```

### Sync Users
```go
users, err := client.GetUsers()
if err != nil {
    log.Errorf("error fetching users: %v", err)
    return
}

for _, user := range users {
    fmt.Printf("User: %s (%s)\n", user.Name, user.Email)
    // TODO: Save to UnlockEd database
}
```

### Get Course Assignments
```go
courseID := 123

assignments, err := client.GetAssignments(courseID)
if err != nil {
    log.Errorf("error fetching assignments: %v", err)
    return
}

for _, assignment := range assignments {
    fmt.Printf("Assignment: %s (Points: %.1f)\n", assignment.Name, assignment.PointsPossible)
}
```

### Get Assignment Submissions
```go
courseID := 123
assignmentID := 456

submissions, err := client.GetSubmissions(courseID, assignmentID)
if err != nil {
    log.Errorf("error fetching submissions: %v", err)
    return
}

for _, submission := range submissions {
    fmt.Printf("Submission from user %d: Score %v\n", submission.UserID, submission.Score)
}
```

### Get Course Enrollments
```go
courseID := 123

enrollments, err := client.GetEnrollments(courseID)
if err != nil {
    log.Errorf("error fetching enrollments: %v", err)
    return
}

for _, enrollment := range enrollments {
    fmt.Printf("User %d enrolled as %s (State: %s)\n", enrollment.UserID, enrollment.Type, enrollment.State)
}
```

## Helper Functions

### Sync Canvas Courses for Facility
```go
courses, err := srv.SyncCanvasCoursesForFacility(facilityID, canvasURL)
if err != nil {
    log.Errorf("sync failed: %v", err)
    return
}
// Process courses...
```

### Sync Canvas Users for Facility
```go
users, err := srv.SyncCanvasUsersForFacility(facilityID, canvasURL)
if err != nil {
    log.Errorf("sync failed: %v", err)
    return
}
// Process users...
```

### Test Canvas Connection
```go
err := srv.TestCanvasConnection(facilityID, canvasURL)
if err != nil {
    log.Errorf("connection test failed: %v", err)
    return
}
// Connection is valid
```

## Security Considerations

✅ **Token Encryption**: All Canvas access tokens are encrypted with `APP_KEY` before storing in the database
✅ **State Token CSRF Protection**: OAuth state tokens are verified before token exchange
✅ **Token Expiration**: Expired tokens are tracked and can be rotated
✅ **Per-Facility Isolation**: Each facility's Canvas instance has separate encrypted tokens
✅ **Automatic Cleanup**: Expired state tokens are cleaned up after 10 minutes

## Data Models

### Canvas Models (in `models/canvas.go`)
```go
type CanvasOAuthToken struct {
    ID                 string     // UUID
    ProviderPlatformID uint       // Link to provider platforms
    FacilityID         uint       // Which facility this is for
    CanvasURL          string     // Canvas instance URL
    AccessToken        string     // Encrypted
    RefreshToken       string     // Encrypted
    TokenExpiresAt     *time.Time // Token expiration
}

type CanvasCourse struct {
    ID            int
    Name          string
    Code          string
    SISCourseID   string
    StartDate     string
    EndDate       string
}

type CanvasUser struct {
    ID        int
    LoginID   string
    Name      string
    Email     string
    SISUserID string
}

type CanvasAssignment struct {
    ID            int
    Name          string
    CourseID      int
    Description   string
    DueAt         string
    PointsPossible float32
}

type CanvasSubmission struct {
    ID           int
    AssignmentID int
    UserID       int
    Score        *float32
    Grade        string
    SubmittedAt  string
    GradedAt     string
}

type CanvasEnrollment struct {
    ID       int
    UserID   int
    CourseID int
    Type     string // StudentEnrollment, TeacherEnrollment, etc
    State    string // active, completed, etc
}
```

## Frontend Integration Example

```typescript
// Request auth URL
const response = await fetch('/api/canvas/connect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    facility_id: facilityId,
    canvas_url: 'https://your-canvas.instructure.com',
  }),
});

const { auth_url } = await response.json();

// Redirect to Canvas
window.location.href = auth_url;

// After user grants permission, Canvas redirects to:
// /api/canvas/oauth/callback?code=...&state=...
// The backend handles this automatically
```

## Testing

### Test Canvas Connection
```bash
curl -X GET http://127.0.0.1:8080/api/canvas/connections \
  -H "Authorization: Bearer <token>" \
  -H "X-Facility-ID: 1"
```

### Initiate Connection
```bash
curl -X POST http://127.0.0.1:8080/api/canvas/connect \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "facility_id": "1",
    "canvas_url": "http://canvas:3000"
  }'
```

### Disconnect
```bash
curl -X DELETE http://127.0.0.1:8080/api/canvas/connections/{connectionID} \
  -H "Authorization: Bearer <token>" \
  -H "X-Facility-ID: 1"
```

## Troubleshooting

### "Canvas OAuth Client ID not set"
- Check `.env` file has `CANVAS_OAUTH_CLIENT_ID` and `CANVAS_OAUTH_CLIENT_SECRET`
- Verify Canvas Developer Key is created in Canvas admin settings
- Restart backend server after changing environment variables

### "Invalid state token"
- OAuth state tokens expire after 10 minutes
- User must complete OAuth flow within this timeframe
- Try initiating connection again

### "Canvas connection not found"
- Ensure Canvas connection exists for the facility
- Verify facility ID matches the connected Canvas instance
- Check that connection hasn't been deleted

### "Token refresh failed"
- Canvas access tokens expire after 1 hour (default)
- Implement token refresh flow if needed (optional)
- User can reconnect to refresh token

## Future Enhancements

- [ ] Implement Canvas refresh token flow
- [ ] Add background job to sync courses/assignments automatically
- [ ] Build course enrollment sync with UnlockEd programs
- [ ] Track Canvas assignment submissions in UnlockEd
- [ ] Create admin UI for Canvas connection management
- [ ] Add Canvas user to UnlockEd user sync
- [ ] Implement batch operations for bulk enrollment syncing
- [ ] Add Canvas course grade sync to UnlockEd progress tracking
