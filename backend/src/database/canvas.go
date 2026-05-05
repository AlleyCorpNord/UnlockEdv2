package database

import (
	"UnlockEdv2/src/models"

	log "github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// SaveCanvasOAuthToken saves or updates a Canvas OAuth token
func (db *DB) SaveCanvasOAuthToken(token *models.CanvasOAuthToken) error {
	fields := log.Fields{
		"facility_id": token.FacilityID,
		"canvas_url":  token.CanvasURL,
	}

	if err := db.Clauses(clause.OnConflict{
		UpdateAll: true,
	}).Create(&token).Error; err != nil {
		log.WithFields(fields).Errorf("error saving canvas oauth token: %v", err)
		return newCreateDBError(err, "canvas_oauth_tokens")
	}

	log.WithFields(fields).Info("Canvas OAuth token saved successfully")
	return nil
}

// GetCanvasConnection retrieves a single Canvas connection by ID and facility ID
func (db *DB) GetCanvasConnection(connectionID string, facilityID uint) (*models.CanvasOAuthToken, error) {
	var token models.CanvasOAuthToken

	if err := db.Where("id = ? AND facility_id = ?", connectionID, facilityID).First(&token).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, newNotFoundDBError(err, "canvas_oauth_tokens")
		}
		return nil, newGetRecordsDBError(err, "canvas_oauth_tokens")
	}

	return &token, nil
}

// GetCanvasConnections retrieves all Canvas connections for a facility
func (db *DB) GetCanvasConnections(facilityID uint) ([]models.CanvasOAuthToken, error) {
	var tokens []models.CanvasOAuthToken
	fields := log.Fields{"facility_id": facilityID}

	if err := db.Where("facility_id = ? AND deleted_at IS NULL", facilityID).
		Find(&tokens).Error; err != nil {
		log.WithFields(fields).Errorf("error fetching canvas connections: %v", err)
		return nil, newGetRecordsDBError(err, "canvas_oauth_tokens")
	}

	log.WithFields(fields).Infof("retrieved %d canvas connections", len(tokens))
	return tokens, nil
}

// GetCanvasConnectionByURL retrieves a Canvas connection by facility ID and Canvas URL
func (db *DB) GetCanvasConnectionByURL(facilityID uint, canvasURL string) (*models.CanvasOAuthToken, error) {
	var token models.CanvasOAuthToken
	fields := log.Fields{
		"facility_id": facilityID,
		"canvas_url":  canvasURL,
	}

	if err := db.Where("facility_id = ? AND canvas_url = ? AND deleted_at IS NULL", facilityID, canvasURL).
		First(&token).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.WithFields(fields).Debug("canvas connection not found")
			return nil, newNotFoundDBError(err, "canvas_oauth_tokens")
		}
		log.WithFields(fields).Errorf("error fetching canvas connection: %v", err)
		return nil, newGetRecordsDBError(err, "canvas_oauth_tokens")
	}

	return &token, nil
}

// GetCanvasConnectionByProviderPlatform retrieves Canvas connections by provider platform
func (db *DB) GetCanvasConnectionByProviderPlatform(providerPlatformID uint, facilityID uint) (*models.CanvasOAuthToken, error) {
	var token models.CanvasOAuthToken
	fields := log.Fields{
		"provider_platform_id": providerPlatformID,
		"facility_id":          facilityID,
	}

	if err := db.Where("provider_platform_id = ? AND facility_id = ? AND deleted_at IS NULL", providerPlatformID, facilityID).
		First(&token).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, newNotFoundDBError(err, "canvas_oauth_tokens")
		}
		log.WithFields(fields).Errorf("error fetching canvas connection: %v", err)
		return nil, newGetRecordsDBError(err, "canvas_oauth_tokens")
	}

	return &token, nil
}

// DeleteCanvasConnection removes a Canvas connection
func (db *DB) DeleteCanvasConnection(connectionID string, facilityID uint) error {
	fields := log.Fields{
		"connection_id": connectionID,
		"facility_id":   facilityID,
	}

	result := db.Where("id = ? AND facility_id = ? AND deleted_at IS NULL", connectionID, facilityID).
		Delete(&models.CanvasOAuthToken{})

	if result.Error != nil {
		log.WithFields(fields).Errorf("error deleting canvas connection: %v", result.Error)
		return newDeleteDBError(result.Error, "canvas_oauth_tokens")
	}

	if result.RowsAffected == 0 {
		log.WithFields(fields).Warn("no canvas connection found to delete")
		return newDeleteDBError(gorm.ErrRecordNotFound, "canvas_oauth_tokens")
	}

	log.WithFields(fields).Info("Canvas connection deleted successfully")
	return nil
}

// UpdateCanvasTokenExpiry updates the token expiration time
func (db *DB) UpdateCanvasTokenExpiry(connectionID string, expiresAt interface{}) error {
	if err := db.Model(&models.CanvasOAuthToken{}).
		Where("id = ?", connectionID).
		Update("token_expires_at", expiresAt).Error; err != nil {
		return newUpdateDBError(err, "canvas_oauth_tokens")
	}
	return nil
}

// DeleteExpiredCanvasTokens removes Canvas tokens that have expired
func (db *DB) DeleteExpiredCanvasTokens() error {
	if err := db.Where("token_expires_at < NOW()").
		Delete(&models.CanvasOAuthToken{}).Error; err != nil {
		log.Errorf("error deleting expired canvas tokens: %v", err)
		return newDeleteDBError(err, "canvas_oauth_tokens")
	}
	return nil
}

// CountCanvasConnections returns the number of Canvas connections for a facility
func (db *DB) CountCanvasConnections(facilityID uint) (int64, error) {
	var count int64
	if err := db.Model(&models.CanvasOAuthToken{}).
		Where("facility_id = ? AND deleted_at IS NULL", facilityID).
		Count(&count).Error; err != nil {
		return 0, newGetRecordsDBError(err, "canvas_oauth_tokens")
	}
	return count, nil
}

// SaveCanvasOAuthConfig saves or updates Canvas OAuth configuration for a facility
func (db *DB) SaveCanvasOAuthConfig(config *models.CanvasOAuthConfig) error {
	fields := log.Fields{
		"facility_id": config.FacilityID,
	}

	if err := db.Clauses(clause.OnConflict{
		UpdateAll: true,
	}).Create(&config).Error; err != nil {
		log.WithFields(fields).Errorf("error saving canvas oauth config: %v", err)
		return newCreateDBError(err, "canvas_oauth_configs")
	}

	log.WithFields(fields).Info("Canvas OAuth config saved successfully")
	return nil
}

// GetCanvasOAuthConfig retrieves Canvas OAuth configuration for a facility
func (db *DB) GetCanvasOAuthConfig(facilityID uint) (*models.CanvasOAuthConfig, error) {
	var config models.CanvasOAuthConfig
	fields := log.Fields{"facility_id": facilityID}

	if err := db.Where("facility_id = ?", facilityID).First(&config).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.WithFields(fields).Debug("canvas oauth config not found")
			return nil, nil // Return nil if not found, not an error
		}
		log.WithFields(fields).Errorf("error fetching canvas oauth config: %v", err)
		return nil, newGetRecordsDBError(err, "canvas_oauth_configs")
	}

	return &config, nil
}
