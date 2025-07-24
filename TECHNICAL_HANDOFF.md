# Technical Handoff: T&S Policy Watcher

**A comprehensive guide for developers and maintainers. This document details the system's architecture, setup, deployment, and operational history.**

**Last Updated:** 2025-07-24
**Status:** System is fully operational. Current focus is on optimizing change detection accuracy.

---

## 1. System Architecture & Core Components

The T&S Policy Watcher is an automated intelligence pipeline designed to be robust and maintainable. It is orchestrated by a GitHub Actions workflow and composed of several key components.

### 1.1. High-Level Data Flow

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

### 1.2. Key Components & Technologies

*   **Orchestration (`.github/workflows/watch.yml`):**
    *   A GitHub Actions workflow triggers the pipeline on a 6-hour cron schedule.
    *   It is responsible for checking out the code, setting up the Python environment, installing dependencies, and executing the scripts.
    *   It manages all necessary environment variables (API keys, etc.) as GitHub secrets.

*   **Data Collection (`scripts/fetch.py`):**
    *   Reads the list of target URLs from `platform_urls.json`.
    *   Uses a dual-renderer approach: `httpx` for fast, simple requests, falling back to `playwright` (a headless browser) for JavaScript-heavy sites that block standard scrapers.
    *   Performs sophisticated HTML cleaning using `BeautifulSoup` to isolate core policy text and remove dynamic content (ads, scripts, nonces, etc.).
    *   Compares the cleaned content of the newly fetched page against the version stored in `snapshots/`. If a meaningful change is detected, it overwrites the snapshot.

*   **Analysis & Notification (`scripts/diff_and_notify.py`):**
    *   This script runs *after* `fetch.py`.
    *   It uses `git diff` to identify which snapshot files have been changed in the latest commit.
    *   For each changed policy, it sends the old and new content to the Google Gemini API to generate a summary of the changes.

    **CRITICAL DEPENDENCY:** This script relies on the `git` history created by the `watch.yml` workflow. The workflow runs `fetch.py`, then **commits** any changes to the `snapshots/` directory. `diff_and_notify.py` then uses `git diff` against the previous commit to find what changed. It cannot be run standalone without a preceding commit.
    *   It aggregates all summaries and sends a single, consolidated email notification via the Resend API.

*   **Data Storage (JSON & Git):**
    *   **`platform_urls.json`:** The master configuration file defining which policies to track.
    *   **`snapshots/`:** A directory containing the raw HTML of the latest version of each policy. These files are committed to Git, creating a version history.
    *   **`summaries.json`:** The persistent database of AI-generated content, including an initial comprehensive summary and a summary of the latest update for each policy.
    *   **`run_log.json`:** A log of the most recent script run, capturing the timestamp, number of pages checked, changes found, and any errors. This file powers the dashboard's health status.

*   **Frontend (`dashboard/`):**
    *   A static HTML, CSS, and JavaScript single-page application.
    *   It fetches the `run_log.json` and `summaries.json` files directly from the GitHub repository to populate the dashboard.
    *   Hosted on Vercel, which automatically redeploys on pushes to the `main` branch.

    **NOTE:** The dashboard is a pure "pull" application. It has no backend server. The JavaScript code makes direct, unauthenticated GET requests to the raw content URLs of `run_log.json` and `summaries.json` in the public GitHub repository.

---

## 2. Setup & Local Development

