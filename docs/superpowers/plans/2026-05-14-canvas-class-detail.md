# Canvas Class Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Canvas-sourced class rows navigable and give them a functional read-only class detail page where the Roster tab shows live Canvas enrollments and all other tabs show "Managed in Canvas" empty states.

**Architecture:** Canvas class IDs are encoded as `CanvasClassIDOffset + providerID * 1_000_000 + courseID` so they never collide with real UnlockEd class IDs. Backend guards on every class-detail endpoint detect this offset and return synthesized or empty responses. The frontend derives `isCanvasClass` from the ID and hides all write controls.

**Tech Stack:** Go 1.22, GORM, React 18, TypeScript, shadcn/ui, SWR

---

## File Map

| File | Change |
|---|---|
| `backend/src/models/program.go` | Add `CanvasClassIDOffset` constant |
| `backend/src/handlers/canvas_programs.go` | Fix class ID encoding in `handleGetCanvasClasses`; add `handleGetCanvasClassDetail` and `handleGetCanvasClassEnrollments` |
| `backend/src/handlers/classes_handler.go` | Canvas early-exits in `handleGetClass`, `handleGetAttendanceFlagsForClass`, `handleGetCumulativeAttendanceRate`, `handleGetClassHistory` |
| `backend/src/handlers/class_events.go` | Canvas early-exit in `handleGetProgramClassEvents` |
| `backend/src/handlers/class_enrollments.go` | Canvas early-exit in `handleGetEnrollmentsForProgram` |
| `frontend-v2/src/pages/programs/ProgramOverviewFacilityAdmin.tsx` | Enable Canvas class row navigation; remove `isReadOnly` |
| `frontend-v2/src/pages/class-detail/index.tsx` | `isCanvasClass` + banner + hidden write controls + tab empty states |

---

### Task 1: Canvas class ID constant + encoding fix

**Files:**
- Modify: `backend/src/models/program.go`
- Modify: `backend/src/handlers/canvas_programs.go`

The current `handleGetCanvasClasses` assigns raw Canvas course IDs (small integers) to class entries. This task replaces that with a two-level encoded ID: `CanvasClassIDOffset + providerID * 1_000_000 + courseID`.

- [ ] **Step 1: Add `CanvasClassIDOffset` to `backend/src/models/program.go`**

In `program.go`, add alongside the existing `CanvasProgramIDOffset` constant:

```go
const (
    CanvasProgramIDOffset = uint(100_000_000)
    CanvasClassIDOffset   = uint(100_000_000)
)
```

- [ ] **Step 2: Fix the class ID encoding in `handleGetCanvasClasses`**

In `backend/src/handlers/canvas_programs.go`, `handleGetCanvasClasses` currently starts with:

```go
func (srv *Server) handleGetCanvasClasses(w http.ResponseWriter, r *http.Request, log sLog, programID uint) error {
	connectionID := programID - models.CanvasProgramIDOffset
```

And inside the course loop (around line 211–212):

```go
		courseIDFloat, _ := course["id"].(float64)
		courseID := uint(courseIDFloat)
```

Change `courseID` calculation and the `DatabaseFields.ID` assignment to use the two-level encoding:

```go
		courseIDFloat, _ := course["id"].(float64)
		rawCourseID := uint(courseIDFloat)
		courseID := models.CanvasClassIDOffset + connectionID*1_000_000 + rawCourseID
```

Then in the `ProgramClassDetail` struct literal, replace `ID: courseID` with the new variable:

```go
		classes = append(classes, models.ProgramClassDetail{
			ProgramClass: models.ProgramClass{
				DatabaseFields: models.DatabaseFields{ID: courseID},
				ProgramID:      programID,
				FacilityID:     0,
				Name:           name,
				Description:    description,
				StartDt:        startDt,
				EndDt:          endDt,
				Status:         status,
				Enrolled:       enrolled,
			},
			FacilityName: provider.Name,
			Enrolled:     int(enrolled),
		})
```

