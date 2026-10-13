# Branch & Policy History Rollout Plan

**Owner:** Codex (with Lyor)
**Last Updated:** 2025-09-22
**Status:** ✅ Stage 6 validated (ready for Stage 7 planning)

---

## 1. Objectives
- Isolate automation commits onto a non-`main` branch without impacting production deployments.
- Enable environment-aware data loading so dev/previews consume draft data safely.
- Lay groundwork for in-app policy history by producing lightweight, diff-friendly artifacts.
- Maintain production uptime by testing each change in lower environments before promotion.

---

## 2. Guiding Principles
- **Incremental Delivery:** Ship one stage at a time, keep changes small, and verify before merging.
- **Two-Branch Safety:** `main` remains the production deployment source; `data-updates` (new) carries automation artifacts.
- **Continuous Verification:** After every stage run local smoke tests, a Puppeteer sanity script, and—when relevant—a manual Vercel preview review.
- **Fast Rollback:** Each stage includes a quick toggle/fallback path so production stability is never at risk.

---

## 3. Pre-Flight Checklist (Stage 0)
1. 📦 Ensure local repo is in sync with `origin/main`.
2. 🔐 Confirm GitHub token in workflows has `contents:write` scope (already true for existing automation).
3. 🧪 Verify local Node + Python environments: `node >= 18`, `python3 >= 3.11`.
4. 🗂️ Create draft branch `feature/branch-history-rollout` for implementation.
5. ✅ Dry-run automation locally (optional): `python3 scripts/fetch.py` with `DEBUG_FETCH=1` to ensure baseline functionality.

---

## 4. Stage-by-Stage Plan

### Stage 1 – Branch-Aware Dashboard (Dev Only)
**Status:** ✅ Completed (local + Puppeteer smoke test)
- **Changes**
  - Update `dashboard/script.js` so `DATA_BRANCH` defaults to `main` but overrides based on `detectBranch()` (e.g., Vercel preview → use `dev`, localhost → `dev`).
  - Ensure new branch value propagates to all fetch URLs (summaries, logs, platform data, etc.).
- **Verification**
  - Local: run `python3 -m http.server 3000` in `/dashboard`; confirm network tab hits `.../dev/...` endpoints.
  - Puppeteer sanity: add `scripts/puppeteer-smoke.js` (simple navigation + data assertions) and run against localhost.
  - Production: none (feature gated to non-`main` environments).
- **Fallback**
  - Revert `script.js` change or toggle branch override flag.

### Stage 2 – Dual-Target Workflow Push
**Status:** ✅ Completed (data-updates synced from main with forced push)
- **Changes**
  - Modify `.github/workflows/watch.yml` to push automation commits to _both_ `main` and new `data-updates` (sequenced: commit once, push twice, or use `git push origin HEAD:main HEAD:data-updates`).
  - Ensure branch exists (`git push origin main:data-updates`).
- **Verification**
  - Trigger workflow via `workflow_dispatch`.
  - Confirm two branches share the same commit SHA for automation runs.
  - Local `git fetch` and diff between branches to ensure no mutation.
- **Fallback**
  - Comment out extra push step.

### Stage 3 – Preview Builds on `data-updates`
**Status:** ✅ Completed (preview verified manually)
- **Changes**
  - In `dashboard/script.js`, extend branch detection so Vercel previews map to `data-updates` instead of `main` once Stage 2 proves stable.
  - Optional: expose query param override (e.g., `?dataBranch=foo`) for manual testing.
- **Verification**
  - Deploy preview from feature branch (via Vercel CLI or Git push).
  - Use Puppeteer script against preview URL to confirm data loads from `data-updates` and UI works.
  - Manual spot-check of Policy Explorer + analytics tab.
- **Fallback**
  - Toggle preview mapping back to `main`.

### Stage 4 – Workflow Cutover
- **Changes**
  - Remove `main` push from workflow; leave only `data-updates`.
  - Update any downstream jobs (e.g., summary commits) to reference `data-updates`.
- **Verification**
  - Trigger workflow manually; confirm `main` remains untouched.
  - Ensure `data-updates` receives commits and raw URLs serve latest data.
  - Run Puppeteer smoke on preview and production (read-only check).
- **Fallback**
  - Reintroduce `main` push step if needed.

### Stage 5 – Production Data Source Flip
- **Changes**
  - Update production dashboard configuration so `main` build reads from `data-updates` (e.g., small tweak in `script.js` default branch for production). Optionally keep `main` as fallback via environment flag.
  - Coordinate Vercel deployment.
