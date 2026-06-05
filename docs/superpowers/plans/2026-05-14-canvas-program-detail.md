# Canvas Program Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the program detail page (`/programs/:id`) fully functional for Canvas-sourced programs (IDs ≥ 100,000,000) by returning synthesized-but-compatible data from the backend and gating all write actions in the frontend.

**Architecture:** Backend handlers detect Canvas IDs via `uint(id) >= models.CanvasProgramIDOffset` and delegate to new Canvas-specific handlers in `canvas_programs.go`. The frontend derives `isCanvasProgram = (program?.id ?? 0) >= 100_000_000` and uses it to show a read-only banner, disable action buttons with tooltips, and suppress class row navigation.

**Tech Stack:** Go 1.22, GORM, NATS JetStream KV, React 18, TypeScript, shadcn/ui, SWR

---

## File Map

| File | Role |
|---|---|
| `backend/src/handlers/canvas_programs.go` | Add `handleShowCanvasProgram` + `handleGetCanvasClasses` |
| `backend/src/handlers/programs_handler.go` | Canvas early-exit guards in `handleShowProgram`, `handleGetProgramHistory`, `handleGetProgramArchiveCheck` |
| `backend/src/handlers/classes_handler.go` | Canvas early-exit guard in `handleGetClassesForProgram` |
| `frontend-v2/src/pages/programs/ProgramOverviewFacilityAdmin.tsx` | `isCanvasProgram` + banner + disabled actions + read-only class rows |

---

### Task 1: `handleShowCanvasProgram`

**Files:**
- Modify: `backend/src/handlers/canvas_programs.go`

- [ ] **Step 1: Add `handleShowCanvasProgram` to `canvas_programs.go`**

Append after the existing `fetchCanvasProviderProgram` function:

```go
func (srv *Server) handleShowCanvasProgram(w http.ResponseWriter, r *http.Request, log sLog, programID uint) error {
	connectionID := programID - models.CanvasProgramIDOffset
	provider, err := srv.Db.GetProviderPlatformByID(int(connectionID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if provider.Type != models.CanvasOSS && provider.Type != models.CanvasCloud {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a canvas type", connectionID), "program ID")
	}
	prog, err := srv.fetchCanvasProviderProgram(provider)
	if err != nil {
		return newInternalServerServiceError(err, "failed to fetch canvas program")
	}
	totalEnrollments := 0
	if prog.TotalEnrollments != nil {
		totalEnrollments = int(*prog.TotalEnrollments)
	}
	activeEnrollments := 0
	if prog.TotalActiveEnrollments != nil {
		activeEnrollments = int(*prog.TotalActiveEnrollments)
	}
	overview := models.ProgramOverviewResponse{
		Program: models.Program{
			DatabaseFields:     models.DatabaseFields{ID: programID},
			Name:               "College - " + provider.Name,
			Description:        prog.Description,
			IsActive:           true,
			ProgramTypes:       []models.ProgramType{},
			ProgramCreditTypes: []models.ProgramCreditType{},
			Facilities:         []models.Facility{},
		},
		ActiveResidents:        activeEnrollments,
		ActiveEnrollments:      activeEnrollments,
		TotalEnrollments:       totalEnrollments,
		ActiveClassFacilityIDs: []int{},
	}
	return writeJsonResponse(w, http.StatusOK, overview)
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
cd backend && go build ./src/handlers/
```

Expected: no output (success).

---

### Task 2: `handleGetCanvasClasses`

**Files:**
- Modify: `backend/src/handlers/canvas_programs.go`

- [ ] **Step 1: Add import for `"net/http"` and `"encoding/json"` if not already present**

Check the top of `canvas_programs.go` — it already imports `"net/http"`, `"encoding/json"`, `"time"`, and `"fmt"`. No changes needed.

- [ ] **Step 2: Add `handleGetCanvasClasses` to `canvas_programs.go`**

Append after `handleShowCanvasProgram`:

