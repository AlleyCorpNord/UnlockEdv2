# Canvas User Auto-Match Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic Canvas–UnlockEd user pairing via Levenshtein name similarity, surfacing results in three confidence tiers on the existing Provider User Management page for admin review before any mappings are written.

**Architecture:** A new `backend/src/handlers/user_matching.go` file holds the Levenshtein function, types, and two handlers. `GET match-users` runs in-memory matching and returns three buckets; `POST apply-matches` bulk-writes the confirmed mappings and creates new accounts. The frontend adds an "Auto-match" button, a summary bar, and a three-section review UI to the existing `ProviderUserManagement.tsx` — visible only when match results are loaded.

**Tech Stack:** Go 1.26 (no new deps), React 18 / TypeScript, GORM, Sonner toasts (existing)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `backend/src/handlers/user_matching.go` | **Create** | Levenshtein, `nameSimilarity`, `matchUsers`, all types, `handleMatchUsers`, `handleApplyMatches` |
| `backend/src/handlers/actions.go` | **Modify** | Register 2 new routes in `registerActionsRoutes` |
| `backend/src/database/provider_user_mappings.go` | **Modify** | Add `GetAllUnmappedUsers` (no pagination) |
| `backend/src/handlers/user_matching_test.go` | **Create** | Unit tests for `levenshtein`, `nameSimilarity`, `matchUsers` |
| `backend/tests/integration/user_matching_test.go` | **Create** | Integration test for `GetAllUnmappedUsers` |
| `frontend/src/types/provider.ts` | **Modify** | Add `UserMatchResult`, `MatchUsersResponse`, `ConfirmedMatch`, `ApplyMatchesRequest`, `ApplyMatchesResponse` |
| `frontend/src/Pages/admin/ProviderUserManagement.tsx` | **Modify** | matchState, auto-match button, summary bar, three-section review UI, apply handler |

---

## Task 1: Levenshtein, types, and `matchUsers` pure function

**Files:**
- Create: `backend/src/handlers/user_matching.go`

- [ ] **Step 1: Create the file with Levenshtein, types, and `matchUsers`**

```go
package handlers

import (
	"UnlockEdv2/src/models"
	"strings"
)

// --- Types ---

type UserMatchResult struct {
	CanvasUser    models.ImportUser `json:"canvas_user"`
	SuggestedUser *models.User      `json:"suggested_user,omitempty"`
	Score         float64           `json:"score"`
}

type MatchUsersResponse struct {
	AutoConfirmed []UserMatchResult   `json:"auto_confirmed"`
	Ambiguous     []UserMatchResult   `json:"ambiguous"`
	Unmatched     []models.ImportUser `json:"unmatched"`
}

type ConfirmedMatch struct {
	CanvasUser     models.ImportUser `json:"canvas_user"`
	UnlockEdUserID uint              `json:"unlocked_user_id"`
}

type ApplyMatchesRequest struct {
	Confirmed []ConfirmedMatch    `json:"confirmed"`
	ToCreate  []models.ImportUser `json:"to_create"`
}

type ApplyMatchesResponse struct {
	Applied int      `json:"applied"`
	Created int      `json:"created"`
	Failed  []string `json:"failed"`
}

// --- Levenshtein ---

func levenshtein(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	la, lb := len(ra), len(rb)
	dp := make([][]int, la+1)
	for i := range dp {
		dp[i] = make([]int, lb+1)
		dp[i][0] = i
	}
	for j := 0; j <= lb; j++ {
		dp[0][j] = j
	}
	for i := 1; i <= la; i++ {
		for j := 1; j <= lb; j++ {
			if ra[i-1] == rb[j-1] {
				dp[i][j] = dp[i-1][j-1]
			} else {
				dp[i][j] = 1 + min(dp[i-1][j], min(dp[i][j-1], dp[i-1][j-1]))
			}
		}
	}
	return dp[la][lb]
}

func nameSimilarity(a, b string) float64 {
	a = strings.ToLower(strings.TrimSpace(a))
	b = strings.ToLower(strings.TrimSpace(b))
	if a == b {
		return 1.0
	}
	ra, rb := []rune(a), []rune(b)
	maxLen := len(ra)
	if len(rb) > maxLen {
		maxLen = len(rb)
	}
	if maxLen == 0 {
		return 1.0
	}
	return 1.0 - float64(levenshtein(a, b))/float64(maxLen)
}

// --- Matching logic ---

func matchUsers(canvasUsers []models.ImportUser, unlockEdUsers []models.User) MatchUsersResponse {
	result := MatchUsersResponse{
		AutoConfirmed: []UserMatchResult{},
		Ambiguous:     []UserMatchResult{},
		Unmatched:     []models.ImportUser{},
	}
	for _, cu := range canvasUsers {
		canvasName := cu.NameFirst + " " + cu.NameLast
		bestScore := 0.0
		var bestUser *models.User
		for i, u := range unlockEdUsers {
			score := nameSimilarity(canvasName, u.NameFirst+" "+u.NameLast)
			if score > bestScore {
				bestScore = score
				bestUser = &unlockEdUsers[i]
			}
		}
		switch {
		case bestScore >= 0.90:
			result.AutoConfirmed = append(result.AutoConfirmed, UserMatchResult{CanvasUser: cu, SuggestedUser: bestUser, Score: bestScore})
		case bestScore >= 0.50:
			result.Ambiguous = append(result.Ambiguous, UserMatchResult{CanvasUser: cu, SuggestedUser: bestUser, Score: bestScore})
		default:
			result.Unmatched = append(result.Unmatched, cu)
		}
	}
	return result
}
```