- [ ] **Step 3: Build check**

```bash
cd /Users/guillaume/Documents/Repos/UnlockEdv2/backend && go build ./...
```

Expected: no output.

---

### Task 2: `handleGetCanvasClassDetail` and `handleGetCanvasClassEnrollments`

**Files:**
- Modify: `backend/src/handlers/canvas_programs.go`

Add two new functions after `handleGetCanvasClasses`.

**Decoding helper** (used in both new functions — place once above `handleGetCanvasClassDetail`):

```go
// decodeCanvasClassID recovers (providerID, rawCourseID) from an encoded Canvas class ID.
func decodeCanvasClassID(classID uint) (providerID uint, rawCourseID uint) {
	remainder := classID - models.CanvasClassIDOffset
	return remainder / 1_000_000, remainder % 1_000_000
}
```

- [ ] **Step 1: Add `handleGetCanvasClassDetail`**

Append to `canvas_programs.go`:

```go
func (srv *Server) handleGetCanvasClassDetail(w http.ResponseWriter, r *http.Request, log sLog, classID uint) error {
	providerID, rawCourseID := decodeCanvasClassID(classID)
	provider, err := srv.Db.GetProviderPlatformByID(int(providerID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if provider.Type != models.CanvasOSS && provider.Type != models.CanvasCloud {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a canvas type", providerID), "class ID")
	}

	url := fmt.Sprintf("%s/api/v1/courses/%d?include[]=total_students", provider.BaseUrl, rawCourseID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return newInternalServerServiceError(err, "failed to build canvas request")
	}
	req.Header.Add("Authorization", "Bearer "+provider.AccessKey)
	req.Header.Add("Accept", "application/json")

	resp, err := srv.Client.Do(req)
	if err != nil {
		return newInternalServerServiceError(err, "failed to reach canvas")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return newInternalServerServiceError(
			fmt.Errorf("canvas returned %d", resp.StatusCode),
			"canvas API error",
		)
	}

	var course map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&course); err != nil {
		return newInternalServerServiceError(err, "failed to decode canvas course")
	}

	name, _ := course["name"].(string)
	description, _ := course["course_code"].(string)
	programID := models.CanvasProgramIDOffset + providerID

	var startDt time.Time
	if s, ok := course["start_at"].(string); ok && s != "" {
		startDt, _ = time.Parse("2006-01-02T15:04:05Z", s)
	}

	var endDt *time.Time
	status := models.Active
	if s, ok := course["end_at"].(string); ok && s != "" {
		if t, parseErr := time.Parse("2006-01-02T15:04:05Z", s); parseErr == nil {
			endDt = &t
			if !t.After(time.Now()) {
				status = models.Completed
			}
		}
	}

	enrolled := int64(0)
	if ts, ok := course["total_students"].(float64); ok {
		enrolled = int64(ts)
	}

	cls := models.ProgramClass{
		DatabaseFields: models.DatabaseFields{ID: classID},
		ProgramID:      programID,
		Name:           name,
		Description:    description,
		StartDt:        startDt,
		EndDt:          endDt,
		Status:         status,
		Enrolled:       enrolled,
		Program: &models.Program{
			DatabaseFields: models.DatabaseFields{ID: programID},
			Name:           "College - " + provider.Name,
		},
		Events:      []models.ProgramClassEvent{},
		Enrollments: []models.ProgramClassEnrollment{},
	}
	return writeJsonResponse(w, http.StatusOK, cls)
}
```

- [ ] **Step 2: Add `canvasEnrollmentRow` type and `handleGetCanvasClassEnrollments`**

`EnrollmentDetails` lives in the `database` package and cannot be used directly in handlers. Define a local equivalent and append to `canvas_programs.go`:

