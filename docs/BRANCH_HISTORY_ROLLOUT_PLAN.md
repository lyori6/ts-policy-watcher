# Branch & Policy History Rollout Plan

**Owner:** Codex (with Lyor)
**Last Updated:** 2025-09-19
**Status:** In Progress (Stage 2)

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
**Status:** 🚧 In Progress (branch-aware workflow awaiting main validation)
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
  - Introduce new modal/tab that consumes cleaned artifacts (starting with timeline list, diff later).
  - Only enable UI in dev/previews until validated.
- **Verification**
  - Puppeteer script extended to validate new modal opens and data renders.
  - Manual QA + stakeholder review.
- **Fallback**
  - Feature flag UI off for production.

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
3. 🚧 Update watcher workflow for dual pushes; trigger manual run and compare `main` vs `data-updates` (pending).
4. Share plan for sign-off, then proceed sequentially.

---

## 10. Progress Log
- **2025-09-19:** Stage 1 complete — dashboard now branch-aware in dev/previews; Puppeteer smoke test added and validated locally.
- **2025-09-19:** Stage 2 underway — workflow patched to push automation commits to both `main` and `data-updates`; awaiting main-branch workflow run for parity confirmation.
- **2025-09-19:** Legacy `maintain-policy-changes-branch` workflow removed to eliminate cherry-pick conflicts; `watch.yml` now guards branch-specific pushes.