### 2.1. Prerequisites

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/lyori6/ts-policy-watcher.git
    cd ts-policy-watcher
    ```

2.  **Install Python dependencies:**
    ```sh
    pip install -r requirements.txt
    ```

3.  **Install Playwright browsers:**
    ```sh
    playwright install
    ```

4.  **Set up environment variables:**
    ```sh
    export GEMINI_API_KEY="your_gemini_api_key"
    export GEMINI_API_KEY_2="your_backup_gemini_key"
    export RESEND_API_KEY="your_resend_api_key"
    export RECIPIENT_EMAIL="your_email@domain.com"
    ```

### 2.2. Running the Pipeline Locally

*   **Fetch Snapshots:** `python3 scripts/fetch.py`
*   **Generate Summaries & Notifications:** `python3 scripts/diff_and_notify.py` (Note: This requires that `fetch.py` has been run and the resulting changes have been committed to git).
*   **View the Dashboard:** Open `dashboard/index.html` in a web browser.

### 2.3. Managing Monitored Policies

The `platform_urls.json` file is the heart of the configuration. To add, remove, or modify a tracked policy, simply edit this file. Each entry requires:

*   `platform`: The display name of the company (e.g., "TikTok").
*   `policy_name`: The specific name of the policy.
*   `url`: The direct, raw URL to the policy page.
*   `slug`: A unique, file-system-friendly identifier.
*   `renderer`: Determines which fetching engine to use. Use `httpx` for simple HTML pages and `playwright` for pages that are heavily JavaScript-driven or are known to block scrapers.

After modifying this file, the system will automatically pick up the changes on the next scheduled run.

### 2.4. Debugging Tools

The `fetch.py` script includes a debug mode that can be activated with an environment variable. This is invaluable for troubleshooting issues with HTML cleaning or change detection.

```bash
DEBUG_FETCH=1 python3 scripts/fetch.py
```

When run, this will save the raw and cleaned HTML content for comparison to the `/tmp/` directory, allowing you to run a `diff` and see exactly what the script is "seeing."

---

## 3. Chronicle of Technical Issues & Resolutions

This section preserves the history of major technical challenges encountered during development. Understanding these challenges is key to maintaining and extending the system.

### 3.1. The False Positive Nightmare (Resolved)

*   **Problem:** The system was persistently detecting changes on Google/YouTube policy pages even when the content appeared unchanged. This was caused by dynamic content injected by the server on every page load.
*   **Investigation Chronicle:**
    1.  **Initial Suspect: Timestamps.** Early versions used timestamped filenames, which was quickly fixed by moving to stable filenames.
    2.  **Second Suspect: Dynamic HTML.** We implemented a `clean_html` function to strip `<script>`, `<style>`, and other non-content tags.
    3.  **Third Suspect: Feedback Forms.** The cleaning was made more surgical to remove specific dynamic `div`s like feedback forms.
    4.  **Final Root Cause:** A raw `diff` of the HTML revealed the true culprits: dynamically generated `nonce` attributes in script tags, random IDs on buttons, and hidden session IDs (`zwieback_id`).
*   **Resolution:** The `clean_html` function in `fetch.py` was significantly enhanced to:
    *   Correctly identify the main article body (`itemprop="articleBody"`).
    *   Use regular expressions to remove elements with dynamic ID patterns.
    *   Explicitly remove known dynamic containers like `div.subscribe-btn` and `div[data-page-data-key="zwieback_id"]`.
*   **Status:** This fix was successful and is now stable. The system reliably ignores cosmetic and dynamic changes.

### 3.2. The GitHub Actions Silent Crash (Resolved)

*   **Problem:** The `diff_and_notify.py` script was failing silently when run in the GitHub Actions environment. It would crash before writing any logs, making it impossible to debug from the script's output alone.
*   **Investigation Chronicle:**
    1.  Initial attempts to add more `try...except` blocks in the Python code failed to catch the error.
    2.  The breakthrough came from shifting focus to debugging the **runner environment itself**.
*   **Resolution:** A combination of environment-level and script-level logging was used to diagnose the issue.
    1.  **Workflow Debugging:** We added `set -x`, `pwd`, `ls -laR`, and `which python` directly to the `watch.yml` file to get a ground-truth view of the runner's state.
    2.  **Minimal Test Script:** A tiny test script that only accessed environment variables and wrote to a file was created. When it succeeded, it proved the fundamental environment was sound.
    3.  **Verbose Logging:** The main script was instrumented with print statements at every step, which finally revealed the point of failure.
*   **Status:** The underlying environmental issue was resolved, and the pipeline now runs reliably in GitHub Actions.

### 3.3. The Corrupted `fetch.py` and Logging Failure (Resolved)

*   **Problem:** The dashboard's system health log was showing "0 pages checked" because the `run_log.json` file was not being written correctly. The investigation was hampered by a faulty `view_file` tool that made `fetch.py` appear empty.
*   **Investigation Chronicle:**
    1.  The initial assumption was that the `fetch.py` file was corrupted locally.
    2.  After restoring the file from git, the issue persisted. The `run_log.json` was being created but was empty or incomplete.
    3.  The root cause was identified as a failing URL in `platform_urls.json` (`whatnot.com`) that was causing the script to time out and be killed before the final logging steps could execute.
*   **Resolution:**
    1.  The dead URL was removed from the configuration.
    2.  The main processing loop in `fetch.py` was wrapped in a `try...finally` block to **guarantee** that the run statistics are written to `run_log.json`, even if an unhandled exception occurs during the fetch process.
*   **Status:** The system is now more resilient to network failures and correctly logs its run status.

---

## 4. Current Known Issues & Actionable Next Steps

*   **Refine Change Detection Accuracy:** The highest priority is to continue improving the signal-to-noise ratio. Actionable steps include:
    *   **Analyze Dynamic Class Names:** Some sites may use dynamic CSS class names that change on each load. Enhance the `clean_html` function to strip class attributes or normalize them.
    *   **Investigate JS-Rendered Timestamps:** Look for human-readable timestamps (e.g., "Last updated June 2024") that are rendered by JavaScript and may cause false positives.
    *   **Implement a Text-Based Diff:** As a final check, consider adding a comparison of the extracted plain text *in addition* to the cleaned HTML to be absolutely certain the core content has changed.
*   **Error Handling:** The current error handling logs failures. A future enhancement is to use this log to automatically create de-duplicated GitHub Issues for persistent failures, creating a more robust, trackable alerting system.