```go
// canvasEnrollmentRow mirrors database.EnrollmentDetails JSON shape so the
// frontend's ClassEnrollment type maps correctly.
type canvasEnrollmentRow struct {
	models.ProgramClassEnrollment
	NameFull     string `json:"name_full"`
	DocID        string `json:"doc_id"`
	ClassName    string `json:"class_name"`
	StartDt      string `json:"start_dt"`
	CompletionDt string `json:"completion_dt"`
}

func (srv *Server) handleGetCanvasClassEnrollments(w http.ResponseWriter, r *http.Request, log sLog, classID uint) error {
	providerID, rawCourseID := decodeCanvasClassID(classID)
	provider, err := srv.Db.GetProviderPlatformByID(int(providerID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if provider.Type != models.CanvasOSS && provider.Type != models.CanvasCloud {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a canvas type", providerID), "class ID")
	}

	url := fmt.Sprintf(
		"%s/api/v1/courses/%d/enrollments?type[]=StudentEnrollment&state[]=active&per_page=100",
		provider.BaseUrl, rawCourseID,
	)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return newInternalServerServiceError(err, "failed to build canvas request")
	}
	req.Header.Add("Authorization", "Bearer "+provider.AccessKey)
	req.Header.Add("Accept", "application/json")

	resp, err := srv.Client.Do(req)
	if err != nil {
		return newInternalServerServiceError(err, "failed to reach canvas")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return newInternalServerServiceError(
			fmt.Errorf("canvas returned %d", resp.StatusCode),
			"canvas API error",
		)
	}

	var canvasEnrollments []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&canvasEnrollments); err != nil {
		return newInternalServerServiceError(err, "failed to decode canvas enrollments")
	}

	// Collect Canvas user IDs to batch-look up UnlockEd mappings.
	canvasUserIDs := make([]string, 0, len(canvasEnrollments))
	for _, e := range canvasEnrollments {
		if u, ok := e["user"].(map[string]interface{}); ok {
			if id, ok := u["id"].(float64); ok {
				canvasUserIDs = append(canvasUserIDs, fmt.Sprintf("%d", int(id)))
			}
		}
	}

	type mappingInfo struct {
		NameFull string
		DocID    string
		UserID   uint
	}
	userMap := make(map[string]mappingInfo)
	if len(canvasUserIDs) > 0 {
		var mappings []models.ProviderUserMapping
		srv.Db.Model(&models.ProviderUserMapping{}).
			Preload("User").
			Where("provider_platform_id = ? AND external_user_id IN ?", providerID, canvasUserIDs).
			Find(&mappings)
		for _, m := range mappings {
			if m.User != nil {
				userMap[m.ExternalUserID] = mappingInfo{
					NameFull: m.User.NameFirst + " " + m.User.NameLast,
					DocID:    m.User.DocID,
					UserID:   m.UserID,
				}
			}
		}
	}

	rows := make([]canvasEnrollmentRow, 0, len(canvasEnrollments))
	for i, e := range canvasEnrollments {
		canvasUserIDStr := ""
		canvasName := ""
		if u, ok := e["user"].(map[string]interface{}); ok {
			if id, ok := u["id"].(float64); ok {
				canvasUserIDStr = fmt.Sprintf("%d", int(id))
			}
			canvasName, _ = u["name"].(string)
		}

		info, matched := userMap[canvasUserIDStr]
		nameFull := canvasName
		docID := ""
		userID := uint(0)
		if matched {
			nameFull = info.NameFull
			docID = info.DocID
			userID = info.UserID
		}

		rows = append(rows, canvasEnrollmentRow{
			ProgramClassEnrollment: models.ProgramClassEnrollment{
				DatabaseFields:   models.DatabaseFields{ID: uint(i + 1)},
				ClassID:          classID,
				UserID:           userID,
				EnrollmentStatus: models.Enrolled,
			},
			NameFull:  nameFull,
			DocID:     docID,
			ClassName: "",
		})
	}

	args := srv.getQueryContext(r)
	args.Total = int64(len(rows))
	return writePaginatedResponse(w, http.StatusOK, rows, args.IntoMeta())
}
```

- [ ] **Step 3: Verify `User` struct has `DocID` and `NameFirst`/`NameLast`**