- **Verification**
  - Immediately after deploy, load production and check:
    - Recent change appears (compare with `data-updates` commit).
    - No console errors/timeouts.
  - Puppeteer smoke against production to catch regressions quickly.
- **Fallback**
  - Toggle env flag to revert to `main` (no redeploy required if implemented via runtime check) or redeploy previous commit.

### Stage 6 – Lightweight History Artifacts (Pilot)
- **Changes**
  - Enhance `scripts/fetch.py` so, after cleaning HTML, it writes a companion `clean.txt` (or JSON) per policy version in `snapshots/<env>/<slug>/clean.txt`.
  - Gate new output behind env var `ENABLE_HISTORY_EXPORT`.
  - Extend workflow to set flag only when running on `data-updates` (initially off in production).
- **Verification**
  - Local: run fetch with flag, confirm new file appears and is small (<100 KB typical).
  - Workflow: trigger dispatch with flag on; ensure commit adds text file.
  - Puppeteer: optional check to ensure dashboard still reads existing artifacts.
- **Fallback**
  - Disable env flag; cleaning code is inert.

### Stage 7 – Policy History UI (Preview First)
- **Changes**
  - Extend the Stage 6 exporter so the history-only pass writes a capped manifest (`snapshots/history/<slug>/index.json`) and up to five `clean` snapshots per policy, committed to `data-updates` only.
  - Replace the current "View History" GitHub link inside Policy Explorer with an in-app modal: the button remains in-place, but now loads the manifest, shows human-friendly version labels, and fetches the selected `clean.txt` lazily.
  - Introduce a feature flag (default off in production) controlling the modal so dev/previews can exercise the flow before we promote it.
  - Auto-enable the modal for `dev` / `data-updates` branches; support manual override via `?historyModal=on|off` for smoke tests and future production flips.
- **Verification**
  - Local: run `DEVELOPMENT_MODE=1 ENABLE_HISTORY_EXPORT=1 HISTORY_EXPORT_ONLY=1 venv/bin/python scripts/fetch.py`, confirm `snapshots/development/history/...` contains ≤5 entries per slug and the modal renders them correctly.
  - Workflow: ensure the data-updates export pass commits only history/manifests when content changes and trims older entries.
  - Preview: deploy with the flag enabled, extend Puppeteer smoke to click "View History" and assert modal content; follow with manual QA/stakeholder review.
- **Fallback**
  - Disable the feature flag to restore the existing GitHub link; exporter remains gated by `ENABLE_HISTORY_EXPORT` so production stays unaffected.

---

## 5. Testing Strategy
- **Unit/Script Tests:**
  - Existing Python scripts (fetch/diff) run via GitHub Actions on every workflow change.
  - Add lightweight Jest/Lint checks for dashboard when modifying front-end logic.
- **Puppeteer MCP Smoke Test:**
  - Add `scripts/puppeteer-smoke.js`:
    1. Launch headless Chromium.
    2. Visit target URL (local, preview, prod).
    3. Wait for Policy Explorer cards to render.
    4. Assert at least one summary and run-log entry visible.
    5. Log status + screenshot for debugging.
  - Integrate into dev workflow (optional GitHub Action for PRs).
- **Manual QA Checklist:**
  - Policy Explorer loads platform tabs.
  - History modal opens and shows GitHub link (until Stage 7 replaces it).
  - Analytics tab renders run history table.
  - Weekly summaries show most recent run.

---

## 6. Monitoring & Observability
- Watch GitHub workflow logs after each stage.
- Track dashboard console errors using Vercel monitoring.
- Optionally log Puppeteer results to `run_log_dev.json` for meta monitoring.

---

## 7. Rollback Matrix
| Stage | Rollback Steps |
|-------|----------------|
| 1 | Revert branch override commit (front-end only). |
| 2 | Comment out extra push and delete `data-updates` branch if unused. |
| 3 | Reset preview mapping to `main`. |
| 4 | Re-enable `main` push in workflow. |
| 5 | Flip production branch flag back to `main` and redeploy. |
| 6 | Disable `ENABLE_HISTORY_EXPORT`; remove new artifacts. |
| 7 | Turn off feature flag or revert UI commit. |

---

