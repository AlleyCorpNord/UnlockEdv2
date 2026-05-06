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

	// Get the Canvas API key from database
	apiKey, err := srv.Db.GetCanvasAPIKeyByURL(facilityID, canvasURL)
	if err != nil {
		log.WithFields(fields).Errorf("error getting canvas api key: %v", err)
		return nil, err
	}

	if apiKey == nil {
		log.WithFields(fields).Errorf("canvas api key not found")
		return nil, err
	}

	// Decrypt the API key
	decryptedKey, err := models.DecryptAccessKey(apiKey.APIKey)
	if err != nil {
		log.WithFields(fields).Errorf("error decrypting canvas api key: %v", err)
		return nil, err
	}

	// Create and return Canvas client
	client := NewCanvasClient(canvasURL, decryptedKey, srv.Client)
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

// GetCanvasClientForAPIKey retrieves a Canvas client using a stored API key
func (srv *Server) GetCanvasClientForAPIKey(apiKey *models.CanvasAPIKey) (*CanvasClient, error) {
	fields := log.Fields{
		"key_id":     apiKey.ID,
		"canvas_url": apiKey.CanvasURL,
	}

	// Decrypt the API key
	decryptedKey, err := models.DecryptAccessKey(apiKey.APIKey)
	if err != nil {
		log.WithFields(fields).Errorf("error decrypting canvas api key: %v", err)
		return nil, err
	}

	// Create and return Canvas client
	client := NewCanvasClient(apiKey.CanvasURL, decryptedKey, srv.Client)
	return client, nil
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
