Excellent. This is exactly the kind of critical thinking a co-founder should bring. A system is only as good as its ability to report when it's broken. Adding robust error handling and monitoring is not scope creep; it's essential for a reliable MVP.

Let's integrate this directly into the PRD. I'll highlight the new additions and revisions.

***

### **PRD/TDD: Trust & Safety Policy Watcher (v1.1)**

*   **Project:** T&S Policy Watcher
*   **Version:** 1.1 (Revised MVP with Error Handling)
*   **Author/Owner:** You (PM) & Gemini (Tech)
*   **Stakeholders:** The T&S Team
*   **Status:** Approved for Scrappy Build

---

### **1. Product Mindset: The "What & Why"**

#### **1.1. Problem Statement**
The live shopping landscape is fiercely competitive. Platforms like Whatnot, TikTok, and YouTube constantly evolve their Trust & Safety rules. Lacking immediate insight into these changes puts us in a reactive position. Furthermore, any system we build to monitor these changes must be reliable; we need to know instantly if the system itself is failing, otherwise we are flying blind. We need a way to proactively monitor competitors and trust that our monitoring system is operational.

#### **1.2. Goals & Success Metrics**
*   **Goal:** Create a zero-maintenance, automated system that provides timely intelligence on competitor T&S policy changes and transparently reports its own operational health.
*   **Success Metrics (MVP):**
    *   **Timeliness:** A notification is sent within 8 hours of a policy change.
    *   **Signal-to-Noise Ratio:** >80% of *content* notifications are for substantive changes.
    *   **Reliability:** The system achieves >95% uptime on its scheduled runs.
    *   **NEW - Error Transparency:** 100% of critical failures (e.g., inability to fetch a URL after retries) are logged to the dashboard and trigger an automated, trackable alert to the maintainer.

#### **1.3. User Stories (P0 - Must Haves)**
*   **As a Product Manager, I want to** automatically track a list of competitor policy pages **so that** I don't have to check them manually.
*   **As a Product Manager, I want to** receive an email alert with an AI-generated summary when a policy changes **so that** I can quickly understand the impact.
*   **As a Product Manager, I want to** view a simple dashboard with the latest version of all tracked policies **so that** I have a single source of truth.
*   **As a Product Manager, I want to** see a log of when the tracker last ran and if there were any errors **so that** I can trust the data is current.
*   **NEW - As the System Maintainer, I want to** receive a trackable, non-email alert when a specific part of the system fails repeatedly **so that** I can debug the issue without flooding my inbox.

#### **1.4. Scope & Phasing**
*(No changes from v1.0, as this is considered core to a reliable MVP)*

---

### **2. Technical Mindset: The "How"**

#### **2.1. System Architecture & Flow (Revised)**

The core flow remains the same, but we're adding a dedicated error path.

```
+------------------+     +--------------------+     +---------------------+
| GitHub Actions   | --> | fetch.py (Python)  | --> | Git Repo (Storage)  |
| (Scheduler)      |     | (httpx/Playwright) |     +---------------------+
+------------------+     +---------+----------+
                                   |
              (On Failure) ------> | <------ (On Success)
                                   |
+--------------------------+       |         +-------------------------+
| create_github_issue.py   |       |         | diff_and_notify.py      |
| (De-duplicated Alerts)   |       |         | (Python + Gemini)       |
+--------------------------+       |         +------------+------------+
                                   |                      |
                                   v                      v
                             +--------------------------------+
                             | run_log.json                   |
                             | (Append Status: success/failure)|
                             +--------------------------------+
```

#### **2.2. Data Models (Revised)**

1.  **`platform_urls.json`**: No changes.

2.  **`run_log.json`**: The log object is enhanced to include a dedicated errors array.
    ```json
    [
      {
        "timestamp_utc": "2025-07-18T12:00:00Z",
        "status": "partial_failure",
        "pages_checked": 12,
        "changes_found": 1,
        "errors": [
          {
            "url": "https://seller-us.tiktok.com/university/rule-detail/10003057",
            "reason": "HTTP 503 Server Error after 2 retries"
          }
        ]
      },
      {
        "timestamp_utc": "2025-07-18T06:00:00Z",
        "status": "success",
        "pages_checked": 12,
        "changes_found": 0,
        "errors": []
      }
    ]
    ```

#### **2.3. Core Logic Flow (Revised)**

*   **`fetch.py`**:
    *   The logic is updated to handle failures more gracefully. If a URL fails to fetch after retries, it will log the failure details (URL, error code) to a temporary file.
    *   The script will *not* stop on a single failure; it will attempt to fetch all other URLs.
    *   The GitHub Action step will check if this temporary failure file exists. If so, it will trigger the error handling script.

#### **2.4. Risks & Mitigations**
*(No changes from v1.0)*

#### **NEW - 2.5. Error Handling & Monitoring**

This is our strategy for tracking system health without creating noise.

