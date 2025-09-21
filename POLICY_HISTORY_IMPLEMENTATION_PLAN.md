# Stage 7 – Policy History UI Implementation Plan

## 1. Objectives
- Surface prior policy versions directly in the dashboard without leaving the app.
- Keep automation lightweight: reuse cleaned text artifacts, store a small manifest per policy, and cap retained versions at five.
- Ship behind a feature flag so previews can exercise the flow before we enable it in production.

## 2. Scope & Constraints
- Retain **at most five** history entries per slug (latest first). Older files are pruned during the history export pass.
- Human-friendly labels only (no bare SHAs). Each entry should include: timestamp (ISO), relative time label, and source commit short SHA for debugging (hidden unless needed).
- All history assets live under `snapshots/history/<slug>/` on the `data-updates` branch; production (`main`) continues to track only the latest snapshots.
- No backend services. The dashboard fetches static JSON/txt via existing branch detection.
- Feature flag (`NEXT_PUBLIC_ENABLE_POLICY_HISTORY`, name TBD if conflict) defaults to `false` in production.

## 3. Delivery Plan
1. **Exporter Enhancements** *(✅ implemented)*
   - Update `scripts/fetch.py` history-only path to:
     - generate/update `index.json` with the newest entry when `clean.txt` changes
     - write the cleaned text to `YYYY-MM-DDTHHMMSSZ.txt` (or similar) per entry
     - enforce retention (remove oldest files + manifest records beyond five)
   - Ensure log output highlights when entries are added/trimmed.
   - Extend workflow second pass to add `snapshots/history/**` alongside `clean.txt` when changes occur.

2. **Dashboard Changes** *(🚧 in progress — modal scaffold + fetch wired; preview validation pending)*
   - Replace the existing Policy Explorer "View History" link with a button that opens a modal.
   - Modal behaviour:
     - On open, fetch manifest for the current slug (respecting `DATA_BRANCH`).
     - Render list of entries with friendly timestamp (e.g., `Sep 22, 2025 · 03:45 UTC`).
     - When a user selects an entry, fetch corresponding cleaned text and display it (scrollable text area). Optional link to GitHub diff for later iteration.
   - Hide the button behind the feature flag; fallback links to GitHub when disabled.

3. **Testing & Validation**
   - Extend Puppeteer smoke to:
     1. Navigate to a policy card (using a slug with history seeded in fixtures).
     2. Click "View History" (when flag enabled via env var).
     3. Assert the modal appears, shows ≥1 entry, and loads text once selected.
   - Add unit tests for:
     - Manifest pruning helper (pure Python)
     - Front-end history hook/component (mock fetch, ensure rendering + error states).
   - Manual QA checklist for preview deployment.

4. **Rollout Steps**
   - Land automation changes first; run exporter locally with dev env vars to generate sample history for testing.
   - Implement UI with flag defaulting to off; enable in preview deployments only.
   - After preview validation + stakeholder sign-off, plan Stage 8 (prod enablement) if required.

## 4. Risks & Mitigations
- **Repo bloat**: Mitigated by retention cap and text-only artifacts.
- **Modal fetch latency**: Use lazy loading; show skeleton/loader and handle missing history gracefully.
- **Workflow conflicts**: History pass only touches `data-updates`; ensure clean-only commit happens before manifest update to avoid races.

## 5. Open Questions / Follow-Ups
- Final name of the feature flag? (`NEXT_PUBLIC_ENABLE_POLICY_HISTORY` vs. `NEXT_PUBLIC_SHOW_POLICY_HISTORY`)
- Do we need diff view in the first release or is plain text sufficient? (Assumed plain text for MVP.)
- Should we expose a “View on GitHub” link per entry for debugging? (Can be added if stakeholders ask.)