## 8. Timeline (Indicative)
1. **Day 0:** Stage 1 PR + test.
2. **Day 1:** Stage 2 workflow update, manual trigger.
3. **Day 2:** Stage 3 preview validation with Puppeteer.
4. **Day 3:** Stage 4 cutover + monitoring.
5. **Day 4:** Stage 5 production update after stable run.
6. **Day 5+:** Stage 6 pilot, Stage 7 UI work.

Adjust pacing based on findings; do not advance to the next stage until verification checklist passes.

---

## 9. Next Actions
1. ✅ Implement Stage 1 in a feature branch.
2. ✅ Build Puppeteer smoke script (usable from Stage 1 onwards).
3. ✅ Update watcher workflow for dual pushes; trigger manual run and compare `main` vs `data-updates`.
4. ✅ Stage 6 validation: two-pass workflow proven; clean artifacts confirmed on `data-updates` only.
5. 🚧 Stage 8 rollout prep: monitor production deployment with history modal enabled, document initial checks, and define rollback/monitoring cadence.

---

## 10. Progress Log
- **2025-09-19:** Stage 1 complete — dashboard now branch-aware in dev/previews; Puppeteer smoke test added and validated locally.
- **2025-09-19:** Stage 2 underway — workflow patched to push automation commits to both `main` and `data-updates`; awaiting main-branch workflow run for parity confirmation.
- **2025-09-19:** Legacy `maintain-policy-changes-branch` workflow removed to eliminate cherry-pick conflicts; `watch.yml` now guards branch-specific pushes.
- **2025-09-19:** Stage 2 verified — main workflow run forced `data-updates` to latest snapshot; branches aligned for preview rollout.
- **2025-09-21:** Stage 3 completed — Vercel preview confirmed to load `data-updates` data (manual verification due to Puppeteer sandbox limits); production smoke manually validated.
- **2025-09-22:** Stage 6 artifact writer implemented behind `ENABLE_HISTORY_EXPORT`; local dry run verifies creation/update of `clean.txt` alongside snapshots without impacting production runs.
- **2025-09-21:** Stage 6 pilot run (local): executed `ENABLE_HISTORY_EXPORT=1 venv/bin/python scripts/fetch.py`.
  - Observations (sampled `snapshots/production/*/clean.txt`):
    - Twitch (`snapshots/production/twitch-community-guidelines/clean.txt`) ~86 KB; content includes navigation and long enforcement notes. Usable but a bit noisy; consider tightening `clean_html()` to strip header language and sidebar/nav blocks for Twitch.
    - YouTube (`snapshots/production/youtube-hiding-users/clean.txt`) is concise and readable but includes footer survey strings (e.g., "Do not share any personal info..."). Low-priority cleanup.
    - Meta (`snapshots/production/meta-community-guidelines/clean.txt`) contains a very large language switcher/menu and Transparency Center nav; significant noise at the top. We should add targeted filters for Meta’s language grid and nav.
    - Whatnot (`snapshots/production/whatnot-community-guidelines/clean.txt`) is dense text; largely readable with minimal chrome. Acceptable signal-to-noise.
    - TikTok (`snapshots/production/tiktok-community-guidelines/clean.txt`) is currently empty (0-length). Likely due to article body selector mismatch or heavy client rendering. Needs a TikTok-specific selector/path in `clean_html()` or fallback to full-page text when no `articleBody` is found.
  - Env routing note: since neither `DEVELOPMENT_MODE` nor `DEBUG_FETCH` was set, artifacts were written under `snapshots/production/`. `snapshots/development/` exists but is empty. For dev-only trials, run with `DEVELOPMENT_MODE=1` to target `snapshots/development/`.
  - Run results: 26 pages checked, 2 changes found, 0 failures. Clean artifacts were initialized/updated alongside snapshots.
  - Next: safe to wire `ENABLE_HISTORY_EXPORT=1` in workflow for `data-updates`-only path; keep it off for `main` runs. Suggested approach: duplicate the fetch step — one guarded with `if: ${{ env.WORKFLOW_BRANCH == 'main' }}` and no flag, and a second guarded `if: ${{ env.WORKFLOW_BRANCH == 'main' }}` for the `data-updates` push context with `env: ENABLE_HISTORY_EXPORT: '1'` — or set the env globally and use a branch check to export only on `data-updates`.