*   **Tracking Mechanism:** We will use **GitHub Issues** as our primary error tracking system. This is superior to email for several reasons: it avoids inbox clutter, creates a stateful record of a problem, allows for comments/discussion, and can be formally "closed" when resolved.

*   **Workflow:**
    1.  **Trigger:** An error is triggered if `fetch.py` fails to retrieve a URL after 2 retries.
    2.  **De-duplication:** A dedicated script (`create_github_issue.py`) will be called.
        *   It will formulate a standardized issue title (e.g., `[Auto-Alert] Fetch Failure: TikTok Prohibited Products`).
        *   It will use the GitHub API to search for *open* issues with this exact title.
        *   **If no issue exists,** it will create a new one with the title and a body containing the error details and timestamp.
        *   **If an issue already exists,** it will do nothing. This prevents a new notification for a known, ongoing problem.
    3.  **Dashboard Integration:** The `run_log.json` will capture all errors from a run. The dashboard will read this log and prominently display a "System Status" indicator. If the last run had errors, it will be flagged (e.g., a yellow or red icon) and the details of the failed pages will be listed.
    4.  **Email Fallback:** For simplicity in the MVP, we will *not* send an email for system failures. The GitHub Issue *is* the notification for the maintainer. This cleanly separates content-change alerts (email) from system-health alerts (GitHub Issues).

#### **NEW - 2.6. Debugging Common Errors**

*   **Interpreting Fetch Logs:** The `fetch.py` script provides verbose output. If a snapshot is not created, check the workflow logs for entries like:
    *   `Client error '403 Forbidden'`: This indicates the target server is blocking our simple `httpx` request. The fix is to switch the URL's `"renderer"` in `platform_urls.json` from `"httpx"` to `"playwright"`.
    *   `[Errno -5] No address associated with hostname`: This is a DNS or network-level issue, often a side-effect of anti-bot measures. Using the `"playwright"` renderer is also the correct mitigation here.

---

### **3. Phase 2: The Intelligence Dashboard**

With the data pipeline stabilized, we will build the primary user-facing component: a web-based intelligence dashboard. This moves beyond simple logging to provide actionable insights.

#### **3.1. Core Concepts & Data Models**

1.  **Smart Summaries:** The AI's role will be more nuanced. We need a persistent way to store and manage summaries.
    *   **New Data Model: `summaries.json`**: This file will be the single source of truth for all AI-generated content. It will store a record for each tracked policy, identified by its unique slug.
        ```json
        {
          "whatnot-community-guidelines": {
            "platform": "Whatnot",
            "name": "Community Guidelines",
            "url": "https://...",
            "initial_summary": "This document outlines the rules for user behavior on Whatnot, focusing on respect, safety, and prohibited items...",
            "last_update_summary": "The policy was updated to include a new section on AI-generated content.",
            "last_update_timestamp_utc": "2025-07-20T10:00:00Z"
          }
        }
        ```
    *   **Logic Flow:**
        *   **First Run:** When `diff_and_notify.py` sees a policy for the first time, it will generate a comprehensive `initial_summary` of the entire document and store it in `summaries.json`.
        *   **On Change:** On subsequent changes, it will generate a `last_update_summary` (based on the diff) and update the timestamp. The `initial_summary` will remain unchanged.

#### **3.2. Dashboard Features & Layout**

The dashboard will be a single-page application with two distinct sections.

1.  **System Health View:**
    *   **Goal:** Provide an at-a-glance view of the system's operational status.
    *   **Data Source:** `run_log.json`.
    *   **Display:**
        *   A prominent status indicator for the last run (e.g., "Success," "Partial Failure").
        *   Timestamp of the last successful run.
        *   A list of any errors from the most recent run, including the failed URL and reason.

2.  **Policy Explorer View:**
    *   **Goal:** Allow the team to explore and understand the full content of all tracked policies.
    *   **Data Sources:** `snapshots/` directory and `summaries.json`.
    *   **Display:**
        *   Policies grouped by platform (e.g., Whatnot, TikTok).
        *   For each policy, display its name, the `initial_summary`, the `last_update_summary`, and the date of the last update.
        *   A button or link to view the full, raw HTML of the latest snapshot.

#### **3.3. Technical Implementation**

*   **Frontend:** A simple, static site generated using modern HTML, CSS, and JavaScript. We will not need a complex framework like React for the MVP.
*   **Data Access:** The dashboard will be hosted as a static site (e.g., on GitHub Pages). On page load, it will use JavaScript's `fetch` API to read the `run_log.json`, `summaries.json`, and the individual policy snapshots directly from the GitHub repository.
*   **Email Notifications:** The `send_email.py` script will now read from `summaries.json` to get the `last_update_summary` to include in the alert.
*   **Testing:** The `test-page/index.html` remains critical for triggering the entire pipeline, which will now include updates to `summaries.json` and the dashboard.