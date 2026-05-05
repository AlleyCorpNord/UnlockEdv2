package handlers

import (
	"UnlockEdv2/src/models"
	"net/http"

	log "github.com/sirupsen/logrus"
)

// GetCanvasClientForFacility retrieves a Canvas API client for a given facility's Canvas instance
func (srv *Server) GetCanvasClientForFacility(facilityID uint, canvasURL string) (*CanvasClient, error) {
	fields := log.Fields{
		"facility_id": facilityID,
		"canvas_url":  canvasURL,
	}

	// Get the Canvas OAuth token from database
	token, err := srv.Db.GetCanvasConnectionByURL(facilityID, canvasURL)
	if err != nil {
		log.WithFields(fields).Errorf("error getting canvas connection: %v", err)
		return nil, err
	}

	// Decrypt the access token
	decryptedToken, err := models.DecryptAccessKey(token.AccessToken)
	if err != nil {
		log.WithFields(fields).Errorf("error decrypting canvas token: %v", err)
		return nil, err
	}

	// Create and return Canvas client
	client := NewCanvasClient(canvasURL, decryptedToken, srv.Client)
	return client, nil
}

// SyncCanvasCoursesForFacility fetches courses from Canvas and can be used to sync them
func (srv *Server) SyncCanvasCoursesForFacility(facilityID uint, canvasURL string) ([]models.CanvasCourse, error) {
	fields := log.Fields{
		"facility_id": facilityID,
		"canvas_url":  canvasURL,
	}

	client, err := srv.GetCanvasClientForFacility(facilityID, canvasURL)
	if err != nil {
		log.WithFields(fields).Errorf("error getting canvas client: %v", err)
		return nil, err
	}

	courses, err := client.GetCourses()
	if err != nil {
		log.WithFields(fields).Errorf("error syncing courses from canvas: %v", err)
		return nil, err
	}

	log.WithFields(fields).Infof("synced %d courses from canvas", len(courses))
	return courses, nil
}

// SyncCanvasUsersForFacility fetches users from Canvas
func (srv *Server) SyncCanvasUsersForFacility(facilityID uint, canvasURL string) ([]models.CanvasUser, error) {
	fields := log.Fields{
		"facility_id": facilityID,
		"canvas_url":  canvasURL,
	}

	client, err := srv.GetCanvasClientForFacility(facilityID, canvasURL)
	if err != nil {
		log.WithFields(fields).Errorf("error getting canvas client: %v", err)
		return nil, err
	}

	users, err := client.GetUsers()
	if err != nil {
		log.WithFields(fields).Errorf("error syncing users from canvas: %v", err)
		return nil, err
	}

	log.WithFields(fields).Infof("synced %d users from canvas", len(users))
	return users, nil
}

// TestCanvasConnection tests if a Canvas API token is valid
func (srv *Server) TestCanvasConnection(facilityID uint, canvasURL string) error {
	fields := log.Fields{
		"facility_id": facilityID,
		"canvas_url":  canvasURL,
	}

	client, err := srv.GetCanvasClientForFacility(facilityID, canvasURL)
	if err != nil {
		log.WithFields(fields).Errorf("error getting canvas client: %v", err)
		return err
	}

	if err := client.TestConnection(); err != nil {
		log.WithFields(fields).Errorf("canvas connection test failed: %v", err)
		return err
	}

	log.WithFields(fields).Info("canvas connection test successful")
	return nil
}

// GetCanvasClientForConnection retrieves a Canvas client using a stored connection
func (srv *Server) GetCanvasClientForConnection(connection *models.CanvasOAuthToken) (*CanvasClient, error) {
	fields := log.Fields{
		"connection_id": connection.ID,
		"canvas_url":    connection.CanvasURL,
	}

	// Decrypt the access token
	decryptedToken, err := models.DecryptAccessKey(connection.AccessToken)
	if err != nil {
		log.WithFields(fields).Errorf("error decrypting canvas token: %v", err)
		return nil, err
	}

	// Create and return Canvas client
	client := NewCanvasClient(connection.CanvasURL, decryptedToken, srv.Client)
	return client, nil
}

// RefreshCanvasToken attempts to refresh an expired Canvas OAuth token
// Note: This requires Canvas to support refresh tokens in their OAuth flow
func (srv *Server) RefreshCanvasToken(connection *models.CanvasOAuthToken) (*CanvasTokenResponse, error) {
	fields := log.Fields{
		"connection_id": connection.ID,
		"canvas_url":    connection.CanvasURL,
	}

	if connection.RefreshToken == "" {
		log.WithFields(fields).Warn("no refresh token available for canvas connection")
		return nil, nil
	}

	// Exchange refresh token for new access token
	// Note: This requires implementing the refresh token endpoint
	// Canvas may not support this, so it might be optional
	log.WithFields(fields).Debug("refresh token exchange not yet implemented")
	return nil, nil
}

// ValidateCanvasURL verifies that a Canvas URL is accessible
func ValidateCanvasURL(canvasURL string, httpClient *http.Client) error {
	fields := log.Fields{"canvas_url": canvasURL}

	// Create a test client without auth to just check if Canvas is running
	client := NewCanvasClient(canvasURL, "", httpClient)

	// Attempt to connect - will fail with auth error but we can check for connectivity
	req, _ := http.NewRequest("GET", client.baseURL+"/users/self", nil)
	resp, err := httpClient.Do(req)
	if err != nil {
		log.WithFields(fields).Errorf("canvas URL not accessible: %v", err)
		return err
	}
	defer resp.Body.Close()

	// Any response (including 401 Unauthorized) means Canvas is running
	if resp.StatusCode < 500 {
		log.WithFields(fields).Debug("canvas URL is accessible")
		return nil
	}

	return err
}