```bash
grep -n "DocID\|NameFirst\|NameLast" /Users/guillaume/Documents/Repos/UnlockEdv2/backend/src/models/users.go | head -10
```

Expected output includes lines like `DocID string` and `NameFirst string`. If field names differ, adjust the `handleGetCanvasClassEnrollments` code accordingly.

- [ ] **Step 4: Build check**

```bash
cd /Users/guillaume/Documents/Repos/UnlockEdv2/backend && go build ./...
```

Expected: no output.

---

### Task 3: Early-exit guards in backend handlers

**Files:**
- Modify: `backend/src/handlers/classes_handler.go`
- Modify: `backend/src/handlers/class_events.go`
- Modify: `backend/src/handlers/class_enrollments.go`

All guards follow the same pattern: parse `class_id`, check `>= models.CanvasClassIDOffset`, return stub.

- [ ] **Step 1: Guard `handleGetClass` in `classes_handler.go`**

Current function starts at line ~83. Add guard after the `strconv.Atoi` call:

```go
func (srv *Server) handleGetClass(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	if uint(id) >= models.CanvasClassIDOffset {
		return srv.handleGetCanvasClassDetail(w, r, log, uint(id))
	}
	class, err := srv.Db.GetClassByID(id)
	// ... rest unchanged
```

- [ ] **Step 2: Guard `handleGetAttendanceFlagsForClass` in `classes_handler.go`**

Current function starts at line ~308. Add guard after the `strconv.Atoi` call:

```go
func (srv *Server) handleGetAttendanceFlagsForClass(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	if uint(id) >= models.CanvasClassIDOffset {
		args := srv.getQueryContext(r)
		return writePaginatedResponse(w, http.StatusOK,
			[]models.AttendanceFlag{},
			models.NewPaginationInfo(1, args.PerPage, 0))
	}
	args := srv.getQueryContext(r)
	// ... rest unchanged
```

- [ ] **Step 3: Guard `handleGetCumulativeAttendanceRate` in `classes_handler.go`**

Current function starts at line ~390. Add guard after the `strconv.Atoi` call:

```go
func (srv *Server) handleGetCumulativeAttendanceRate(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	if uint(classID) >= models.CanvasClassIDOffset {
		return writeJsonResponse(w, http.StatusOK, map[string]float64{"attendance_rate": 0})
	}
	attendanceRate, err := srv.Db.GetCumulativeAttendanceRateForClass(r.Context(), classID)
	// ... rest unchanged
```

- [ ] **Step 4: Guard `handleGetClassHistory` in `classes_handler.go`**

Current function starts at line ~287. Add guard after the `strconv.Atoi` call:

```go
func (srv *Server) handleGetClassHistory(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class ID")
	}
	if uint(id) >= models.CanvasClassIDOffset {
		args := srv.getQueryContext(r)
		return writePaginatedResponse(w, http.StatusOK,
			[]models.ChangeLogEntry{},
			models.NewPaginationInfo(1, args.PerPage, 0))
	}
	args := srv.getQueryContext(r)
	// ... rest unchanged
```

- [ ] **Step 5: Guard `handleGetProgramClassEvents` in `class_events.go`**

Current function starts at line ~543. Add guard after the `strconv.Atoi` call:

```go
func (srv *Server) handleGetProgramClassEvents(w http.ResponseWriter, r *http.Request, log sLog) error {
	classID, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "class_id")
	}
	if uint(classID) >= models.CanvasClassIDOffset {
		args := srv.getQueryContext(r)
		return writePaginatedResponse(w, http.StatusOK,
			[]models.ProgramClassEvent{},
			models.NewPaginationInfo(1, args.PerPage, 0))
	}
	claims := r.Context().Value(ClaimsKey).(*Claims)
	// ... rest unchanged
```

- [ ] **Step 6: Guard `handleGetEnrollmentsForProgram` in `class_enrollments.go`**

Current function starts at line ~42. Add guard after the `strconv.Atoi` call:

