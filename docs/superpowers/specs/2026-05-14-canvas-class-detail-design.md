# Canvas Class Detail Page — Design Spec

**Date:** 2026-05-14  
**Status:** Approved

---

## Context

Canvas courses already appear as read-only class rows in the program detail page when viewing a Canvas program. Class rows are currently non-navigable (`onClick={undefined}`). This spec covers making those rows clickable and giving them a functional — but read-only — class detail page. The Roster tab shows live Canvas enrollment data; all other tabs show "Managed in Canvas" empty states; all write actions are hidden.

---

## Decisions

| Question | Decision |
|---|---|
| Canvas class row navigation | Enable (rows become clickable) |
| Class detail page | Reuse existing layout, read-only mode |
| Roster tab | Show Canvas-enrolled students fetched from Canvas API |
| Sessions / Schedule / At-Risk / History tabs | Show "Managed in Canvas" empty state |
| Write actions (Edit, Delete, Take Attendance, etc.) | Hidden entirely |

---

## ID Offset

Canvas course IDs are small integers that would collide with UnlockEd class IDs in `program_classes`. Apply the same offset pattern used for programs.

Add to `backend/src/models/program.go`:
```go
CanvasClassIDOffset = uint(100_000_000)
```

Fix `handleGetCanvasClasses` in `canvas_programs.go`:
```go
courseID := uint(courseIDFloat) + models.CanvasClassIDOffset
```

To recover the raw Canvas course ID: `canvasCourseID = classID - models.CanvasClassIDOffset`

---

## Backend — New Handlers

All new Canvas-specific handlers live in `backend/src/handlers/canvas_programs.go`.

### `handleGetCanvasClassDetail`

Called when `GET /api/program-classes/{class_id}` receives an ID ≥ `CanvasClassIDOffset`.

Steps:
1. Extract `canvasCourseID = uint(id) - CanvasClassIDOffset`
2. Extract `providerID` from `canvasCourseID` — **NOT** from the course ID. The course belongs to a provider; we retrieve the provider from the NATS canvas cache or DB by checking which Canvas provider platform has courses with this ID. Since we don't store the mapping directly, pass `providerID` as a query parameter from the frontend (encoded into the class ID is not possible here) — **alternate approach**: embed the providerID into the class ID using a two-level encoding: `classID = CanvasClassIDOffset + providerID * 1_000_000 + courseID`.

> **Revised encoding (replaces simple offset):**
> ```
> classID = 100_000_000 + (providerID * 1_000_000) + canvasCourseID
> ```
> Supports up to 999 providers and up to 999,999 courses per provider.
> Extraction:
> ```go
> remainder  := classID - CanvasClassIDOffset          // e.g. 1_000_042
> providerID := remainder / 1_000_000                  // e.g. 1
> courseID   := remainder % 1_000_000                  // e.g. 42
> ```

Fix `handleGetCanvasClasses` to use this encoding.

3. Fetch provider platform: `srv.Db.GetProviderPlatformByID(int(providerID))`
4. Call Canvas `GET /api/v1/courses/{courseId}?include[]=total_students`
5. Return a synthesized `ProgramClass` response:
   - `ID` = classID (with encoding)
   - `ProgramID` = `CanvasProgramIDOffset + providerID`
   - `Name` = course name
   - `Description` = course_code
   - `StartDt`, `EndDt` = parsed from Canvas `start_at` / `end_at`
   - `Status` = `Active` or `Completed` based on `end_at`
   - `Enrolled` = `total_students`

### `handleGetCanvasClassEnrollments`

Called when `GET /api/program-classes/{class_id}/enrollments` receives a Canvas class ID.

Steps:
1. Decode `providerID` and `courseID` from `classID`
2. Fetch provider platform
3. Call Canvas `GET /api/v1/courses/{courseId}/enrollments?type[]=StudentEnrollment&state[]=active&per_page=100`
4. For each Canvas enrollment, attempt to look up the matching UnlockEd user via `provider_user_mappings` (match on `external_user_id = canvas_user_id AND provider_platform_id = providerID`)
5. Build `EnrollmentDetails` slice:
   - Matched users: use UnlockEd `name_first + name_last` and `doc_id`
   - Unmatched users: use Canvas `user.name` as `name_full`, empty `doc_id`
6. Return as paginated response

---

## Backend — Early-Exit Guards

Add Canvas ID checks at the top of each handler, extracting `classID` from the path, then checking `uint(classID) >= models.CanvasClassIDOffset`.

