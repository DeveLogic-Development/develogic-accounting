# Deployment and Configuration Readiness

## Current posture
- The app is usable without full production configuration.
- Missing integrations degrade gracefully instead of crashing.
- Email sending is feature-gated by server capability checks.
- Persistence for several modules remains local adapter based until Supabase wiring is finalized.

## Required for local development
- `VITE_APP_BASE_URL`
- `VITE_FEATURE_EMAIL_ENABLED` (recommended)
- `EMAIL_TRANSPORT_MODE=mock` (recommended when SMTP is not set)

## Required for production-like email delivery
- `EMAIL_TRANSPORT_MODE=smtp`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_FROM_EMAIL`
- Optional but common:
  - `SMTP_USER`
  - `SMTP_PASS`
  - `SMTP_FROM_NAME`

If SMTP mode is selected without required values, email sending is disabled and surfaced in UI/server responses.

## Recommended for security hardening
- `APP_ALLOWED_ORIGINS`
- `ENFORCE_EMAIL_ORIGIN_CHECK=true`
- Add real authenticated session checks on server routes (required before public exposure).

## Required later for real Supabase integration
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_STORAGE_BUCKET`

Without these, app features continue in local fallback mode where applicable.

## Degraded-mode behavior summary
- Email:
  - If capabilities endpoint reports unavailable, send actions are disabled with clear reason.
  - If `EMAIL_TRANSPORT_MODE=mock`, sends succeed in mock mode for workflow testing.
- Storage/Persistence:
  - Uses local adapters where backend persistence is not yet configured.
- Reporting:
  - Aggregates from in-app state/repository data.

## Pre-production checklist
1. Set `EMAIL_TRANSPORT_MODE=smtp` and verify successful real send from quote/invoice detail.
2. Enable and verify origin restrictions for `/api/email/*`.
3. Configure Supabase env values and validate future RLS-backed integrations.
4. Confirm Vercel environment variables are set per environment (preview/prod).
5. Disable mock-only behaviors in production.
6. Add auth/authorization protection for sensitive server actions and align with Supabase auth/RLS.

## Known risk before production
- Server-side auth is not fully wired yet. Current hardening reduces abuse (origin checks, payload validation),
  but this is not a replacement for authenticated/authorized server actions.
