# History Deployment Playbook

## 1. Current Situation
- `scripts/fetch.py` now bootstraps history artifacts from `origin/data-updates` before writing new entries, preventing manifests from collapsing.
- Local and remote manifests for `twitch-community-guidelines` both show three entries after the mainline workflow run on 2025-10-05 (UTC).
- Other slugs currently show a single entry because only one production snapshot exists for them; they will accumulate history as future runs detect changes.
- GitHub Action **T&S Policy Watcher v1** only pushes artifacts when `WORKFLOW_BRANCH == 'main'`, so manual runs on other branches do **not** publish history files.
- The dashboard (`dashboard/script.js`) fetches history manifests from raw GitHub and caches them per slug; stale remote data results in single-entry modals even if remote manifests have already updated.
- Twitch history exports currently include footer-heavy content; future cleanup may be needed but does not block deployment.

## 2. Open Issues
1. **Workflow gating** – Non-main workflow runs skip push steps due to branch condition; continue running the workflow on `main` for promotions.
2. **UI validation** – Confirm frontend renders all entries whenever remote data updates (smoke tested for Twitch; spot-check others after they accrue history).
3. **Twitch content cleanup** – Reduce footer/noise in exported snapshots to improve diff readability.

## 3. Immediate Action Plan
1. **Stabilize Branches**
   - `git checkout history-verification`
   - Ensure only expected artifacts are present (`git status -sb`). Remove stray screenshots if unnecessary.
   - `git checkout main`
   - `git merge history-verification`
   - Resolve conflicts (if any), then `git push origin main`.

2. **Publish Artifacts via Workflow**
   - GitHub → Actions → **T&S Policy Watcher v1** → *Run workflow* → select `main`.
   - Wait for completion; inspect logs for `HISTORY EXPORT: Bootstrapped ...` and `Added entry ...` lines.
   - Confirm `data-updates` manifests reference the latest commit (`97b9f68` or newer) for slugs with changes.

3. **Verify Remote Data**
   - Run in browser DevTools or terminal:
     ```js
     fetch('https://raw.githubusercontent.com/lyori6/ts-policy-watcher/data-updates/snapshots/production/history/twitch-community-guidelines/index.json', { cache: 'no-store' })
       .then(r => r.json())
       .then(console.log);
     ```
   - Expect ≥2 entries with newest-first ordering.

4. **UI Smoke Test**
   - `cd dashboard && python3 -m http.server 3000`
   - Visit `http://localhost:3000?dataBranch=data-updates&historyModal=1`
   - Open a policy with known history (e.g., `twitch-community-guidelines`); `document.querySelectorAll('.history-entry-button').length` should match the manifest count.
   - Spot-check another slug once it gains ≥2 entries to ensure the modal scales.
   - Stop server (`Ctrl+C`).

5. **Cleanup & Prep for Deploy**
   - If history looks good, delete temporary branch: `git branch -d history-verification` (after merge).
   - Optional: open a follow-up ticket to improve Twitch clean-up selectors.
   - Monitor the next scheduled workflow run to confirm persistence.

## 4. Contingency Steps
- If workflow fails to push:
  - Check logs for git push errors; rerun with branch protection temporarily disabled if needed.
  - Manually push artifacts as a hotfix (`git push origin main:data-updates`) after verifying.
- If dashboard still shows one entry despite updated manifests:
  - Hard-refresh (clear cache) and confirm DevTools fetch matches expectations.
  - Check console for errors in `renderHistoryList` or `handleHistoryEntrySelection`.

## 5. Long-Term Follow-ups
- Enhance `clean_html()` to strip Twitch footer/nav noise for better diff readability.
- Add automated test or smoke check that validates manifest length ≥ expected threshold post-run.
- Document history export workflow in `BRANCH_HISTORY_ROLLOUT_PLAN.md` to keep future changes aligned.

