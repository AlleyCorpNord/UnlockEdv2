# Canvas Program Detail Page — Design Spec

**Date:** 2026-05-14  
**Status:** Approved

---

## Context

Canvas provider platforms appear in the programs list as synthetic entries (IDs `>= 100_000_000`, `source: "canvas"`). Clicking one currently triggers a 404 because the backend handlers query the database for an ID that doesn't exist. This spec covers making the program detail page fully functional for Canvas-sourced programs.

---

## Decisions

| Question | Decision |
|---|---|
| Classes tab | Canvas courses rendered as read-only class rows |
| Action buttons (Edit, Delete, Status) | Disabled with tooltip: "Managed in Canvas" |
| Add Class button | Hidden entirely |
| Audit History tab | Shown — returns empty list from backend |
| Class row click | Suppressed (non-navigable) |

---

## Approach

Adapt the existing `ProgramOverviewFacilityAdmin.tsx` detail page rather than creating a new component. The backend detects Canvas program IDs at the handler level and returns synthesized-but-compatible data. The frontend derives a single `isCanvasProgram` boolean and gates all write actions with it.

---

## Backend Design

### Canvas ID detection helper

Add to `backend/src/models/program.go` (already present):
```go
const CanvasProgramIDOffset = uint(100_000_000)
```

All four affected handlers use the same pattern at the top:
```go
if uint(id) >= models.CanvasProgramIDOffset {
    return srv.handleShowCanvasProgram(...)  // or equivalent
}
```

### 1. `handleShowProgram` → `handleShowCanvasProgram`

**File:** `backend/src/handlers/canvas_programs.go`

Steps:
1. Extract `connectionID = uint(id) - models.CanvasProgramIDOffset`
2. `srv.Db.GetProviderPlatformByID(int(connectionID))` — 404 if not a Canvas type
3. Reuse `fetchCanvasProviderProgram(&provider)` (existing cache path)
4. Build and return `models.ProgramOverviewResponse`:
   - `Program.DatabaseFields.ID = uint(id)` (synthetic)
   - `Program.Name = "College - " + provider.Name`
   - `Program.Description` from program entry
   - `Program.IsActive = true`
   - `Program.ProgramTypes = []` (empty — no UnlockEd type applies)
   - `ActiveEnrollments`, `TotalEnrollments` from `ProgramsOverviewTable` metrics
   - `CompletionRate`, `AttendanceRate = 0`
   - `ActiveClassFacilityIDs = []`

### 2. `handleGetClassesForProgram` → `handleGetCanvasClasses`

**File:** `backend/src/handlers/canvas_programs.go`

Steps:
1. Extract `connectionID`, fetch provider platform
2. Call Canvas `GET /api/v1/accounts/{accountID}/courses?include[]=total_students&per_page=100` (same cache as `fetchCanvasProviderProgram` — can share the raw course list)
3. Map each Canvas course to `models.ProgramClassDetail`:

| `ProgramClassDetail` field | Canvas source |
|---|---|
| `DatabaseFields.ID` | Canvas course `id` (integer) |
| `ProgramID` | synthetic program ID |
| `FacilityID` | 0 |
| `FacilityName` | provider.Name |
| `Name` | course `name` |
| `Description` | course `course_code` |
| `StartDt` | course `start_at` (parsed), zero-time if absent |
| `EndDt` | course `end_at` (parsed), nil if absent |
| `Status` | `"Active"` if no end_at or end_at > now, else `"Inactive"` |
| `Enrolled` | course `total_students` |
| `Capacity` | 0 |
| `Schedule` | `""` |
| `Room` | `""` |
| `AttendanceRate` | 0 |
| `Completed` | 0 |

4. Return as paginated response (all courses, one page)

### 3. `handleGetProgramHistory`

At the top of the handler, add:
```go
if uint(id) >= models.CanvasProgramIDOffset {
    return writePaginatedResponse(w, http.StatusOK,
        []models.ChangeLogEntry{},
        models.NewPaginationInfo(1, args.PerPage, 0))
}
```

### 4. `handleGetProgramArchiveCheck`

At the top of the handler, add:
```go
if uint(id) >= models.CanvasProgramIDOffset {
    return writeJsonResponse(w, http.StatusOK, map[string][]string{"facilities": []string{}})
}
```

---

## Frontend Design

**File:** `frontend-v2/src/pages/programs/ProgramOverviewFacilityAdmin.tsx`

### Canvas detection

Add near the top of the component (after `program` is available):
```ts
const isCanvasProgram = (program?.id ?? 0) >= 100_000_000;
```

### Header banner

Insert a "Synced from Canvas" info banner below the program name / breadcrumb area when `isCanvasProgram`:
```tsx
{isCanvasProgram && (
    <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 mb-4">
        <span>This program is managed externally in Canvas. Data is read-only.</span>
    </div>
)}
```

### Disabled action buttons

Wrap the Status selector, Edit button, and More menu (Delete/Archive) each in a `Tooltip` with content `"Managed in Canvas"` and render them with `disabled` / pointer-events blocked when `isCanvasProgram`.

Pattern for each:
```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <span> {/* span needed so Tooltip works on disabled elements */}
        <Button disabled={isCanvasProgram} ...>Edit</Button>
      </span>
    </TooltipTrigger>
    {isCanvasProgram && (
      <TooltipContent>Managed in Canvas</TooltipContent>
    )}
  </Tooltip>
</TooltipProvider>
```

### Hidden Add Class button

```tsx
{!isCanvasProgram && (
    <Button onClick={...}>Add Class</Button>
)}
```

### Non-navigable class rows

The class rows rendered in the Classes tab currently use `onClick` to navigate to `/classes/{id}`. For Canvas programs, suppress this:
```tsx
onClick={isCanvasProgram ? undefined : () => navigate(`/classes/${cls.id}`)}
className={cn(..., isCanvasProgram ? 'cursor-default' : 'cursor-pointer')}
```

### Audit History tab

No change needed. The tab renders normally; the backend returns an empty list, so the existing empty state is shown.

---

## Files to Modify

| File | Change |
|---|---|
| `backend/src/handlers/programs_handler.go` | Add Canvas ID early-exit in `handleShowProgram`, `handleGetProgramHistory`, `handleGetProgramArchiveCheck` |
| `backend/src/handlers/classes_handler.go` | Add Canvas ID early-exit in `handleGetClassesForProgram` |
| `backend/src/handlers/canvas_programs.go` | Add `handleShowCanvasProgram` and `handleGetCanvasClasses` functions |
| `frontend-v2/src/pages/programs/ProgramOverviewFacilityAdmin.tsx` | Add `isCanvasProgram` + banner + disabled buttons + hidden Add Class + non-navigable rows |

---

## Verification

1. `go build ./...` — clean compile
2. Navigate to a Canvas program in the list → detail page loads without 404
3. Header shows "Synced from Canvas" banner
4. Classes tab shows Canvas courses as rows with name and enrollment count
5. Clicking a class row does nothing (no navigation)
6. Edit button is greyed out; hovering shows "Managed in Canvas" tooltip
7. Status selector is greyed out with same tooltip
8. "Add Class" button is absent
9. Audit History tab shows empty state (no error)
10. Non-Canvas programs are completely unaffected