```go
func (srv *Server) handleGetEnrollmentsForProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	classId, err := strconv.Atoi(r.PathValue("class_id"))
	if err != nil {
		return newInvalidIdServiceError(err, "Class ID")
	}
	if uint(classId) >= models.CanvasClassIDOffset {
		return srv.handleGetCanvasClassEnrollments(w, r, log, uint(classId))
	}
	status := r.URL.Query().Get("status")
	// ... rest unchanged
```

- [ ] **Step 7: Full backend build check**

```bash
cd /Users/guillaume/Documents/Repos/UnlockEdv2/backend && go build ./...
```

Expected: no output.

---

### Task 4: Frontend — enable Canvas class row navigation

**Files:**
- Modify: `frontend-v2/src/pages/programs/ProgramOverviewFacilityAdmin.tsx`

Currently all four `ClassRow` groups inside `ClassesTab` use `isReadOnly` to suppress `onClick`. Remove those conditions so Canvas class rows navigate to the detail page, but keep `editableStatus={false}` for Canvas.

- [ ] **Step 1: Update active/scheduled class rows**

Find (around line 989–1010):

```tsx
                            {activeScheduledClasses.map((cls) => (
                                <ClassRow
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={
                                        isReadOnly
                                            ? undefined
                                            : () =>
                                                  navigate(
                                                      `/program-classes/${cls.id}/detail`
                                                  )
                                    }
                                    className={
                                        isReadOnly
                                            ? undefined
                                            : 'hover:bg-[#E2E7EA]/50'
                                    }
                                    editableStatus={!isReadOnly}
                                    showEnrollment
                                />
                            ))}
```

Replace with:

```tsx
                            {activeScheduledClasses.map((cls) => (
                                <ClassRow
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={() =>
                                        navigate(
                                            `/program-classes/${cls.id}/detail`
                                        )
                                    }
                                    className="hover:bg-[#E2E7EA]/50"
                                    editableStatus={!isReadOnly}
                                    showEnrollment
                                />
                            ))}
```

- [ ] **Step 2: Update completed class rows**

Find (around line 1022–1041):

```tsx
                            {completedClasses.map((cls) => (
                                <ClassRow
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={
                                        isReadOnly
                                            ? undefined
                                            : () =>
                                                  navigate(
                                                      `/program-classes/${cls.id}/detail`
                                                  )
                                    }
                                    className={
                                        isReadOnly
                                            ? 'bg-gray-50/50'
                                            : 'hover:bg-gray-100 bg-gray-50/50'
                                    }
                                />
                            ))}
```

Replace with:

```tsx
                            {completedClasses.map((cls) => (
                                <ClassRow
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={() =>
                                        navigate(
                                            `/program-classes/${cls.id}/detail`
                                        )
                                    }
                                    className="hover:bg-gray-100 bg-gray-50/50"
                                />
                            ))}
```

- [ ] **Step 3: Update cancelled class rows**

Find (around line 1053–1072):

```tsx
                            {cancelledClasses.map((cls) => (
                                <ClassRow
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={
                                        isReadOnly
                                            ? undefined
                                            : () =>
                                                  navigate(
                                                      `/program-classes/${cls.id}/detail`
                                                  )
                                    }
                                    className={
                                        isReadOnly
                                            ? 'bg-gray-50/50'
                                            : 'hover:bg-gray-100 bg-gray-50/50'
                                    }
                                />
                            ))}
```

Replace with:

```tsx
                            {cancelledClasses.map((cls) => (
                                <ClassRow
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={() =>
                                        navigate(
                                            `/program-classes/${cls.id}/detail`
                                        )
                                    }
                                    className="hover:bg-gray-100 bg-gray-50/50"
                                />
                            ))}
```

- [ ] **Step 4: Update paused class rows**

Find (around line 1083–1103):

