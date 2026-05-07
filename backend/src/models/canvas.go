package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CanvasAPIKey struct {
	ID         string    `gorm:"primaryKey;type:uuid" json:"id"`
	FacilityID uint      `gorm:"not null;index" json:"facility_id"`
	CanvasURL  string    `gorm:"size:255;not null" json:"canvas_url"`
	APIKey     string    `gorm:"type:text;not null" json:"-"` // encrypted
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
	Facility   *Facility `gorm:"foreignKey:FacilityID;references:ID" json:"-"`
}

func (k *CanvasAPIKey) BeforeCreate(tx *gorm.DB) error {
	if k.ID == "" {
		k.ID = uuid.NewString()
	}
	return nil
}

func (CanvasAPIKey) TableName() string {
	return "canvas_api_keys"
}

// Canvas API Models

type CanvasCourse struct {
	ID               int    `json:"id"`
	Name             string `json:"name"`
	Code             string `json:"course_code"`
	SISCourseID      string `json:"sis_course_id"`
	EnrollmentTermID int    `json:"enrollment_term_id"`
	StartDate        string `json:"start_at"`
	EndDate          string `json:"end_at"`
}

type CanvasUser struct {
	ID        int    `json:"id"`
	LoginID   string `json:"login_id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	SISUserID string `json:"sis_user_id"`
}

type CanvasAssignment struct {
	ID             int     `json:"id"`
	Name           string  `json:"name"`
	CourseID       int     `json:"course_id"`
	Description    string  `json:"description"`
	DueAt          string  `json:"due_at"`
	PointsPossible float32 `json:"points_possible"`
}

type CanvasSubmission struct {
	ID           int      `json:"id"`
	AssignmentID int      `json:"assignment_id"`
	UserID       int      `json:"user_id"`
	Score        *float32 `json:"score"`
	Grade        string   `json:"grade"`
	SubmittedAt  string   `json:"submitted_at"`
	GradedAt     string   `json:"graded_at"`
}

type CanvasEnrollment struct {
	ID       int    `json:"id"`
	UserID   int    `json:"user_id"`
	CourseID int    `json:"course_id"`
	Type     string `json:"type"`  // StudentEnrollment, TeacherEnrollment, etc
	State    string `json:"state"` // active, completed, etc
}
