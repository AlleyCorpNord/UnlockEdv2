package database

import (
	"UnlockEdv2/src/models"

	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// SaveCanvasAPIKey saves or updates a Canvas API key
func (db *DB) SaveCanvasAPIKey(apiKey *models.CanvasAPIKey) error {
	fields := log.Fields{
		"facility_id": apiKey.FacilityID,
		"canvas_url":  apiKey.CanvasURL,
	}

	if err := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "facility_id"}, {Name: "canvas_url"}},
		DoUpdates: clause.AssignmentColumns([]string{"api_key", "updated_at"}),
	}).Create(&apiKey).Error; err != nil {
		log.WithFields(fields).Errorf("error saving canvas api key: %v", err)
		return newCreateDBError(err, "canvas_api_keys")
	}

	log.WithFields(fields).Info("Canvas API key saved successfully")
	return nil
}

// GetCanvasAPIKey retrieves a Canvas API key by ID and facility ID
func (db *DB) GetCanvasAPIKey(keyID string, facilityID uint) (*models.CanvasAPIKey, error) {
	var key models.CanvasAPIKey

	if err := db.Where("id = ? AND facility_id = ?", keyID, facilityID).First(&key).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, newNotFoundDBError(err, "canvas_api_keys")
		}
		return nil, newGetRecordsDBError(err, "canvas_api_keys")
	}

	return &key, nil
}

// GetCanvasAPIKeyByURL retrieves a Canvas API key by facility ID and Canvas URL
func (db *DB) GetCanvasAPIKeyByURL(facilityID uint, canvasURL string) (*models.CanvasAPIKey, error) {
	var key models.CanvasAPIKey
	fields := log.Fields{
		"facility_id": facilityID,
		"canvas_url":  canvasURL,
	}

	if err := db.Where("facility_id = ? AND canvas_url = ?", facilityID, canvasURL).
		First(&key).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.WithFields(fields).Debug("canvas api key not found")
			return nil, nil
		}
		log.WithFields(fields).Errorf("error fetching canvas api key: %v", err)
		return nil, newGetRecordsDBError(err, "canvas_api_keys")
	}

	return &key, nil
}

// GetCanvasAPIKeysByFacility retrieves all Canvas API keys for a facility
func (db *DB) GetCanvasAPIKeysByFacility(facilityID uint) ([]models.CanvasAPIKey, error) {
	var keys []models.CanvasAPIKey
	fields := log.Fields{"facility_id": facilityID}

	if err := db.Where("facility_id = ?", facilityID).
		Find(&keys).Error; err != nil {
		log.WithFields(fields).Errorf("error fetching canvas api keys: %v", err)
		return nil, newGetRecordsDBError(err, "canvas_api_keys")
	}

	log.WithFields(fields).Infof("retrieved %d canvas api keys", len(keys))
	return keys, nil
}

// DeleteCanvasAPIKey removes a Canvas API key
func (db *DB) DeleteCanvasAPIKey(keyID string, facilityID uint) error {
	fields := log.Fields{
		"key_id":      keyID,
		"facility_id": facilityID,
	}

	result := db.Where("id = ? AND facility_id = ?", keyID, facilityID).
		Delete(&models.CanvasAPIKey{})

	if result.Error != nil {
		log.WithFields(fields).Errorf("error deleting canvas api key: %v", result.Error)
		return newDeleteDBError(result.Error, "canvas_api_keys")
	}

	if result.RowsAffected == 0 {
		log.WithFields(fields).Warn("no canvas api key found to delete")
		return newDeleteDBError(gorm.ErrRecordNotFound, "canvas_api_keys")
	}

	log.WithFields(fields).Info("Canvas API key deleted successfully")
	return nil
}