```tsx
                            {pausedClasses.map((cls) => (
                                <ClassRow
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={
                                        isReadOnly
                                            ? undefined
                                            : () =>
                                                  navigate(
                                                      `/program-classes/${cls.id}/detail`
                                                  )
                                    }
                                    className={
                                        isReadOnly
                                            ? 'bg-gray-50/50'
                                            : 'hover:bg-gray-100 bg-gray-50/50'
                                    }
                                    editableStatus={!isReadOnly}
                                />
                            ))}
```

Replace with:

```tsx
                            {pausedClasses.map((cls) => (
                                <ClassRow
                                    key={cls.id}
                                    cls={cls}
                                    onOpenStatusModal={onOpenStatusModal}
                                    onClick={() =>
                                        navigate(
                                            `/program-classes/${cls.id}/detail`
                                        )
                                    }
                                    className="hover:bg-gray-100 bg-gray-50/50"
                                    editableStatus={!isReadOnly}
                                />
                            ))}
```

- [ ] **Step 5: Remove `isReadOnly` from `ClassesTab` props and invocation**

Find the `ClassesTab` invocation (around line 665–676) and remove the `isReadOnly` prop:

```tsx
                            <ClassesTab
                                classes={nonArchivedClasses}
                                loading={classesLoading}
                                programId={program_id!}
                                facilityId={facilityId ?? undefined}
                                canAddClass={
                                    !!program.is_active &&
                                    !program.archived_at &&
                                    !isCanvasProgram
                                }
                                onOpenStatusModal={handleOpenStatusModal}
                                onCreated={() => void mutateClasses()}
                            />
```

Find the `ClassesTab` function definition (around line 890) and remove `isReadOnly` from both the destructuring and the interface:

```tsx
function ClassesTab({
    classes,
    loading,
    programId,
    facilityId,
    canAddClass,
    onOpenStatusModal,
    onCreated
}: {
    classes: Class[];
    loading: boolean;
    programId: string;
    facilityId?: number;
    canAddClass: boolean;
    onOpenStatusModal: (cls: Class) => void;
    onCreated?: () => void;
}) {
```

---

### Task 5: Frontend — class detail read-only mode

**Files:**
- Modify: `frontend-v2/src/pages/class-detail/index.tsx`

- [ ] **Step 1: Add `BookOpen` to imports**

At the top of `index.tsx`, `Edit`, `MoreVertical`, `Trash2` are imported from `lucide-react`. Add `BookOpen`:

```tsx
import { BookOpen, Edit, MoreVertical, Trash2 } from 'lucide-react';
```

- [ ] **Step 2: Add `isCanvasClass` constant**

After the `const cls = classResp?.data;` line (around line 93), add:

```tsx
const isCanvasClass = parseInt(class_id ?? '0') >= 100_000_000;
```

- [ ] **Step 3: Add the "Synced from Canvas" banner**

The render starts with the `bg-[#E2E7EA]` wrapper div (around line 139). Inside it, before the white header `div`, add:

```tsx
        <div className="bg-[#E2E7EA]">
            {isCanvasClass && (
                <div className="bg-blue-50 border-b border-blue-200">
                    <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-2 text-sm text-blue-700">
                        <BookOpen className="size-4 shrink-0" />
                        <span>
                            This class is managed externally in Canvas. Data is
                            read-only.
                        </span>
                    </div>
                </div>
            )}
            <div className="bg-white border-b border-gray-200">
```

- [ ] **Step 4: Hide write controls when `isCanvasClass`**

The three action controls sit in the `flex gap-2 ml-6` div (around line 152–206). Wrap each with `{!isCanvasClass && (…)}`:

