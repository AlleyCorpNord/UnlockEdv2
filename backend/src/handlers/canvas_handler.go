package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

type CanvasAPIKeyRequest struct {
	CanvasURL string `json:"canvas_url" validate:"required,url"`
	APIKey    string `json:"api_key" validate:"required"`
}

type CanvasAPIKeyResponse struct {
	ID        string    `json:"id"`
	CanvasURL string    `json:"canvas_url"`
	CreatedAt time.Time `json:"created_at"`
}

type CanvasTestConnectionRequest struct {
	CanvasURL string `json:"canvas_url" validate:"required,url"`
	APIKey    string `json:"api_key" validate:"required"`
}

// registerCanvasRoutes registers all Canvas-related routes
func (srv *Server) registerCanvasRoutes() []routeDef {
	return []routeDef{
		{
			routeMethod: "POST /api/canvas/api-keys",
			handler:     srv.saveCanvasAPIKey,
			admin:       true,
		},
		{
			routeMethod: "GET /api/canvas/api-keys",
			handler:     srv.getCanvasAPIKeys,
			admin:       true,
		},
		{
			routeMethod: "DELETE /api/canvas/api-keys/{keyID}",
			handler:     srv.deleteCanvasAPIKey,
			admin:       true,
		},
		{
			routeMethod: "POST /api/canvas/test-connection",
			handler:     srv.testCanvasConnection,
			admin:       true,
		},
	}
}

// saveCanvasAPIKey - POST /api/canvas/api-keys
// Save a Canvas API key for a facility
func (srv *Server) saveCanvasAPIKey(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims, ok := r.Context().Value(ClaimsKey).(*Claims)
	if !ok {
		return newUnauthorizedServiceError()
	}

	var req CanvasAPIKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newJSONReqBodyServiceError(err)
	}

	log.add("facility_id", claims.FacilityID)
	log.add("canvas_url", req.CanvasURL)

	// Encrypt the API key
	encryptedKey, err := models.EncryptAccessKey(req.APIKey)
	if err != nil {
		return newInternalServerServiceError(err, "failed to encrypt API key")
	}

	apiKey := models.CanvasAPIKey{
		FacilityID: claims.FacilityID,
		CanvasURL:  req.CanvasURL,
		APIKey:     encryptedKey,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := srv.Db.SaveCanvasAPIKey(&apiKey); err != nil {
		return newDatabaseServiceError(err)
	}

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(CanvasAPIKeyResponse{
		ID:        apiKey.ID,
		CanvasURL: apiKey.CanvasURL,
		CreatedAt: apiKey.CreatedAt,
	})
}

// getCanvasAPIKeys - GET /api/canvas/api-keys
// Get all Canvas API keys for a facility
func (srv *Server) getCanvasAPIKeys(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims, ok := r.Context().Value(ClaimsKey).(*Claims)
	if !ok {
		return newUnauthorizedServiceError()
	}

	log.add("facility_id", claims.FacilityID)

	keys, err := srv.Db.GetCanvasAPIKeysByFacility(claims.FacilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	response := make([]CanvasAPIKeyResponse, 0, len(keys))
	for _, key := range keys {
		response = append(response, CanvasAPIKeyResponse{
			ID:        key.ID,
			CanvasURL: key.CanvasURL,
			CreatedAt: key.CreatedAt,
		})
	}

	paginationData := models.NewPaginationInfo(1, len(response), int64(len(response)))
	return writePaginatedResponse(w, http.StatusOK, response, paginationData)
}

// deleteCanvasAPIKey - DELETE /api/canvas/api-keys/{keyID}
// Remove a Canvas API key
func (srv *Server) deleteCanvasAPIKey(w http.ResponseWriter, r *http.Request, log sLog) error {
	claims, ok := r.Context().Value(ClaimsKey).(*Claims)
	if !ok {
		return newUnauthorizedServiceError()
	}

	keyID := r.PathValue("keyID")
	if keyID == "" {
		return newBadRequestServiceError(errors.New("missing key ID"), "key ID required")
	}

	log.add("facility_id", claims.FacilityID)
	log.add("key_id", keyID)

	if err := srv.Db.DeleteCanvasAPIKey(keyID, claims.FacilityID); err != nil {
		return newDatabaseServiceError(err)
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]string{
		"message": "Canvas API key deleted",
	})
}

// testCanvasConnection - POST /api/canvas/test-connection
// Test if Canvas API key is valid
func (srv *Server) testCanvasConnection(w http.ResponseWriter, r *http.Request, log sLog) error {
	var req CanvasTestConnectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newJSONReqBodyServiceError(err)
	}

	log.add("canvas_url", req.CanvasURL)

	// Use a longer timeout for Canvas since it can be slow (especially in dev)
	canvasClient := &http.Client{Timeout: 30 * time.Second}
	client := NewCanvasClient(req.CanvasURL, req.APIKey, canvasClient)
	if err := client.TestConnection(); err != nil {
		return newBadRequestServiceError(err, "Canvas API key is invalid or Canvas instance is unreachable")
	}

	w.Header().Set("Content-Type", "application/json")
	return json.NewEncoder(w).Encode(map[string]string{
		"message": "Canvas connection successful",
	})
}
