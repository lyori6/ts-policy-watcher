### **PRD: Trust & Safety Policy Watcher**

*   **Project:** T&S Policy Watcher
*   **Version:** 1.1 (Intelligence Dashboard & Robust Monitoring)
*   **Author/Owner:** You (PM) & Cascade (Tech)
*   **Status:** In Development

---

### **1. Overview & Vision**

#### **1.1. The Problem**
The live shopping landscape is fiercely competitive and constantly evolving. Platforms like Whatnot, TikTok, and YouTube frequently update their Trust & Safety policies, creating a significant strategic intelligence gap. A manual review process is inefficient, prone to error, and puts our team in a constant reactive state. Furthermore, any automated system built to solve this must be transparently reliable; a silent failure is as bad as no system at all.

#### **1.2. The Solution**
To address this, we are building a zero-maintenance, automated intelligence pipeline. This system will:
1.  **Monitor** a curated list of competitor policy pages on a regular schedule.
2.  **Detect** substantive changes, ignoring cosmetic or minor edits.
3.  **Summarize** the impact of these changes using AI.
4.  **Report** its findings and its own operational health to a central dashboard.

The end goal is to transform raw, unstructured competitor changes into actionable, at-a-glance intelligence, freeing up the team to focus on strategic work.

---

### **2. Core Features & Requirements**

#### **2.1. User Stories (P0 - Must Haves)**
*   **As a Product Manager, I want to** automatically track a list of competitor policy pages **so that** I don't have to check them manually.
*   **As a Product Manager, I want to** receive an email alert with an AI-generated summary when a policy changes **so that** I can quickly understand the impact.
*   **As a Product Manager, I want to** view a simple dashboard with the latest version of all tracked policies **so that** I have a single source of truth.
*   **As a Product Manager, I want to** see a log of when the tracker last ran and if there were any errors **so that** I can trust the data is current.
*   **As the System Maintainer, I want to** receive a trackable, de-duplicated alert when a specific part of the system fails repeatedly **so that** I can debug the issue without flooding my inbox.

#### **2.2. Success Metrics**
*   **Timeliness:** A notification is sent within 8 hours of a policy change.
*   **Signal-to-Noise Ratio:** >80% of change notifications are for substantive content updates.
*   **Reliability:** The system achieves >95% uptime on its scheduled runs.
*   **Error Transparency:** 100% of critical failures (e.g., inability to fetch a URL after retries) are logged to the dashboard and trigger an automated, trackable alert to the maintainer.

---

### **3. System Design & Architecture**

#### **3.1. System Flow Diagram**

The system is orchestrated by a GitHub Actions workflow that runs on a schedule. It follows two primary paths: a success path for processing data and a failure path for reporting errors.

```
+------------------+     +--------------------+     +---------------------+
| GitHub Actions   | --> | scripts/fetch.py   | --> | snapshots/ (Git)    |
| (Scheduler)      |     | (httpx/Playwright) |     | (Raw HTML Storage)  |
+------------------+     +---------+----------+     +---------------------+
                                   |
              (On Failure) ------> | <------ (On Success)
                                   |
+--------------------------+       |         +-------------------------+
| (Future: Error Handling) |       |         | scripts/diff_and_notify.py |
| (Creates GitHub Issue)   |       |         | (Python + Gemini API)   |
+--------------------------+       |         +------------+------------+
                                   |                      |
                                   v                      v
                         +------------------+     +------------------+
                         | run_log.json     |     | summaries.json   |
                         | (Health Status)  |     | (AI Summaries)   |
                         +------------------+     +------------------+
```

#### **3.2. Data Models**

1.  **`run_log.json`**: A rolling log of the last ~20 system runs. Powers the "System Health" view.
    *   `timestamp_utc`: ISO 8601 timestamp of when the run was initiated.
    *   `status`: The final status of the run (`success`, `partial_failure`).
    *   `pages_checked`: The number of URLs the system attempted to fetch.
    *   `changes_found`: The number of pages that had substantive changes.
    *   `errors`: An array of objects, each detailing a specific fetch failure.

2.  **`summaries.json`**: The persistent database of all AI-generated content, keyed by a unique slug for each policy.
    *   `platform`: The name of the competitor platform (e.g., "Whatnot").
    *   `name`: The human-readable name of the policy.
    *   `url`: The direct URL to the policy page.
    *   `initial_summary`: A comprehensive AI summary generated the first time a policy is seen.
    *   `last_update_summary`: A concise AI summary of the most recent change.
    *   `last_update_timestamp_utc`: The timestamp of the last detected change.

#### **3.3. Error Handling & Monitoring**

Our strategy is to use **GitHub Issues** as a de-duplicated, stateful alerting system for infrastructure problems.

*   **Trigger:** A critical error is defined as `fetch.py` being unable to retrieve a URL after multiple retries.
*   **De-duplication:** Before creating an alert, a script will check for an existing *open* issue with a standardized title (e.g., `[Auto-Alert] Fetch Failure: TikTok Prohibited Products`). This prevents alert fatigue for known, ongoing issues.
*   **Dashboard Integration:** The `run_log.json` will capture all errors from a run. The dashboard will read this log and prominently display the system's status. If the last run had errors, it will be flagged and the details will be listed.

---

### **4. The Intelligence Dashboard**

The dashboard is the primary user-facing component, built as a simple, static website hosted on Vercel.

#### **4.1. System Health View**
*   **Goal:** Provide an at-a-glance view of the system's operational status.
*   **Data Source:** `run_log.json`.
*   **Display:**
    *   A prominent status indicator for the last run (e.g., "✅ Success," "⚠️ Partial Failure").
    *   Timestamp of the last successful run.
    *   A list of any errors from the most recent run, including the failed URL and reason.

#### **4.2. Policy Explorer View**
*   **Goal:** Allow the team to explore and understand the full content of all tracked policies.
*   **Data Sources:** `snapshots/` directory and `summaries.json`.
*   **Display:**
    *   Policies grouped by platform (e.g., Whatnot, TikTok).
    *   For each policy, display its name, the `initial_summary`, the `last_update_summary`, and the date of the last update.
    *   A link to view the raw HTML of the latest snapshot stored in the repository.