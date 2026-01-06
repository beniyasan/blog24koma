# Pending security concerns & implementation options

## Background

- Observed console error: `GET https://blog4koma.com/api/auth/me` is redirected to Cloudflare Access login on `https://beniya553.cloudflareaccess.com/...` and then blocked by the browser due to CORS (login page does not return `Access-Control-Allow-Origin`).
- Current Cloudflare Zero Trust / Access configuration (as of discussion):
  - Protected: `blog4koma.com/api/auth/login*`, `blog4koma.com/pricing`
  - Not protected: `blog4koma.com/api/auth/me`

This memo records security-related concerns and possible implementation paths. No changes are applied yet.

## Concerns (Low → Medium)

### 1) Missing `_headers` (Medium)

- `frontend/public/_headers` does not exist.
- Recommendation: add baseline security headers first (low breakage), and introduce CSP later with careful tuning.

Suggested baseline (example):

```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
```

Notes:

- CSP is powerful but can easily break SPA assets, third-party scripts, analytics, etc. Start with the headers above; add CSP after validating current script/style requirements.

### 2) `localStorage` usage (Low)

- `LanguageProvider.tsx`: language preference only.
- `useModelSettings.ts`: model settings only.
- No sensitive data is stored → acceptable.

### 3) JWT verification skipped in `getUserFromAccessHeaders` / `getUserFromJwt` (Low → Medium depending on Access coverage)

Code paths:

- `functions/api/_auth.ts`: `getUserFromAccessHeaders()` decodes JWT payload without signature verification.
- `functions/api/_usage.ts`: `getUserFromJwt()` also decodes `CF_Authorization` without signature verification.

This is only safe if the endpoint is reliably protected by Cloudflare Access (i.e., Cloudflare already verified the JWT before the request reaches the worker, and spoofed headers/cookies never get accepted).

Risk if endpoints are *not* protected by Access:

- A direct HTTP client can send a forged `Cookie: CF_Authorization=<fake-jwt>`.
- Because the payload is decoded without verifying the signature/audience/issuer, the worker may treat the request as authenticated (email can be attacker-controlled).
- Impact examples:
  - `functions/api/auth/me.ts`: may create DB users and/or disclose plan info for arbitrary emails.
  - `functions/api/generate-4koma.ts` / `functions/api/generate-movie-4koma.ts`: subscription mode relies on `getUserFromJwt()` for identity; forged tokens could enable impersonation/quota abuse if a target email is known.

Current state check:

- If `/api/auth/me` is not protected (to avoid the CORS redirect), then `getUserFromAccessHeaders()` should not be used as-is.

### 4) Debug fields returned to clients (Low)

Example:

- `functions/api/checkout.ts`: returns `{ error, debug }` for some config errors.

Recommendation:

- In production, avoid returning `debug` fields; log them server-side only, or gate behind a non-production env flag.

## Implementation options (decision pending)

### Option A — Keep endpoints protected by Access; adjust frontend to avoid CORS

Goal:

- Let Cloudflare Access remain the sole verifier of identity.

Approach:

- Protect `/api/auth/me` with Access again (and any other identity-dependent APIs).
- In the frontend, avoid calling protected endpoints with `fetch()` in an unauthenticated state (because Access redirects to a different origin).
  - Example strategies:
    - Don’t call `/api/auth/me` automatically on public pages; show “ログイン” and only check after returning from `/api/auth/login`.
    - Or use `fetch(..., { redirect: 'manual' })` and treat redirects as “not authenticated” (browser-specific behavior should be validated).

Pros:

- No custom JWT verification logic.

Cons:

- SPA experience can be tricky (redirect/CORS behavior).
- Requires careful Access app/policy design for API vs UI routes.

### Option B — Keep `/api/auth/me` unprotected; verify Access JWT inside the worker

Goal:

- `/api/auth/me` returns JSON `{ authenticated: false }` without triggering Access redirects.
- Still keep strong identity guarantees.

Approach:

- Use server-side verification (signature + audience + exp) with Access public certs (`https://<teamDomain>/cdn-cgi/access/certs`).
- Reuse existing verifier in `functions/api/_auth.ts` (`authenticateRequest()`) and introduce required env vars (example):
  - `CF_ACCESS_TEAM_DOMAIN=beniya553.cloudflareaccess.com`
  - `CF_ACCESS_AUDIENCE=<Access application audience/app id>`
- Update endpoints that use identity (`auth/me`, subscription mode in generate endpoints, etc.) to rely on verified claims, not raw decode.

Pros:

- No browser CORS issue from redirects.
- Clear API behavior for unauthenticated users.

Cons:

- Must manage verifier correctness and performance (key fetching/caching).

### Option C — Hybrid (recommended if the site is public)

- Keep `/api/auth/login*` protected (interactive login flow).
- Keep `/api/auth/me` unprotected to avoid redirect/CORS.
- BUT verify Access JWT in the worker for any endpoint that consumes identity (do not trust unverified cookies).

This decouples security from Access path coverage and prevents accidental regressions if Access rules change.

## Suggested next decisions

1) Operation model

- Public pages accessible without login (recommended for a public site), or
- Entire site requires login (simpler security model, but different UX).

2) Which endpoints must require identity

- Always identity-dependent: `/api/checkout`, `/api/portal`, `/api/subscription`, subscription modes of generation APIs.
- Auth status: `/api/auth/me`.

3) Choose auth strategy

- Option A (Access-only) vs Option B/C (worker verifies JWT).

---

Status: pending / on hold.