- [ ] **Step 2: Build to verify no compile errors**

```bash
cd backend && go build ./src/handlers/...
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add backend/src/handlers/user_matching.go
git commit -m "feat: add Levenshtein matching types and matchUsers function"
```

---

## Task 2: Unit tests for matching logic

**Files:**
- Create: `backend/src/handlers/user_matching_test.go`

- [ ] **Step 1: Write unit tests**

```go
package handlers

import (
	"UnlockEdv2/src/models"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLevenshtein(t *testing.T) {
	require.Equal(t, 0, levenshtein("john", "john"))
	require.Equal(t, 1, levenshtein("john", "jon"))
	require.Equal(t, 4, levenshtein("john", "mary"))
}

func TestNameSimilarity(t *testing.T) {
	require.Equal(t, 1.0, nameSimilarity("John Smith", "John Smith"))
	require.Equal(t, 1.0, nameSimilarity("  JOHN SMITH ", "john smith"))
	score := nameSimilarity("John Smith", "Jon Smith")
	require.Greater(t, score, 0.85)
	require.Less(t, score, 1.0)
	score2 := nameSimilarity("John Smith", "Alice Jones")
	require.Less(t, score2, 0.50)
}

func TestMatchUsers(t *testing.T) {
	canvas := []models.ImportUser{
		{NameFirst: "John", NameLast: "Smith", ExternalUserID: "c1"},
		{NameFirst: "Marie", NameLast: "Tremblay", ExternalUserID: "c2"},
		{NameFirst: "Zyx", NameLast: "Qwerty", ExternalUserID: "c3"},
	}
	unlocked := []models.User{
		{NameFirst: "John", NameLast: "Smith"},     // exact → auto-confirmed
		{NameFirst: "Marie", NameLast: "Trembley"}, // close → ambiguous
		{NameFirst: "Alice", NameLast: "Jones"},    // no match → unmatched
	}
	unlocked[0].ID = 1
	unlocked[1].ID = 2
	unlocked[2].ID = 3

	result := matchUsers(canvas, unlocked)

	require.Len(t, result.AutoConfirmed, 1)
	require.Equal(t, "c1", result.AutoConfirmed[0].CanvasUser.ExternalUserID)
	require.Equal(t, 1.0, result.AutoConfirmed[0].Score)

	require.Len(t, result.Ambiguous, 1)
	require.Equal(t, "c2", result.Ambiguous[0].CanvasUser.ExternalUserID)
	require.Greater(t, result.Ambiguous[0].Score, 0.50)
	require.Less(t, result.Ambiguous[0].Score, 0.90)

	require.Len(t, result.Unmatched, 1)
	require.Equal(t, "c3", result.Unmatched[0].ExternalUserID)
}
```

- [ ] **Step 2: Run the tests**

```bash
cd backend && go test ./src/handlers/... -run "TestLevenshtein|TestNameSimilarity|TestMatchUsers" -v
```