```go
func (srv *Server) handleGetCanvasClasses(w http.ResponseWriter, r *http.Request, log sLog, programID uint) error {
	connectionID := programID - models.CanvasProgramIDOffset
	provider, err := srv.Db.GetProviderPlatformByID(int(connectionID))
	if err != nil {
		return newDatabaseServiceError(err)
	}
	if provider.Type != models.CanvasOSS && provider.Type != models.CanvasCloud {
		return newInvalidIdServiceError(fmt.Errorf("provider %d is not a canvas type", connectionID), "program ID")
	}

	url := provider.BaseUrl + "/api/v1/accounts/" + provider.AccountID +
		"/courses?include[]=total_students&per_page=100"
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

	var courses []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&courses); err != nil {
		return newInternalServerServiceError(err, "failed to decode canvas courses")
	}

	now := time.Now()
	classes := make([]models.ProgramClassDetail, 0, len(courses))
	for _, course := range courses {
		courseIDFloat, _ := course["id"].(float64)
		courseID := uint(courseIDFloat)
		name, _ := course["name"].(string)
		description, _ := course["course_code"].(string)

		var startDt time.Time
		if startAt, ok := course["start_at"].(string); ok && startAt != "" {
			startDt, _ = time.Parse("2006-01-02T15:04:05Z", startAt)
		}

		var endDt *time.Time
		status := models.Active
		if endAt, ok := course["end_at"].(string); ok && endAt != "" {
			if t, parseErr := time.Parse("2006-01-02T15:04:05Z", endAt); parseErr == nil {
				endDt = &t
				if !t.After(now) {
					status = models.Completed
				}
			}
		}

		enrolled := int64(0)
		if ts, ok := course["total_students"].(float64); ok {
			enrolled = int64(ts)
		}

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
		})
	}

	args := srv.getQueryContext(r)
	args.Total = int64(len(classes))
	return writePaginatedResponse(w, http.StatusOK, classes, args.IntoMeta())
}
```

- [ ] **Step 3: Verify the file compiles**

```bash
cd backend && go build ./src/handlers/
```

Expected: no output (success).

---

### Task 3: Canvas early-exit guards

**Files:**
- Modify: `backend/src/handlers/programs_handler.go`
- Modify: `backend/src/handlers/classes_handler.go`

- [ ] **Step 1: Add Canvas guard to `handleShowProgram`**

In `programs_handler.go`, replace the start of `handleShowProgram` (after the `id` parse, before the `GetProgramByID` call):

```go
func (srv *Server) handleShowProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	if uint(id) >= models.CanvasProgramIDOffset {
		return srv.handleShowCanvasProgram(w, r, log, uint(id))
	}
	// ... rest of existing code unchanged ...
```

- [ ] **Step 2: Add Canvas guard to `handleGetProgramHistory`**

In `programs_handler.go`, add after the `id` parse at the top of `handleGetProgramHistory`:

```go
func (srv *Server) handleGetProgramHistory(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	if uint(id) >= models.CanvasProgramIDOffset {
		args := srv.getQueryContext(r)
		return writePaginatedResponse(w, http.StatusOK,
			[]models.ChangeLogEntry{},
			models.NewPaginationInfo(1, args.PerPage, 0))
	}
	// ... rest of existing code unchanged ...
```

- [ ] **Step 3: Add Canvas guard to `handleGetProgramArchiveCheck`**

In `programs_handler.go`, add after the `id` parse at the top of `handleGetProgramArchiveCheck`:

```go
func (srv *Server) handleGetProgramArchiveCheck(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	if uint(id) >= models.CanvasProgramIDOffset {
		return writeJsonResponse(w, http.StatusOK, struct {
			Facilities []string `json:"facilities"`
		}{Facilities: []string{}})
	}
	// ... rest of existing code unchanged ...
```

- [ ] **Step 4: Add Canvas guard to `handleGetClassesForProgram`**

In `classes_handler.go`, add after the `id` parse at the top of `handleGetClassesForProgram`:

```go
func (srv *Server) handleGetClassesForProgram(w http.ResponseWriter, r *http.Request, log sLog) error {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		return newInvalidIdServiceError(err, "program ID")
	}
	if uint(id) >= models.CanvasProgramIDOffset {
		return srv.handleGetCanvasClasses(w, r, log, uint(id))
	}
	// ... rest of existing code unchanged ...
```

- [ ] **Step 5: Full backend build check**

```bash
cd backend && go build ./...
```

Expected: no output (success).

- [ ] **Step 6: Commit backend changes**

