package handlers

import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	log "github.com/sirupsen/logrus"
)

type CanvasClient struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

// NewCanvasClient creates a new Canvas API client
func NewCanvasClient(canvasURL, accessToken string, httpClient *http.Client) *CanvasClient {
	// Ensure no trailing slash
	baseURL := strings.TrimSuffix(canvasURL, "/")
	return &CanvasClient{
		baseURL:    baseURL + "/api/v1",
		token:      accessToken,
		httpClient: httpClient,
	}
}

// GetCourses retrieves all courses from Canvas
func (c *CanvasClient) GetCourses() ([]models.CanvasCourse, error) {
	fields := log.Fields{"method": "GetCourses"}

	req, err := http.NewRequest("GET", c.baseURL+"/courses", nil)
	if err != nil {
		log.WithFields(fields).Errorf("error creating request: %v", err)
		return nil, err
	}
	c.addAuthHeader(req)

	// Request all course data
	q := req.URL.Query()
	q.Add("include", "all")
	q.Add("per_page", "100")
	req.URL.RawQuery = q.Encode()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.WithFields(fields).Errorf("error making request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.WithFields(fields).Errorf("non-200 response: %d - %s", resp.StatusCode, string(body))
		return nil, fmt.Errorf("canvas API returned %d", resp.StatusCode)
	}

	var courses []models.CanvasCourse
	if err := json.NewDecoder(resp.Body).Decode(&courses); err != nil {
		log.WithFields(fields).Errorf("error decoding response: %v", err)
		return nil, err
	}

	return courses, nil
}

// GetUsers retrieves all users from Canvas
func (c *CanvasClient) GetUsers() ([]models.CanvasUser, error) {
	fields := log.Fields{"method": "GetUsers"}

	req, err := http.NewRequest("GET", c.baseURL+"/users", nil)
	if err != nil {
		log.WithFields(fields).Errorf("error creating request: %v", err)
		return nil, err
	}
	c.addAuthHeader(req)

	q := req.URL.Query()
	q.Add("per_page", "100")
	req.URL.RawQuery = q.Encode()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.WithFields(fields).Errorf("error making request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.WithFields(fields).Errorf("non-200 response: %d - %s", resp.StatusCode, string(body))
		return nil, fmt.Errorf("canvas API returned %d", resp.StatusCode)
	}

	var users []models.CanvasUser
	if err := json.NewDecoder(resp.Body).Decode(&users); err != nil {
		log.WithFields(fields).Errorf("error decoding response: %v", err)
		return nil, err
	}

	return users, nil
}

// GetAssignments retrieves assignments for a course
func (c *CanvasClient) GetAssignments(courseID int) ([]models.CanvasAssignment, error) {
	fields := log.Fields{"method": "GetAssignments", "course_id": courseID}

	url := fmt.Sprintf("%s/courses/%d/assignments", c.baseURL, courseID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		log.WithFields(fields).Errorf("error creating request: %v", err)
		return nil, err
	}
	c.addAuthHeader(req)

	q := req.URL.Query()
	q.Add("per_page", "100")
	req.URL.RawQuery = q.Encode()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.WithFields(fields).Errorf("error making request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.WithFields(fields).Errorf("non-200 response: %d - %s", resp.StatusCode, string(body))
		return nil, fmt.Errorf("canvas API returned %d", resp.StatusCode)
	}

	var assignments []models.CanvasAssignment
	if err := json.NewDecoder(resp.Body).Decode(&assignments); err != nil {
		log.WithFields(fields).Errorf("error decoding response: %v", err)
		return nil, err
	}

	return assignments, nil
}

// GetSubmissions retrieves submissions for an assignment
func (c *CanvasClient) GetSubmissions(courseID, assignmentID int) ([]models.CanvasSubmission, error) {
	fields := log.Fields{"method": "GetSubmissions", "course_id": courseID, "assignment_id": assignmentID}

	url := fmt.Sprintf("%s/courses/%d/assignments/%d/submissions", c.baseURL, courseID, assignmentID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		log.WithFields(fields).Errorf("error creating request: %v", err)
		return nil, err
	}
	c.addAuthHeader(req)

	q := req.URL.Query()
	q.Add("per_page", "100")
	q.Add("include", "user")
	req.URL.RawQuery = q.Encode()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.WithFields(fields).Errorf("error making request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.WithFields(fields).Errorf("non-200 response: %d - %s", resp.StatusCode, string(body))
		return nil, fmt.Errorf("canvas API returned %d", resp.StatusCode)
	}

	var submissions []models.CanvasSubmission
	if err := json.NewDecoder(resp.Body).Decode(&submissions); err != nil {
		log.WithFields(fields).Errorf("error decoding response: %v", err)
		return nil, err
	}

	return submissions, nil
}

// GetEnrollments retrieves enrollments for a course
func (c *CanvasClient) GetEnrollments(courseID int) ([]models.CanvasEnrollment, error) {
	fields := log.Fields{"method": "GetEnrollments", "course_id": courseID}

	url := fmt.Sprintf("%s/courses/%d/enrollments", c.baseURL, courseID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		log.WithFields(fields).Errorf("error creating request: %v", err)
		return nil, err
	}
	c.addAuthHeader(req)

	q := req.URL.Query()
	q.Add("per_page", "100")
	req.URL.RawQuery = q.Encode()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.WithFields(fields).Errorf("error making request: %v", err)
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.WithFields(fields).Errorf("non-200 response: %d - %s", resp.StatusCode, string(body))
		return nil, fmt.Errorf("canvas API returned %d", resp.StatusCode)
	}

	var enrollments []models.CanvasEnrollment
	if err := json.NewDecoder(resp.Body).Decode(&enrollments); err != nil {
		log.WithFields(fields).Errorf("error decoding response: %v", err)
		return nil, err
	}

	return enrollments, nil
}

// TestConnection tests if the API token is valid
func (c *CanvasClient) TestConnection() error {
	fields := log.Fields{"method": "TestConnection"}

	req, err := http.NewRequest("GET", c.baseURL+"/users/self", nil)
	if err != nil {
		return err
	}
	c.addAuthHeader(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.WithFields(fields).Errorf("error making request: %v", err)
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.WithFields(fields).Errorf("invalid token: %d", resp.StatusCode)
		return fmt.Errorf("canvas API returned %d", resp.StatusCode)
	}

	return nil
}

func (c *CanvasClient) addAuthHeader(req *http.Request) {
	req.Header.Add("Authorization", "Bearer "+c.token)
	req.Header.Add("Accept", "application/json")
	req.Header.Add("Content-Type", "application/json")
}