Expected: all three tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/handlers/user_matching_test.go
git commit -m "test: unit tests for Levenshtein and matchUsers"
```

---

## Task 3: `GetAllUnmappedUsers` DB function

**Files:**
- Modify: `backend/src/database/provider_user_mappings.go`

- [ ] **Step 1: Add `GetAllUnmappedUsers` after the existing `GetUnmappedUsers` function**

Open `backend/src/database/provider_user_mappings.go`. Find the end of the `GetUnmappedUsers` function (around line 57) and add the new function immediately after it:

```go
func (db *DB) GetAllUnmappedUsers(providerID int, facilityID uint) ([]models.User, error) {
	var users []models.User
	err := db.Model(&models.User{}).
		Where(
			"facility_id = ? AND role = ? AND id NOT IN (?)",
			facilityID,
			"student",
			db.Model(&models.ProviderUserMapping{}).
				Select("user_id").
				Where("provider_platform_id = ?", providerID),
		).
		Find(&users).Error
	if err != nil {
		return nil, NewDBError(err, "error getting all unmapped users")
	}
	return users, nil
}
```

- [ ] **Step 2: Build to verify no compile errors**

```bash
cd backend && go build ./src/database/...
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add backend/src/database/provider_user_mappings.go
git commit -m "feat: add GetAllUnmappedUsers for matching (no pagination)"
```

---

## Task 4: Integration test for `GetAllUnmappedUsers`

**Files:**
- Create: `backend/tests/integration/user_matching_test.go`

- [ ] **Step 1: Write the integration test**

```go
package integration