```bash
git add backend/src/handlers/canvas_programs.go \
        backend/src/handlers/programs_handler.go \
        backend/src/handlers/classes_handler.go
git commit -m "feat: handle canvas program IDs in detail/classes/history/archive-check endpoints"
```

---

### Task 4: Frontend — `isCanvasProgram` + banner + disabled actions

**Files:**
- Modify: `frontend-v2/src/pages/programs/ProgramOverviewFacilityAdmin.tsx`

- [ ] **Step 1: Add `isCanvasProgram` constant**

In `ProgramOverviewFacilityAdmin`, add this line right after the `if (!program) return (...)` block (around line 298, before `const programStatus = ...`):

```tsx
const isCanvasProgram = (program?.id ?? 0) >= 100_000_000;
```

- [ ] **Step 2: Add the "Synced from Canvas" info banner**

In the render, right after the `showFacilityContextBanner` block and before the white header div (around line 411), add:

```tsx
{isCanvasProgram && (
    <div className="bg-blue-50 border-b border-blue-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-2 text-sm text-blue-700">
            <BookOpen className="size-4 shrink-0" />
            <span>
                This program is managed externally in Canvas. Data is
                read-only.
            </span>
        </div>
    </div>
)}
```

`BookOpen` is already imported at the top of the file.

- [ ] **Step 3: Disable the Status selector for Canvas programs**

Find the `<Select value={programStatus} ...>` block (around line 454). Change:

```tsx
<Select
    value={programStatus}
    onValueChange={(value) =>
        void handleStatusSelectChange(value)
    }
    disabled={archiveCheckLoading}
>
```

to:

```tsx
<Tooltip>
    <TooltipTrigger asChild>
        <span>
            <Select
                value={programStatus}
                onValueChange={
                    isCanvasProgram
                        ? undefined
                        : (value) =>
                              void handleStatusSelectChange(value)
                }
                disabled={archiveCheckLoading || isCanvasProgram}
            >
```

and close the `</Tooltip>` after the existing `</Select>`:

```tsx
            </Select>
        </span>
    </TooltipTrigger>
    {isCanvasProgram && (
        <TooltipContent>Managed in Canvas</TooltipContent>
    )}
</Tooltip>
```

- [ ] **Step 4: Disable the Edit Program button for Canvas programs**

Find the Edit Program button (around line 495). Change:

```tsx
<Button
    variant="outline"
    className="border-gray-300 mt-5 focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
    onClick={() => setShowEditDialog(true)}
>
    <Edit className="size-4 mr-2" />
    Edit Program
</Button>
```

to:

```tsx
<Tooltip>
    <TooltipTrigger asChild>
        <span>
            <Button
                variant="outline"
                className="border-gray-300 mt-5 focus-visible:border-[#b3b3b3] focus-visible:ring-[3px] focus-visible:ring-[#b3b3b3]/50 focus-visible:ring-offset-0"
                onClick={
                    isCanvasProgram
                        ? undefined
                        : () => setShowEditDialog(true)
                }
                disabled={isCanvasProgram}
            >
                <Edit className="size-4 mr-2" />
                Edit Program
            </Button>
        </span>
    </TooltipTrigger>
    {isCanvasProgram && (
        <TooltipContent>Managed in Canvas</TooltipContent>
    )}
</Tooltip>
```

- [ ] **Step 5: Disable the Delete item in the More menu for Canvas programs**

Find the `<DropdownMenuItem variant="destructive" ... disabled={deleteDisabled}>` (around line 520). Update its `disabled` prop and the tooltip condition:

```tsx
<Tooltip>
    <TooltipTrigger asChild>
        <div>
            <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteModalOpen(true)}
                disabled={deleteDisabled || isCanvasProgram}
            >
                <Trash2 className="size-4" />
                Delete Program
            </DropdownMenuItem>
        </div>
    </TooltipTrigger>
    {(deleteDisabled || isCanvasProgram) && (
        <TooltipContent side="left">
            {isCanvasProgram
                ? 'Managed in Canvas'
                : 'Cannot delete program with existing classes'}
        </TooltipContent>
    )}
</Tooltip>
```

---

### Task 5: Frontend — read-only class rows

**Files:**
- Modify: `frontend-v2/src/pages/programs/ProgramOverviewFacilityAdmin.tsx`

