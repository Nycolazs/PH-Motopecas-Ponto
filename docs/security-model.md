# PH-Ponto Security Model

## Actors, assets, and boundaries

Actors include unauthenticated clients, employee A/B, admins, inactive users holding old tokens, a compromised renderer, a malicious local desktop user, deployment operators, and CI. Assets include credentials, sessions, attendance integrity, corrections, audit history, avatars, reports, configuration secrets, and installer artifacts.

Trust boundaries are renderer↔preload/main, desktop↔API, API↔PostgreSQL, API↔avatar storage, operator↔containers, and CI↔release artifacts. UUID opacity and hidden UI are never authorization controls.

## Authorization matrix

| Resource/action                               | Employee                    | Admin                                         |
| --------------------------------------------- | --------------------------- | --------------------------------------------- |
| Own profile/avatar read                       | Own only                    | Any authorized user                           |
| Employee create/edit/activate/password/avatar | Forbidden                   | Allowed; audited                              |
| Punch creation                                | Own identity derived by API | Use explicit audited insertion endpoint       |
| Punch/history/report read                     | Own rows only               | Authorized scope, database-filtered           |
| Punch correction/insertion                    | Forbidden                   | Allowed with reason/provenance; audited       |
| Admin management                              | Forbidden                   | Allowed; last-active-admin invariant; audited |
| Schedules/exceptions/settings mutation        | Forbidden                   | Allowed; versioned and audited                |
| Audit read                                    | Forbidden                   | Allowed with bounded filters                  |
| Audit mutation                                | Forbidden                   | Forbidden through normal APIs                 |

Every service query includes the authorized subject/scope predicate. Guards alone are insufficient for object-level authorization.

## Authentication lifecycle

- Access JWTs use one configured asymmetric or high-entropy symmetric algorithm only, with validated issuer, audience, subject, role, session ID, issued-at, and short expiry; reject algorithm confusion and excessive clock skew.
- Every protected request resolves the current user/session and active state so deactivation, role change, password/admin reset, or session revocation takes effect without waiting for access expiry.
- Refresh values are high-entropy opaque secrets. PostgreSQL stores a keyed hash, family, absolute/idle expiry, and rotation metadata. Rotation is atomic; concurrent use has one winner, and confirmed reuse revokes the family.
- Logout revokes the session. Password reset, deactivation, and role change revoke all user sessions. Session limits and expiry are bounded configuration.
- Login returns one enumeration-safe pt-BR error for invalid/inactive credentials. Rate limits combine normalized login and trusted client IP. Proxy headers are trusted only from configured proxy hops.
- Argon2id parameters are benchmarked for deployment, pinned, and rehashed on successful login when policy advances.
- Initial admin bootstrap consumes validated environment credentials only when no admin exists; it never ships default credentials and is no-op/fails safely afterward.

## Electron contract

Raw refresh credentials remain in main and never cross to the renderer. Electron `safeStorage` encrypts the rotating credential with the operating system's protected storage, and main writes only the ciphertext to a fixed private file under `userData`. Linux `basic_text` is rejected as insecure. If protected encryption or the private write is unavailable, PH-Ponto uses a clearly communicated memory-only session rather than writing plaintext. Main performs login, single-flight refresh, and logout; failed refresh clears the local credential fail-closed. Access tokens remain renderer memory only.

The packaged renderer is served only from the registered privileged standard/secure scheme `ph-ponto://app`. Development uses the exact configured Vite origin (`http://localhost:5173` by default). Preload currently exposes app information plus four purpose-specific auth methods; future avatar capture must add only equally narrow methods. Main validates schema, sender webContents ID, top frame, and the environment's exact application origin. `Origin: null` is never allowlisted. Deny all permissions by default; Phase 5 webcam work may allow the camera only for the exact app origin during an explicit capture flow. Disallow webviews. Deny unexpected navigation/windows, parse external URLs and allow only configured HTTPS origins, keep `webSecurity` enabled, and fail closed on certificate errors.

Production CSP avoids `unsafe-eval` and `unsafe-inline`, restricts scripts/styles/images/connect targets to the packaged app and allowlisted HTTPS API, and blocks objects/frames/base-uri. Tests exercise forged IPC, child frames, dangerous schemes, deceptive hosts/user-info, window creation, permissions, and token leakage.

## Uploads

Accept JPEG, PNG, and WebP after magic-byte detection and successful decode. Enforce encoded byte, pixel, dimension, and decompression limits; strip metadata and re-encode to a canonical safe format. Use generated keys under a fixed non-executable storage root, atomic writes, containment/symlink checks, protected authorization-aware reads, `nosniff`, and rollback/orphan cleanup for replace/remove operations.

Negative tests cover MIME/extension mismatch, polyglots, truncation, huge dimensions, decompression abuse, path separators, symlinks, unauthorized reads, and storage failure rollback.

## Reports and exports

Authorize every database row, bound periods/row counts, paginate or stream, apply timeouts/concurrency limits, use safe filenames, and clean temporary artifacts. Neutralize CSV cells beginning with `=`, `+`, `-`, or `@` while preserving correct UTF-8 and quoting. Escape PDF template data and forbid arbitrary HTTP/file resource loading; the approved bundled logo is the only brand asset input.

## Operations and release gates

Production requires TLS termination, explicit CORS origins, security headers, protected/disabled Swagger, trusted-proxy configuration, non-public PostgreSQL, least-privilege database/container users, high-entropy rotated secrets, and non-leaking health/errors. Bearer headers avoid ambient-cookie CSRF but do not reduce XSS/origin requirements.

CI uses a frozen lockfile, dependency and secret scanning, blank/upgrade migration tests, backup/restore rehearsal, and artifact hashes. Windows packaging includes install/login/offline/uninstall smoke tests. Signing status is explicit; an unsigned build is never described as signed. Release is blocked by any open Critical/High finding or skipped mandatory gate; accepted lower risks require owner, rationale, and expiry.