| File | Handler | Stub response |
|---|---|---|
| `classes_handler.go` | `handleGetClass` | → `handleGetCanvasClassDetail` |
| `classes_handler.go` | `handleGetAttendanceFlagsForClass` | Empty paginated `[]AttendanceFlag{}` |
| `classes_handler.go` | `handleGetCumulativeAttendanceRate` | `{"attendance_rate": 0}` |
| `classes_handler.go` | `handleGetClassHistory` | Empty paginated `[]ChangeLogEntry{}` |
| `class_events.go` | `handleGetProgramClassEvents` | Empty paginated `[]ProgramClassEvent{}` |
| `class_enrollments.go` | `handleGetEnrollmentsForProgram` | → `handleGetCanvasClassEnrollments` (covers both Roster and Enrollment History tabs, which both call this endpoint with different `status` query params) |

---

## Frontend — `ProgramOverviewFacilityAdmin.tsx`

Make Canvas class rows navigable. Change the `ClassRow` render for Canvas programs from:

```tsx
onClick={isReadOnly ? undefined : () => navigate(`/program-classes/${cls.id}/detail`)}
className={isReadOnly ? undefined : 'hover:bg-[#E2E7EA]/50'}
editableStatus={!isReadOnly}
```

to passing `onClick` unconditionally (Canvas classes navigate to detail), but keeping `editableStatus={false}`:

```tsx
onClick={() => navigate(`/program-classes/${cls.id}/detail`)}
className="hover:bg-[#E2E7EA]/50"
editableStatus={false}   // still no status change for Canvas classes
```

The `isReadOnly` prop on `ClassesTab` and its corresponding type declaration can be removed — "Add Class" stays hidden via `canAddClass={false}`. The `isReadOnly` check on `ClassRow` (cursor and `editableStatus`) also gets removed from the Canvas-program paths; Canvas class rows just pass `editableStatus={false}` directly.

---

## Frontend — `class-detail/index.tsx`

```ts
const isCanvasClass = parseInt(class_id ?? '0') >= 100_000_000;
```

**Banner** (same blue style as program detail):
```tsx
{isCanvasClass && (
    <div className="bg-blue-50 border-b border-blue-200 ...">
        <BookOpen className="size-4" />
        This class is managed externally in Canvas. Data is read-only.
    </div>
)}
```

**Hidden write controls** when `isCanvasClass`:
- Edit class button
- Delete class button
- Take Attendance button
- Change Status button / dropdown

**Tab content** when `isCanvasClass`:
- **Roster** — renders normally; backend returns Canvas students
- **Sessions, Schedule, At-Risk, Enrollment History, Audit History** — each tab shows:
  ```tsx
  <div className="text-center text-gray-500 py-12">
      Sessions are managed in Canvas.
  </div>
  ```
  (message adapted per tab)

---

## Files to Modify / Create

| File | Change |
|---|---|
| `backend/src/models/program.go` | Add `CanvasClassIDOffset = uint(100_000_000)` |
| `backend/src/handlers/canvas_programs.go` | Fix `handleGetCanvasClasses` encoding; add `handleGetCanvasClassDetail`, `handleGetCanvasClassEnrollments` |
| `backend/src/handlers/classes_handler.go` | Canvas early-exits in `handleGetClass`, `handleGetAttendanceFlagsForClass`, `handleGetCumulativeAttendanceRate` |
| `backend/src/handlers/class_events.go` | Canvas early-exit in `handleGetProgramClassEvents` |
| `backend/src/handlers/class_enrollments.go` | Canvas early-exit in `handleGetEnrollmentsForProgram` → delegates to `handleGetCanvasClassEnrollments` |
| `frontend-v2/src/pages/programs/ProgramOverviewFacilityAdmin.tsx` | Enable Canvas class row navigation |
| `frontend-v2/src/pages/class-detail/index.tsx` | `isCanvasClass` + banner + hidden write controls + tab empty states |

---

## Verification

1. `go build ./...` — clean compile
2. Navigate to a Canvas program → class rows are now clickable → clicking opens class detail
3. Class detail shows "Synced from Canvas" banner
4. Roster tab shows Canvas-enrolled students (name, empty doc_id for unmatched)
5. Sessions tab shows "Sessions are managed in Canvas" empty state
6. Edit, Delete, Take Attendance buttons are absent
7. Non-Canvas programs and their classes are completely unaffected
