# Canvas–UnlockEd User Auto-Match

**Date:** 2026-05-26
**Status:** Approved

## Background

Admins currently map Canvas users to UnlockEd accounts one by one through a manual modal on the Provider User Management page. This is slow for large facilities. The goal is to automate the initial pairing using Levenshtein name similarity, surface the results in three confidence tiers, and let admins confirm or adjust before anything is written.

## Scope

- New backend: `GET match-users` endpoint (matching + bucketing)
- New backend: `POST apply-matches` endpoint (bulk write)
- Frontend: summary bar, auto-match button, three-section review UI on the existing map user page
- No changes to the existing manual map flow (it remains for edge cases)

## Confidence Thresholds

| Tier | Score | Behaviour |
|---|---|---|
| Auto-confirmed | ≥ 0.90 | Pre-approved, collapsed section, admin can remove individual pairs |
| Needs review | 0.50 – 0.89 | Expanded section, suggested match pre-selected, admin must confirm or skip |
| Unmatched | < 0.50 | Expanded section, admin selects an existing user or creates a new one |

Score formula: `1 - (levenshtein_distance / max(len_a, len_b))` on normalised full names (`name_first + " " + name_last`, lowercased, trimmed).

## Backend

### New file: `backend/src/handlers/user_matching.go`

Contains the Levenshtein implementation (~20 lines, no external dependency) and the two handler functions.

### `GET /api/actions/provider-platforms/{id}/match-users`

1. Fetch Canvas users via `service.GetUsers()` (same as existing `handleGetUsers`)
2. Fetch unmapped UnlockEd students via `db.GetUnmappedUsers(providerID, facilityID)`
3. For each Canvas user, find the best-scoring UnlockEd match across all unmapped users
4. Bucket results by score into `auto_confirmed`, `ambiguous`, `unmatched`
5. Return `MatchUsersResponse` (read-only, no side effects)

```go
type UserMatchResult struct {
    CanvasUser    models.ImportUser `json:"canvas_user"`
    SuggestedUser *models.User      `json:"suggested_user,omitempty"`
    Score         float64           `json:"score"`
}

type MatchUsersResponse struct {
    AutoConfirmed []UserMatchResult  `json:"auto_confirmed"`
    Ambiguous     []UserMatchResult  `json:"ambiguous"`
    Unmatched     []models.ImportUser `json:"unmatched"`
}
```

### `POST /api/actions/provider-platforms/{id}/apply-matches`

```go
type ApplyMatchesRequest struct {
    Confirmed []ConfirmedMatch   `json:"confirmed"`
    ToCreate  []models.ImportUser `json:"to_create"`
}

type ConfirmedMatch struct {
    CanvasUser      models.ImportUser `json:"canvas_user"`
    UnlockEdUserID  uint              `json:"unlocked_user_id"`
}
```

- `confirmed` → bulk-creates `ProviderUserMapping` rows (one per entry); skips silently if mapping already exists (idempotent)
- `to_create` → runs the same create-user + mapping flow as `handleImportUsers`
- Returns partial success: lists any failed Canvas usernames in the response body; successful mappings are committed regardless

Both endpoints are registered under `registerActionsRoutes()` with `adminFeatureRoute` + `models.ProviderAccess`.

## Frontend

### File: `frontend/src/Pages/admin/ProviderUserManagement.tsx`

**New state:**
```ts
type MatchState = {
    autoConfirmed: UserMatchResult[];
    ambiguous: UserMatchResult[];
    unmatched: ImportUser[];
} | null;
```
`matchState === null` → page shows the current table as today.  
`matchState !== null` → page shows the three-section review UI.

**"Auto-match" button** added to the page header (alongside existing Import buttons). On click:
- Calls `GET .../match-users`
- Sets `matchState` with the response
- Shows the summary bar

**Summary bar** (visible when `matchState !== null`):
```
[ ✓ Auto-matched: 18 ]  [ ~ Needs review: 4 ]  [ ✗ Unmatched: 3 ]     [Apply Matches]
```
- Green / yellow / red pill badges
- "Apply Matches" button disabled until at least one confirmed match exists

**Section A — Auto-confirmed** (collapsible, collapsed by default, green)
- Table: Canvas name | → | UnlockEd name | Score % | ✕ Remove
- Removing a row sends it back to the unmatched section

**Section B — Needs review** (expanded, yellow)
- Table: Canvas name | Suggested match dropdown | ✕ Skip
- Dropdown reuses the existing search-as-you-type from the map-user modal
- A row is only included in the apply payload if the admin has selected a match; skipped rows are excluded entirely

**Section C — Unmatched** (expanded, red)
- Table: Canvas name | [Select existing user] [Create user]
- "Select existing user" opens the existing map-user modal
- "Create user" immediately adds the Canvas user to `to_create` (shown as pending)

**Apply Matches** fires `POST .../apply-matches` with:
- All auto-confirmed pairs not removed by admin
- All ambiguous pairs where admin selected a match
- All unmatched users where admin clicked "Create user"

On success → clears `matchState`, refreshes the page (re-fetches Canvas users).  
On partial failure → toast listing failed usernames; page still refreshes.

## Data Flow

```
Admin clicks "Auto-match"
  → GET match-users
  → matchState set → three sections rendered

Admin reviews sections B and C
  → adjustments update local matchState only (no API calls)

Admin clicks "Apply Matches"
  → POST apply-matches
  → on success: matchState = null, page refresh
  → on partial error: toast + page refresh
```

## Error Handling

| Scenario | Behaviour |
|---|---|
| `match-users` network/server error | Toast error, `matchState` stays null, existing table unchanged |
| `apply-matches` partial failure | Toast lists failed usernames, successful mappings committed, page refreshes |
| Canvas user already mapped at apply time | Backend skips silently (idempotent check before insert) |
| Two UnlockEd users with equal score for same Canvas user | First alphabetically is suggested; second appears as a separate ambiguous row |
| Unmapped UnlockEd user list is very large | Section B dropdown uses search-as-you-type (existing pattern) |

## Out of Scope

- Email-based matching (names are the only signal)
- Persisting match results between sessions (results are ephemeral; re-running re-matches)
- Matching for non-Canvas providers (endpoints are provider-agnostic but UI is on the canvas/provider user management page)