```tsx
                        <div className="flex gap-2 ml-6">
                            {!isCanvasClass && (
                                <Button
                                    variant="outline"
                                    className="border-gray-300"
                                    onClick={() => { editModalVersion.current++; setShowEditModal(true); }}
                                >
                                    <Edit className="size-4 mr-2" />
                                    Edit Class
                                </Button>
                            )}
                            {!isCanvasClass && cls.status === SelectedClassStatus.Active && (
                                <Button
                                    onClick={() => setShowAttendanceModal(true)}
                                    className="bg-[#F1B51C] hover:bg-[#d9a419] text-[#203622]"
                                >
                                    Take Attendance
                                </Button>
                            )}
                            {!isCanvasClass && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-gray-100 h-9 w-9 p-0 border border-gray-300">
                                        <MoreVertical className="size-4" />
                                        <span className="sr-only">More options</span>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="z-[100]">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div>
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onClick={() => setShowDeleteModal(true)}
                                                        disabled={cls.enrolled > 0}
                                                    >
                                                        <Trash2 className="size-4 mr-2" />
                                                        Delete Class
                                                    </DropdownMenuItem>
                                                </div>
                                            </TooltipTrigger>
                                            {cls.enrolled > 0 && (
                                                <TooltipContent side="left">
                                                    Cannot delete class with enrolled residents
                                                </TooltipContent>
                                            )}
                                        </Tooltip>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
```

- [ ] **Step 5: Add empty states to non-Roster tabs**

The five `TabsContent` blocks for support, sessions, schedule, enrollment-history, and audit need empty states when `isCanvasClass`. Replace each `TabsContent` body with a conditional:

```tsx
                    <TabsContent value="support" className="space-y-4">
                        {isCanvasClass ? (
                            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
                                At-risk tracking is managed in Canvas.
                            </div>
                        ) : (
                            <SupportTab classId={cls.id} />
                        )}
                    </TabsContent>

                    <TabsContent value="sessions" className="space-y-4">
                        {isCanvasClass ? (
                            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
                                Sessions are managed in Canvas.
                            </div>
                        ) : (
                            <SessionsTab cls={cls} onClassMutate={() => void mutate()} />
                        )}
                    </TabsContent>

                    <TabsContent value="schedule" className="space-y-4">
                        {isCanvasClass ? (
                            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
                                Schedule is managed in Canvas.
                            </div>
                        ) : (
                            <ScheduleTab cls={cls} onClassMutate={() => void mutate()} />
                        )}
                    </TabsContent>

                    <TabsContent value="enrollment-history" className="space-y-4">
                        {isCanvasClass ? (
                            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
                                Enrollment history is managed in Canvas.
                            </div>
                        ) : (
                            <EnrollmentHistoryTab classId={cls.id} />
                        )}
                    </TabsContent>

                    <TabsContent value="audit" className="space-y-4">
                        {isCanvasClass ? (
                            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
                                Audit history is not available for Canvas classes.
                            </div>
                        ) : (
                            <AuditTab classId={cls.id} />
                        )}
                    </TabsContent>
```

- [ ] **Step 6: Backend build check**

```bash
cd /Users/guillaume/Documents/Repos/UnlockEdv2/backend && go build ./...
```

Expected: no output.

---

### Task 6: Verification

- [ ] **Step 1: Navigate to a Canvas program in the browser**

Go to `/programs` → click a Canvas program (one with the "Synced from Canvas" badge). Verify class rows in the Classes tab are now clickable (cursor changes, hover style shows).

- [ ] **Step 2: Click a Canvas class row**

The URL should change to `/program-classes/1XXXXXXXXX/detail`. The class detail page should load with the "Synced from Canvas" blue banner at the top.

- [ ] **Step 3: Verify write controls are hidden**

Edit Class button, Take Attendance button, and the ⋮ menu should be absent.

- [ ] **Step 4: Check the Roster tab**

Click the Roster tab. Canvas-enrolled students should appear as rows with names. Students matched to UnlockEd users show their `doc_id`; unmatched students show an empty doc_id column.

- [ ] **Step 5: Check non-Roster tabs**

Sessions, Schedule, At-Risk, Enrollment History, Audit History tabs should each show a "… is managed in Canvas" empty state card.

- [ ] **Step 6: Verify non-Canvas classes are unaffected**

Navigate to any regular UnlockEd class. It should open the full class detail page with all tabs functional and all write controls visible.