- **2025-09-22:** Stage 6 cleanup refinements — `clean_html()` now accepts the slug, trims Meta/Twitch nav chrome, filters YouTube survey text, and keeps TikTok outputs populated; added a `HISTORY_EXPORT_ONLY` pass so workflows can emit `clean.txt` from existing snapshots without a second run log entry.
- **2025-09-22:** `.github/workflows/watch.yml` updated for the two-pass rollout: main commit stays HTML-only, then a history-export-only pass stages `clean.*` and force-pushes to `data-updates`.
  - Validation (2025-09-22 workflow_dispatch #102):
    - origin/main tip → `7242bb9a2ef9d522f4cd3add64278418864a048b` (`CHORE: Update policy summaries and run log`) — HTML-only commit path.
    - origin/data-updates tip → `b64031d11da72dfa5e14ceeee944e794723641e5` (`CHORE: Export cleaned policy snapshots`) — `snapshots/**/clean.txt` only; force-push succeeded.
    - Spot-check sizes: Meta ≈ 6 KB, Twitch ≈ 84 KB, TikTok ≈ 9.6 KB (content trimmed as expected).
    - Outcome: Stage 6 complete; proceed to Stage 7 UI planning.
- **2025-09-22:** Stage 7 planning — agreed to replace the Policy Explorer GitHub link with a feature-flagged modal backed by capped history manifests (five versions per policy). Implementation tracked in `POLICY_HISTORY_IMPLEMENTATION_PLAN.md`.
- **2025-09-22:** Stage 7 exporter update — `run_history_export_only_mode` now writes `snapshots/<env>/history/<slug>/index.json` plus timestamped `clean` copies (max five per slug) and the workflow’s second pass stages the history directories alongside `clean.txt`.
- **2025-09-22:** Stage 7 UI foundation — Policy Explorer "View History" button now opens a feature-flagged modal (enabled on dev/data-updates) that reads `index.json` manifests, lists human-friendly versions, and renders cleaned text with GitHub fallback. Puppeteer smoke extended to exercise the modal when enabled.
  - Validation (main vs. data-updates):
    - origin/main tip: `7242bb9a2ef9d522f4cd3add64278418864a048b` — "CHORE: Update policy summaries and run log" (HTML-only path + summaries/log step). Matches first pass expectation.
    - origin/data-updates tip: `b64031d11da72dfa5e14ceeee944e794723641e5` — "CHORE: Export cleaned policy snapshots"; file list shows only `snapshots/**/clean.txt` additions.
    - Spot-checks (data-updates):
      - `snapshots/production/meta-community-guidelines/clean.txt` ≈ 6.0 KB — header/nav largely trimmed; content begins at policy rationale; residual long lines acceptable.
      - `snapshots/production/twitch-community-guidelines/clean.txt` ≈ 83.9 KB — long but readable; intro + enforcement sections preserved; nav chrome stripped.
      - `snapshots/production/tiktok-community-guidelines/clean.txt` ≈ 9.6 KB — populated with section TOC and headings; acceptable signal; may refine further in later pass.
    - Notes: First commit pushed to `main`; follow-up clean artifacts committed and force-pushed to `data-updates` only, as designed.
- **2025-09-22:** Stage 7 preview validation — Vercel preview `feature-stage7-history-modal` (`https://ts-policy-watcher-git-feature-stage7-hi-c72c87-lyori6s-projects.vercel.app/?historyModal=on&dataBranch=data-updates`) exercised locally; summary/history modals confirmed (including z-index fix). Updated Puppeteer smoke runs to completion (logs analytics/history warnings when data absent) and `smoke-local.png` captured. History manifests still missing for most slugs on `data-updates` until the Stage 7 exporter runs on `main`.
- **2025-09-22:** Stage 7 preview validation — Vercel preview `feature-stage7-history-modal` (`https://ts-policy-watcher-git-feature-stage7-hi-c72c87-lyori6s-projects.vercel.app/?historyModal=on&dataBranch=data-updates`) exercised locally; summary/history modals confirmed (including z-index fix). Updated Puppeteer smoke runs to completion (logs analytics/history warnings when data absent) and `smoke-local.png` captured.
- **2025-09-23:** History seeding complete — ran `T&S Policy Watcher v1` on `main` (run ID `workflow_dispatch #104`); `data-updates` commit `73d1210` now carries `snapshots/production/history/**` for all slugs (Node check: `Missing history manifests: []`).
- **2025-09-23:** Production validation — Puppeteer smoke against `https://ts-policy-watcher.vercel.app/?historyModal=on&dataBranch=data-updates` succeeded (warnings only when analytics/history tables are empty); screenshot saved as `smoke-prod.png`. Manual QA confirmed z-index fix and history entries across platforms.