- [ ] **Step 1: Add `isReadOnly` prop to `ClassesTab` invocation**

Find the `<ClassesTab ...>` invocation (around line 612). Add the `isReadOnly` prop:

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
    isReadOnly={isCanvasProgram}
    onOpenStatusModal={handleOpenStatusModal}
    onCreated={() => void mutateClasses()}
/>
```

- [ ] **Step 2: Add `isReadOnly` to `ClassesTab` props interface**

Find the `ClassesTab` function definition (around line 833). Add `isReadOnly` to the props:

```tsx
function ClassesTab({
    classes,
    loading,
    programId,
    facilityId,
    canAddClass,
    isReadOnly,
    onOpenStatusModal,
    onCreated
}: {
    classes: Class[];
    loading: boolean;
    programId: string;
    facilityId?: number;
    canAddClass: boolean;
    isReadOnly?: boolean;
    onOpenStatusModal: (cls: Class) => void;
    onCreated?: () => void;
}) {
```

- [ ] **Step 3: Suppress `onClick` and cursor for Canvas class rows**

There are four `ClassRow` usages inside `ClassesTab` (for activeScheduled, completed, cancelled, and paused groups). For each one, change:

```tsx
onClick={() => navigate(`/program-classes/${cls.id}/detail`)}
```

to:

```tsx
onClick={
    isReadOnly
        ? () => {}
        : () => navigate(`/program-classes/${cls.id}/detail`)
}
className={
    isReadOnly
        ? 'opacity-90'
        : 'hover:bg-[#E2E7EA]/50'
}
```

Note: The four groups use slightly different `className` values (`hover:bg-[#E2E7EA]/50`, `hover:bg-gray-100 bg-gray-50/50`, etc.). For the completed/cancelled/paused groups use `className={isReadOnly ? 'opacity-90 bg-gray-50/50' : 'hover:bg-gray-100 bg-gray-50/50'}` to preserve their base styling.

The `cursor-pointer` is hardcoded inside `ClassRow` itself — to suppress it for read-only rows, also add this to the `ClassRow` component at line ~1080:

```tsx
<div
    className={cn(
        'p-6 transition-colors',
        onClick ? 'cursor-pointer' : 'cursor-default',
        className ?? ''
    )}
    onClick={onClick}
>
```

And change the `onClick` type in `ClassRow`'s props to optional:

```tsx
function ClassRow({
    cls,
    onOpenStatusModal,
    onClick,
    className,
    editableStatus,
    showEnrollment
}: {
    cls: Class;
    onOpenStatusModal: (cls: Class) => void;
    onClick?: () => void;   // was required, now optional
    className?: string;
    editableStatus?: boolean;
    showEnrollment?: boolean;
}) {
```

And for the read-only active/scheduled group, pass `onClick={undefined}` instead of `() => {}`:

```tsx
onClick={isReadOnly ? undefined : () => navigate(`/program-classes/${cls.id}/detail`)}
```

- [ ] **Step 4: Commit frontend changes**

```bash
git add frontend-v2/src/pages/programs/ProgramOverviewFacilityAdmin.tsx
git commit -m "feat: add canvas read-only view to program detail page"
```

---

### Task 6: Verification

- [ ] **Step 1: Backend build**

```bash
cd backend && go build ./...
```

Expected: no output.

- [ ] **Step 2: Smoke test — no Canvas providers**

Navigate to any existing UnlockEd program in the browser. Verify:
- Detail page loads normally
- Edit, Status, Delete work as before
- No "Synced from Canvas" banner

- [ ] **Step 3: Smoke test — Canvas program**

Navigate to `http://localhost/programs/100000001` (or click a Canvas program from the list). Verify:
- Page loads without 404
- "Synced from Canvas" banner appears at the top
- Classes tab shows Canvas courses as rows
- Clicking a class row does nothing (no navigation)
- Status selector is greyed out; hover shows "Managed in Canvas" tooltip
- Edit Program button is greyed out with same tooltip
- Delete menu item is greyed out with same tooltip
- Add Class button does not appear

- [ ] **Step 4: Smoke test — Audit History tab**

Click the "Audit History" tab on a Canvas program. Verify an empty state is shown (no error, no crash).