import (
	"UnlockEdv2/src/models"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGetAllUnmappedUsers(t *testing.T) {
	env := SetupTestEnv(t)
	defer env.CleanupTestEnv()

	facility, err := env.CreateTestFacility("Match Test Facility")
	require.NoError(t, err)

	// Create a provider platform directly in DB
	provider := &models.ProviderPlatform{
		Name:      "Test Canvas",
		Type:      models.CanvasCloud,
		BaseUrl:   "https://canvas.example.com",
		AccountID: "1",
		AccessKey: "test-key",
		State:     models.Enabled,
	}
	require.NoError(t, env.DB.Create(provider).Error)

	// Create three students
	u1, err := env.CreateTestUser("studentone", models.Student, facility.ID, "")
	require.NoError(t, err)
	u2, err := env.CreateTestUser("studenttwo", models.Student, facility.ID, "")
	require.NoError(t, err)
	_, err = env.CreateTestUser("studentthree", models.Student, facility.ID, "")
	require.NoError(t, err)

	// Map u1 and u2 to the provider
	require.NoError(t, env.DB.CreateProviderUserMapping(&models.ProviderUserMapping{
		UserID:             u1.ID,
		ProviderPlatformID: provider.ID,
		ExternalUserID:     "ext1",
		ExternalUsername:   "ext_u1",
	}))
	require.NoError(t, env.DB.CreateProviderUserMapping(&models.ProviderUserMapping{
		UserID:             u2.ID,
		ProviderPlatformID: provider.ID,
		ExternalUserID:     "ext2",
		ExternalUsername:   "ext_u2",
	}))

	// Only studentthree should be returned
	users, err := env.DB.GetAllUnmappedUsers(int(provider.ID), facility.ID)
	require.NoError(t, err)
	require.Len(t, users, 1)
	require.Equal(t, "studentthree", users[0].Username)
}
```

- [ ] **Step 2: Check the `ProviderPlatform` model field names** to make sure `CanvasCloud`, `Enabled`, `AccountID`, `AccessKey`, `BaseUrl` match the actual constants and json tags in `backend/src/models/provider_platforms.go`. Adjust if needed.

- [ ] **Step 3: Run the integration test**

```bash
cd backend && go test ./tests/integration/... -run TestGetAllUnmappedUsers -v
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/integration/user_matching_test.go
git commit -m "test: integration test for GetAllUnmappedUsers"
```

---

## Task 5: `handleMatchUsers` endpoint

**Files:**
- Modify: `backend/src/handlers/user_matching.go` (add handler)
- Modify: `backend/src/handlers/actions.go` (add route)

- [ ] **Step 1: Add `handleMatchUsers` to `user_matching.go`**

Add after the `matchUsers` function:

```go
func (srv *Server) handleMatchUsers(w http.ResponseWriter, r *http.Request, log sLog) error {
	service, err := srv.getService(r)
	if err != nil {
		return newBadRequestServiceError(err, err.Error())
	}
	facilityID := srv.getFacilityID(r)

	canvasUsers, err := service.GetUsers()
	if err != nil {
		return newInternalServerServiceError(err, "error fetching provider users")
	}

	unlockEdUsers, err := srv.Db.GetAllUnmappedUsers(int(service.ProviderPlatformID), facilityID)
	if err != nil {
		return newDatabaseServiceError(err)
	}

	result := matchUsers(canvasUsers, unlockEdUsers)
	return writeJsonResponse(w, http.StatusOK, result)
}
```

- [ ] **Step 2: Register the route in `actions.go`**

In `registerActionsRoutes()`, add the new route to the returned slice:

```go
func (srv *Server) registerActionsRoutes() []routeDef {
	axx := models.ProviderAccess
	return []routeDef{
		adminFeatureRoute("GET /api/actions/provider-platforms/{id}/get-users", srv.handleGetUsers, axx),
		adminFeatureRoute("POST /api/actions/provider-platforms/{id}/import-users", srv.handleImportUsers, axx),
		adminFeatureRoute("GET /api/actions/provider-platforms/{id}/match-users", srv.handleMatchUsers, axx),
		adminFeatureRoute("POST /api/actions/provider-platforms/{id}/apply-matches", srv.handleApplyMatches, axx),
	}
}
```

(Leave the `handleApplyMatches` reference — you'll add the function body in the next task. The build will fail until then; that's fine — do both tasks before building.)

- [ ] **Step 3: Commit (after Task 6 makes it compile)**

Defer this commit to after Task 6 step 3.

---

## Task 6: `handleApplyMatches` endpoint

**Files:**
- Modify: `backend/src/handlers/user_matching.go` (add handler)

- [ ] **Step 1: Add required import to `user_matching.go`**

Update the import block at the top of `user_matching.go`:

```go
import (
	"UnlockEdv2/src/models"
	"encoding/json"
	"net/http"
	"strings"
)
```

- [ ] **Step 2: Add `handleApplyMatches` to `user_matching.go`**

Add after `handleMatchUsers`:

```go
func (srv *Server) handleApplyMatches(w http.ResponseWriter, r *http.Request, log sLog) error {
	var req ApplyMatchesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return newBadRequestServiceError(err, "invalid request body")
	}

	service, err := srv.getService(r)
	if err != nil {
		return newBadRequestServiceError(err, err.Error())
	}

	provider, err := srv.Db.GetProviderPlatformByID(int(service.ProviderPlatformID))
	if err != nil {
		return newDatabaseServiceError(err)
	}

	var failed []string
	applied := 0

	for _, c := range req.Confirmed {
		// Idempotent: skip if already mapped
		existing, _ := srv.Db.GetProviderUserMapping(int(c.UnlockEdUserID), int(service.ProviderPlatformID))
		if existing != nil {
			applied++
			continue
		}
		mapping := models.ProviderUserMapping{
			UserID:             c.UnlockEdUserID,
			ProviderPlatformID: service.ProviderPlatformID,
			ExternalUsername:   c.CanvasUser.ExternalUsername,
			ExternalUserID:     c.CanvasUser.ExternalUserID,
		}
		if err := srv.Db.CreateProviderUserMapping(&mapping); err != nil {
			failed = append(failed, c.CanvasUser.Username)
			continue
		}
		if provider.OidcID != 0 {
			user, err := srv.Db.GetUserByID(c.UnlockEdUserID)
			if err != nil {
				log.errorf("could not fetch user %d for provider login registration: %v", c.UnlockEdUserID, err)
			} else if err := srv.registerProviderLogin(provider, user); err != nil {
				log.errorf("error registering provider login for user %d: %v", c.UnlockEdUserID, err)
			}
		}
		applied++
	}

	created := 0
	for _, cu := range req.ToCreate {
		if strings.TrimSpace(cu.Username) == "" && strings.TrimSpace(cu.Email) == "" && strings.TrimSpace(cu.NameLast) == "" {
			continue
		}
		newUser := models.User{
			Username:  cu.Username,
			Email:     cu.Email,
			NameFirst: cu.NameFirst,
			NameLast:  cu.NameLast,
		}
		if err := srv.WithUserContext(r).CreateUser(&newUser); err != nil {
			failed = append(failed, cu.Username)
			continue
		}
		tempPw, err := newUser.CreateTempPassword()
		if err != nil {
			log.errorf("error creating temp password for %s: %v", cu.Username, err)
		}
		if err := srv.HandleCreateUserKratos(newUser.Username, tempPw); err != nil {
			log.errorf("error creating kratos user for %s: %v", cu.Username, err)
		}
		mapping := models.ProviderUserMapping{
			UserID:             newUser.ID,
			ProviderPlatformID: service.ProviderPlatformID,
			ExternalUsername:   cu.ExternalUsername,
			ExternalUserID:     cu.ExternalUserID,
		}
		if err := srv.Db.CreateProviderUserMapping(&mapping); err != nil {
			failed = append(failed, cu.Username)
			continue
		}
		if provider.OidcID != 0 {
			if err := srv.registerProviderLogin(provider, &newUser); err != nil {
				log.errorf("error registering provider login for %s: %v", cu.Username, err)
			}
		}
		created++
	}

	if failed == nil {
		failed = []string{}
	}
	return writeJsonResponse(w, http.StatusOK, ApplyMatchesResponse{
		Applied: applied,
		Created: created,
		Failed:  failed,
	})
}
```

- [ ] **Step 3: Build to verify both handlers compile**

```bash
cd backend && go build ./src/handlers/...
```

Expected: no output (success).

- [ ] **Step 4: Commit**

```bash
git add backend/src/handlers/user_matching.go backend/src/handlers/actions.go
git commit -m "feat: add match-users and apply-matches endpoints"
```

---

## Task 7: Frontend types

**Files:**
- Modify: `frontend/src/types/provider.ts`

- [ ] **Step 1: Add match types to `provider.ts`**

Add at the end of the file (after the `OidcClient` interface):

```typescript
export interface UserMatchResult {
    canvas_user: ProviderUser;
    suggested_user?: User;
    score: number;
}

