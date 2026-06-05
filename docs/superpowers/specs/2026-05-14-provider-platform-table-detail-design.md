# Provider Platform Table + Detail Page Design

**Date:** 2026-05-14
**Status:** Approved

## Overview

Convert the `ProviderPlatformManagement` page from a card list to a `DataTable`, and add a new `ProviderPlatformDetail` page that hosts all management actions for a single provider. Row clicks navigate to the detail page.

---

## Section 1: List Page (`ProviderPlatformManagement`)

**File:** `frontend-v2/src/pages/admin/ProviderPlatformManagement.tsx`

### Changes
- Remove `ProviderCard` component and the card grid entirely.
- Replace with `DataTable<ProviderPlatform>` (existing shared component at `src/components/shared/DataTable.tsx`).

### Table Columns
| Key | Header | Content |
|-----|--------|---------|
| `name` | Name | Globe icon + platform name (mirrors current card style) |
| `type` | Type | Human-readable label via `providerTypeLabels` |
| `state` | Status | Inline badge using existing `providerStateStyles` |
| `base_url` | Base URL | Plain text |

### Behavior
- `onRowClick`: calls `useNavigate` → `/learning-platforms/:id`
- `AddProviderModal` stays on this page (adding is a list-level action)
- All other modals (Edit, OIDC, Archive confirm) are removed from this file

### Retained
- `PageHeader` with "Add Learning Platform" button
- `EmptyState` for zero providers
- `useSWR` for `/api/provider-platforms`
- Auth/feature guard (`hasFeature` check)

---

## Section 2: Detail Page (`ProviderPlatformDetail`)

**File:** `frontend-v2/src/pages/admin/ProviderPlatformDetail.tsx` *(new)*

### Data Fetching
- `useParams<{ id: string }>()` to extract provider ID
- `useSWR('/api/provider-platforms/:id')` for platform data
- `useSWR('/api/oidc/clients/:oidc_id')` conditionally when `oidc_id > 0`

### Layout

**PageHeader**
- Title: provider name
- Subtitle: back link/text to "Learning Platforms" (`/learning-platforms`)
- Actions: `DropdownMenu` with items:
  - Edit (opens `EditProviderModal`)
  - Refresh Token (calls existing `handleRefreshToken` logic)
  - Register OIDC Client (only when `oidc_id` is 0 — opens `RegisterOidcModal`)
  - Archive / Enable (opens `ConfirmDialog`)
- Separate "Manage Users" `Button` linking to `/provider-users/:id`

**Platform Info Card**
- `bg-card rounded-lg border border-border` container
- Label/value rows for: Type, Status (badge), Base URL, Account ID
- Same field display pattern as `OidcInfoModal`'s field list

**OIDC Section**
- If `oidc_id > 0`: card showing Authorization Info fields (Client ID, Client Secret, Auth URL, Token URL, Scopes) fetched from `oidc/clients/:oidc_id`
- If `oidc_id === 0`: empty-state-style prompt with "Register OIDC Client" button

**Modals (moved verbatim from list page)**
- `EditProviderModal`
- `RegisterOidcModal`
- `OidcInfoModal`
- `ConfirmDialog` (archive/enable)

All modal handler logic (`handleArchiveToggle`, `handleRefreshToken`, `handleShowAuthInfo`) moves here unchanged.

---

## Section 3: Routing

**File:** `frontend-v2/src/routes/provider-routes.tsx`

Add to `deptAdminRoutes`:

```ts
{
    path: 'learning-platforms/:id',
    element: <ProviderPlatformDetail />,
    errorElement: <Error />,
    handle: { title: 'Learning Platform' }
}
```

The existing `learning-platforms` (list) route is unchanged. No other route files are modified.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/admin/ProviderPlatformManagement.tsx` | Remove cards, add DataTable, remove modals except Add |
| `src/pages/admin/ProviderPlatformDetail.tsx` | New file — detail page |
| `src/routes/provider-routes.tsx` | Add `learning-platforms/:id` route |

## Files Unchanged

- `src/components/shared/DataTable.tsx` — used as-is
- `src/types/provider.ts` — no type changes needed
- All modal sub-components reused verbatim
