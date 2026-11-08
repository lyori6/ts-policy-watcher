# Security

How this project handles untrusted data, abuse and secrets. Update this file with every security change.

## Trust boundaries

- **AI summaries are untrusted.** Summaries are written by a model that reads third-party policy pages, so a page could steer it into writing HTML. The dashboard escapes all summary text before adding its own markdown tags (`escapeUntrustedHtml` in `dashboard/script.js`). This covers the daily cards, the policy modal and the weekly summary. Run errors from the watcher are escaped the same way. Never put summary or run-log text into `innerHTML` without escaping it.
- **The subscribe endpoint is public.** `dashboard/api/subscribe.js` emails the owner for each signup. It only accepts JSON, sends to a fixed recipient, escapes the address in the email, and logs status codes only (no submitted data).

## Abuse limits on /api/subscribe

In the function, per instance:

- 3 requests per IP per 10 minutes, then 429.
- The same address only triggers one email per 24 hours.
- At most 20 owner emails per hour.

These counters reset on a cold start and are not shared across instances, so they slow a flood rather than stop it. The hard limit should be a Vercel Firewall rule: **Vercel, ts-policy-watcher project, Firewall, Add rule: path equals `/api/subscribe`, rate limit 5 requests per 60 seconds per IP, action deny.** (Same pattern as the IPP Dental contact form.)

Tests: `node --test tests/security/subscribe.test.js`

## Response headers

`vercel.json` sends `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN` and `Content-Security-Policy: frame-ancestors 'self'` on every page, file and API response. Vercel adds HSTS itself. The dashboard is never framed by another site, so `SAMEORIGIN` breaks nothing. There is no script CSP yet: the dashboard uses GTM, GA and Clarity, and a CSP would need report-only testing first.

## Secrets

- `RESEND_API_KEY` and `RECIPIENT_EMAIL` live in Vercel environment variables and GitHub Actions secrets. Never commit them. Test scripts must read keys from the environment.
- An old Resend key was committed in `curl_email_test.sh` and `simple_email_test.py` (removed in `c2815c5`, still in history). It must be revoked in Resend. Removing the file is not enough.
- Turn on GitHub Secret Protection and Push protection for this repo (Settings, Advanced Security).

## CI

- Third-party actions are pinned to a commit SHA, not a branch. `ad-m/github-push-action` is pinned to v1.3.0 (`881a632`). To update, check the release, then replace the SHA.

## Changelog

- 2026-11-08: Basic security headers in `vercel.json` (nosniff, Referrer-Policy, no framing by other sites).

- 2026-11-07: Escape AI summary and run-error HTML in the dashboard. Add per-IP, per-address and hourly limits, a JSON-only check and status-only logging to `/api/subscribe`. Pin `ad-m/github-push-action` by SHA. Added this file.