export interface MatchUsersResponse {
    auto_confirmed: UserMatchResult[];
    ambiguous: UserMatchResult[];
    unmatched: ProviderUser[];
}

export interface ConfirmedMatch {
    canvas_user: ProviderUser;
    unlocked_user_id: number;
}

export interface ApplyMatchesRequest {
    confirmed: ConfirmedMatch[];
    to_create: ProviderUser[];
}

export interface ApplyMatchesResponse {
    applied: number;
    created: number;
    failed: string[];
}
```

Note: `User` is imported from `@/types/user` in `provider.ts`. Add the import at the top of `provider.ts` if not already there:

```typescript
import type { User } from './user';
```

- [ ] **Step 2: Re-export from the types barrel** — check `frontend/src/types/index.ts` (or wherever types are re-exported). Add the new types to that file if `MatchUsersResponse` etc. are not yet exported:

```typescript
export type {
  UserMatchResult,
  MatchUsersResponse,
  ConfirmedMatch,
  ApplyMatchesRequest,
  ApplyMatchesResponse,
} from './provider';
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/provider.ts frontend/src/types/index.ts
git commit -m "feat: add match user types to frontend"
```

---

## Task 8: Frontend state, auto-match button, and summary bar

**Files:**
- Modify: `frontend/src/Pages/admin/ProviderUserManagement.tsx`

- [ ] **Step 1: Add new imports at the top of the file**

Update the `@/types` import to include the new types:

```typescript
import {
    ProviderPlatform,
    ProviderPlatformType,
    ProviderUser,
    User,
    UserImports,
    ServerResponseMany,
    PaginationMeta,
    MatchUsersResponse,
    UserMatchResult,
    ConfirmedMatch,
    ApplyMatchesRequest,
    ApplyMatchesResponse,
} from '@/types';
```

- [ ] **Step 2: Add match state variables** inside `ProviderUserManagement()` after the existing state declarations (after line 45 `const [mapSubmitting, setMapSubmitting] = useState(false);`):

```typescript
const [matchState, setMatchState] = useState<MatchUsersResponse | null>(null);
const [matchLoading, setMatchLoading] = useState(false);
const [applySubmitting, setApplySubmitting] = useState(false);
const [removedConfirmed, setRemovedConfirmed] = useState<Set<string>>(new Set());
const [ambiguousSelections, setAmbiguousSelections] = useState<Record<string, number>>({});
const [unmatchedToCreate, setUnmatchedToCreate] = useState<Set<string>>(new Set());
```

- [ ] **Step 3: Add `handleAutoMatch` function** after `handleRefresh`:

```typescript
const handleAutoMatch = async () => {
    setMatchLoading(true);
    const res = await API.get<MatchUsersResponse>(
        `actions/provider-platforms/${providerId}/match-users`
    );
    setMatchLoading(false);
    if (res.success) {
        setMatchState(res.data as MatchUsersResponse);
        setRemovedConfirmed(new Set());
        setAmbiguousSelections({});
        setUnmatchedToCreate(new Set());
    } else {
        toast.error('Failed to load match results.');
    }
};
```

- [ ] **Step 4: Add `handleApplyMatches` function** after `handleAutoMatch`:

```typescript
const handleApplyMatches = async () => {
    if (!matchState) return;
    setApplySubmitting(true);

    const confirmed: ConfirmedMatch[] = [
        ...matchState.auto_confirmed
            .filter((r) => !removedConfirmed.has(r.canvas_user.external_user_id))
            .map((r) => ({
                canvas_user: r.canvas_user,
                unlocked_user_id: r.suggested_user!.id,
            })),
        ...matchState.ambiguous
            .filter((r) => ambiguousSelections[r.canvas_user.external_user_id] != null)
            .map((r) => ({
                canvas_user: r.canvas_user,
                unlocked_user_id: ambiguousSelections[r.canvas_user.external_user_id],
            })),
    ];

    const toCreate: ProviderUser[] = matchState.unmatched.filter((u) =>
        unmatchedToCreate.has(u.external_user_id)
    );

    const req: ApplyMatchesRequest = { confirmed, to_create: toCreate };

    const res = await API.post<ApplyMatchesResponse, ApplyMatchesRequest>(
        `actions/provider-platforms/${providerId}/apply-matches`,
        req
    );
    setApplySubmitting(false);

    if (res.success) {
        const data = res.data as ApplyMatchesResponse;
        if (data.failed.length > 0) {
            toast.error(`Some users failed: ${data.failed.join(', ')}`);
        } else {
            toast.success(`Applied ${data.applied} mappings, created ${data.created} users.`);
        }
        setMatchState(null);
        void mutate();
    } else {
        toast.error('Failed to apply matches.');
    }
};
```

- [ ] **Step 5: Add the "Auto-match" button** to the existing button row (inside the `<div className="flex gap-2">` that already has Refresh, Import All, Import Selected):

Replace the buttons `<div>`:
```tsx
<div className="flex gap-2 flex-wrap">
    <Button
        variant="outline"
        onClick={handleRefresh}
        className="text-foreground border-border"
    >
        <ArrowPathIcon className="size-4 mr-1" />
        Refresh
    </Button>
    <Button
        variant="outline"
        onClick={() => void handleAutoMatch()}
        disabled={matchLoading}
        className="text-foreground border-border"
    >
        {matchLoading ? 'Matching...' : 'Auto-match'}
    </Button>
    <Button
        variant="outline"
        onClick={() => setShowImportAllConfirm(true)}
        disabled={!provider}
        className="text-foreground border-border"
    >
        Import All Users
    </Button>
    <Button
        onClick={() => void handleImportSelected()}
        disabled={usersToImport.length === 0}
        className="bg-[#203622] text-white hover:bg-[#203622]/90"
    >
        Import Selected ({usersToImport.length})
    </Button>
</div>
```

- [ ] **Step 6: Add the summary bar** immediately after the buttons `<div>` and before the `<DataTable>`. Insert this block only when `matchState !== null`:

```tsx
{matchState && (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-800">
                ✓ Auto-matched:{' '}
                {matchState.auto_confirmed.length - removedConfirmed.size}
            </span>
            <span className="rounded-full bg-yellow-100 px-3 py-1 font-medium text-yellow-800">
                ~ Needs review: {matchState.ambiguous.length}
            </span>
            <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-800">
                ✗ Unmatched: {matchState.unmatched.length}
            </span>
        </div>
        <div className="flex gap-2">
            <Button
                variant="outline"
                onClick={() => setMatchState(null)}
                className="text-foreground border-border"
            >
                Cancel
            </Button>
            <Button
                onClick={() => void handleApplyMatches()}
                disabled={
                    applySubmitting ||
                    (matchState.auto_confirmed.length - removedConfirmed.size === 0 &&
                        Object.keys(ambiguousSelections).length === 0 &&
                        unmatchedToCreate.size === 0)
                }
                className="bg-[#203622] text-white hover:bg-[#203622]/90"
            >
                {applySubmitting ? 'Applying...' : 'Apply Matches'}
            </Button>
        </div>
    </div>
)}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/Pages/admin/ProviderUserManagement.tsx
git commit -m "feat: add auto-match button, state, and summary bar"
```

---

## Task 9: Frontend three-section review UI

**Files:**
- Modify: `frontend/src/Pages/admin/ProviderUserManagement.tsx`

- [ ] **Step 1: Replace the `<DataTable>` block with conditional rendering**

Find the `<DataTable ... />` JSX block and replace it with:

```tsx
{matchState ? (
    <div className="space-y-4">
        {/* Section A: Auto-confirmed */}
        <details className="rounded-lg border border-green-200 bg-green-50">
            <summary className="cursor-pointer px-4 py-3 font-medium text-green-800 text-sm select-none">
                ✓ Auto-confirmed ({matchState.auto_confirmed.length - removedConfirmed.size} matches)
                — click to review
            </summary>
            <div className="border-t border-green-200">
                {matchState.auto_confirmed.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No auto-confirmed matches.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-green-200 text-left text-xs text-green-700">
                                <th className="px-4 py-2">Canvas user</th>
                                <th className="px-4 py-2"></th>
                                <th className="px-4 py-2">UnlockEd user</th>
                                <th className="px-4 py-2 text-right">Score</th>
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {matchState.auto_confirmed.map((r) => {
                                const removed = removedConfirmed.has(r.canvas_user.external_user_id);
                                return (
                                    <tr
                                        key={r.canvas_user.external_user_id}
                                        className={`border-b border-green-100 last:border-b-0 ${removed ? 'opacity-40 line-through' : ''}`}
                                    >
                                        <td className="px-4 py-2 font-medium text-foreground">
                                            {r.canvas_user.name_first} {r.canvas_user.name_last}
                                        </td>
                                        <td className="px-4 py-2 text-muted-foreground">→</td>
                                        <td className="px-4 py-2 text-foreground">
                                            {r.suggested_user?.name_first} {r.suggested_user?.name_last}
                                        </td>
                                        <td className="px-4 py-2 text-right text-muted-foreground">
                                            {Math.round(r.score * 100)}%
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    setRemovedConfirmed((prev) => {
                                                        const next = new Set(prev);
                                                        if (next.has(r.canvas_user.external_user_id)) {
                                                            next.delete(r.canvas_user.external_user_id);
                                                        } else {
                                                            next.add(r.canvas_user.external_user_id);
                                                        }
                                                        return next;
                                                    })
                                                }
                                                className="text-xs text-muted-foreground hover:text-destructive"
                                            >
                                                {removed ? 'Undo' : '✕ Remove'}
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </details>

        {/* Section B: Needs review */}
        <div className="rounded-lg border border-yellow-200 bg-yellow-50">
            <div className="px-4 py-3 font-medium text-yellow-800 text-sm">
                ~ Needs review ({matchState.ambiguous.length})
            </div>
            <div className="border-t border-yellow-200">
                {matchState.ambiguous.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No ambiguous matches.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-yellow-200 text-left text-xs text-yellow-700">
                                <th className="px-4 py-2">Canvas user</th>
                                <th className="px-4 py-2">Suggested match</th>
                                <th className="px-4 py-2 text-right">Score</th>
                                <th className="px-4 py-2 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matchState.ambiguous.map((r) => {
                                const confirmed = ambiguousSelections[r.canvas_user.external_user_id] != null;
                                return (
                                    <tr
                                        key={r.canvas_user.external_user_id}
                                        className="border-b border-yellow-100 last:border-b-0"
                                    >
                                        <td className="px-4 py-2 font-medium text-foreground">
                                            {r.canvas_user.name_first} {r.canvas_user.name_last}
                                        </td>
                                        <td className="px-4 py-2 text-foreground">
                                            {r.suggested_user
                                                ? `${r.suggested_user.name_first} ${r.suggested_user.name_last}`
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-2 text-right text-muted-foreground">
                                            {Math.round(r.score * 100)}%
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <div className="flex justify-end gap-1">
                                                {r.suggested_user && (
                                                    <Button
                                                        size="sm"
                                                        variant={confirmed ? 'default' : 'outline'}
                                                        onClick={() =>
                                                            setAmbiguousSelections((prev) => {
                                                                if (confirmed) {
                                                                    const next = { ...prev };
                                                                    delete next[r.canvas_user.external_user_id];
                                                                    return next;
                                                                }
                                                                return {
                                                                    ...prev,
                                                                    [r.canvas_user.external_user_id]: r.suggested_user!.id,
                                                                };
                                                            })
                                                        }
                                                        className={confirmed ? 'bg-[#203622] text-white' : 'text-foreground border-border'}
                                                    >
                                                        {confirmed ? '✓ Confirmed' : 'Confirm'}
                                                    </Button>
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        setUserToMap(r.canvas_user);
                                                        setSelectedUserId(null);
                                                        setMapSearch('');
                                                        setShowMapModal(true);
                                                    }}
                                                    className="text-foreground border-border"
                                                >
                                                    Change
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>

        {/* Section C: Unmatched */}
        <div className="rounded-lg border border-red-200 bg-red-50">
            <div className="px-4 py-3 font-medium text-red-800 text-sm">
                ✗ Unmatched ({matchState.unmatched.length})
            </div>
            <div className="border-t border-red-200">
                {matchState.unmatched.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No unmatched users.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-red-200 text-left text-xs text-red-700">
                                <th className="px-4 py-2">Canvas user</th>
                                <th className="px-4 py-2">Username</th>
                                <th className="px-4 py-2 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matchState.unmatched.map((u) => {
                                const queued = unmatchedToCreate.has(u.external_user_id);
                                return (
                                    <tr
                                        key={u.external_user_id}
                                        className="border-b border-red-100 last:border-b-0"
                                    >
                                        <td className="px-4 py-2 font-medium text-foreground">
                                            {u.name_first} {u.name_last}
                                        </td>
                                        <td className="px-4 py-2 text-muted-foreground">
                                            {u.username}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    size="sm"
                                                    variant={queued ? 'default' : 'outline'}
                                                    onClick={() =>
                                                        setUnmatchedToCreate((prev) => {
                                                            const next = new Set(prev);
                                                            if (next.has(u.external_user_id)) {
                                                                next.delete(u.external_user_id);
                                                            } else {
                                                                next.add(u.external_user_id);
                                                            }
                                                            return next;
                                                        })
                                                    }
                                                    className={queued ? 'bg-[#203622] text-white' : 'text-foreground border-border'}
                                                >
                                                    {queued ? '✓ Will create' : 'Create user'}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setUserToMap(u);
                                                        setSelectedUserId(null);
                                                        setMapSearch('');
                                                        setShowMapModal(true);
                                                    }}
                                                    className="text-foreground border-border"
                                                >
                                                    Select user
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    </div>
) : (
    <DataTable
        columns={columns}
        data={providerUsers}
        keyExtractor={(user) => user.external_user_id}
        emptyMessage="No users found."
        page={meta.current_page}
        totalPages={meta.last_page}
        onPageChange={handlePageChange}
    />
)}
```

- [ ] **Step 2: Update `handleMapUser` to clear matchState after a successful map when in match mode**

In the existing `handleMapUser` function, add `setMatchState(null);` just before `void mutate();`:

```typescript
const handleMapUser = async () => {
    if (!userToMap || selectedUserId === null) return;
    setMapSubmitting(true);
    const res = await API.post(
        `provider-platforms/${providerId}/map-user/${selectedUserId}`,
        userToMap
    );
    setMapSubmitting(false);
    if (res.success) {
        toast.success('User mapped successfully.');
        setShowMapModal(false);
        setUserToMap(undefined);
        setSelectedUserId(null);
        setMapSearch('');
        setMatchState(null);   // ← add this line
        void mutate();
        void mutateUnmapped();
    } else {
        toast.error('Failed to map user.');
    }
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/Pages/admin/ProviderUserManagement.tsx
git commit -m "feat: add three-section auto-match review UI to provider user management"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `GET match-users` — Task 5
- ✅ `POST apply-matches` — Task 6
- ✅ Levenshtein scoring with 90/50 thresholds — Task 1
- ✅ `GetAllUnmappedUsers` (no pagination) — Task 3
- ✅ Auto-match button + summary bar — Task 8
- ✅ Section A collapsible, remove row — Task 9
- ✅ Section B confirm/change per row — Task 9
- ✅ Section C create/select per row — Task 9
- ✅ Apply fires bulk request — Task 8 (`handleApplyMatches`)
- ✅ Idempotent apply (skip existing mappings) — Task 6
- ✅ Partial failure: toast + refresh — Task 8
- ✅ Existing manual table restored when matchState null — Task 9
- ✅ Unit tests for matching logic — Task 2
- ✅ Integration test for DB function — Task 4

**Type consistency check:**
- `UserMatchResult.suggested_user` is `*models.User` (Go) / `User | undefined` (TS) — consistent ✅
- `ConfirmedMatch.unlocked_user_id` is `uint` (Go) / `number` (TS) — consistent ✅
- `ApplyMatchesResponse.failed` is `[]string` (Go) / `string[]` (TS) — consistent ✅
- Route paths in `actions.go` match API calls in frontend (`match-users`, `apply-matches`) — consistent ✅
