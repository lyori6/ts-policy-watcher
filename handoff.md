# Engineering Handoff: T&S Policy Watcher

**Version:** 1.0
**Status:** Technical documentation complete. Pipeline is implemented and pending final validation.

## 1. System Philosophy

This system is designed to be a zero-maintenance, autonomous intelligence pipeline. Its primary goal is to run reliably on a schedule, fetch data, process it, and store the results without human intervention. The architecture prioritizes robustness and transparent error reporting.

Key principles:
- **Atomicity:** Each workflow run is a self-contained operation.
- **Idempotency:** The core logic can handle being run multiple times without creating duplicate data (e.g., it updates existing summaries rather than creating new ones).
- **Statelessness:** The scripts themselves are stateless; all state is managed through files stored in the Git repository (`snapshots/`, `run_log.json`, `summaries.json`).

---

## 2. Deep Dive: System Architecture

The system is composed of a GitHub Actions workflow that orchestrates two primary Python scripts. All data and artifacts are stored directly in the Git repository.

### 2.1. Component Breakdown

| Component | Technology | Responsibility |
| :--- | :--- | :--- |
| **Orchestrator** | GitHub Actions | Runs the entire pipeline on a schedule (`cron`) or on demand (`workflow_dispatch`). |
| **Fetcher** | `scripts/fetch.py` | Fetches raw HTML from target URLs using `httpx` or Playwright. Saves snapshots to the `snapshots/` directory. |
| **Processor** | `scripts/diff_and_notify.py` | Analyzes committed snapshots, generates AI summaries for changes, and logs the run status. |
| **Data Storage** | Git Repository | Stores raw snapshots, AI summaries (`summaries.json`), and health logs (`run_log.json`). |
| **Dashboard** | Vercel (Static) | A simple HTML/CSS/JS frontend that reads data directly from the public GitHub repository. |

### 2.2. The Critical Data Flow

The most complex part of the system is ensuring the Processor (`diff_and_notify.py`) can reliably identify which files were changed by the Fetcher (`fetch.py`) in the same workflow run. Here is the exact sequence:

1.  **Fetch & Commit:** `fetch.py` runs, creating new HTML files in `snapshots/`. The workflow then commits these files. This commit's SHA is the key artifact.
2.  **Capture SHA:** The "Commit Snapshots" step in `watch.yml` captures the SHA of this new commit using `git rev-parse HEAD` and saves it as a step output variable (`steps.commit.outputs.commit_sha`).
3.  **Pass SHA:** The workflow passes this captured SHA as an environment variable (`COMMIT_SHA`) to the `diff_and_notify.py` script.
4.  **Analyze Specific Commit:** The script reads `COMMIT_SHA` and uses it in its `git show` and `git diff` commands. This tells Git to look for file changes *only within that specific commit*, completely avoiding the race conditions and ambiguity that caused earlier failures.

This explicit passing of the commit SHA is the core mechanism that makes the pipeline robust.

---

## 3. Core Logic: Scripts & Algorithms

### 3.1. `scripts/fetch.py`

-   **Purpose:** To retrieve and store raw HTML snapshots of target policy pages.
-   **Algorithm:**
    1.  Reads `platform_urls.json` to get the list of URLs to track.
    2.  For each URL, it checks the specified `renderer`:
        -   `"httpx"`: Uses the lightweight `httpx` library for a simple, fast GET request. This is the default.
        -   `"playwright"`: If a site uses heavy JavaScript or anti-bot measures, this launches a full headless browser (Playwright) to render the page before extracting the HTML. This is slower but more robust.
    3.  Saves the resulting HTML to a timestamped file in the corresponding `snapshots/{slug}/` directory.
-   **Failure Modes:**
    -   An HTTP error (4xx, 5xx) will be caught and logged to the console. The script will continue to the next URL.
    -   A Playwright timeout or crash will be logged, and the script will continue.

### 3.2. `scripts/diff_and_notify.py`

-   **Purpose:** To analyze changed snapshots, generate AI summaries, and log the results.
-   **Algorithm:**
    1.  **Get Commit SHA:** Reads the `COMMIT_SHA` environment variable. If it's not present, the script exits gracefully, assuming no changes were made.
    2.  **Get Changed Files:** Calls `get_changed_files(commit_sha)`, which runs `git show --name-only {commit_sha}` to get a precise list of files from the snapshot commit.
    3.  **Load Summaries:** Loads the existing `summaries.json` into memory.
    4.  **Process Loop:** For each changed file:
        -   It determines if the policy is new (slug not in `summaries.data`) or existing.
        -   **For new policies:** It reads the full HTML, cleans it, and sends it to the Gemini API with a prompt to create a comprehensive initial summary.
        -   **For existing policies:** It runs `get_git_diff(file_path, commit_sha)` to get the diff from the parent commit, cleans it, and sends it to the API with a prompt to summarize only the changes.
        -   It updates the `summaries_data` dictionary in memory with the new summary text and timestamp.
    5.  **Save & Log:** After the loop, it overwrites `summaries.json` with the updated data and writes a final status entry to `run_log.json`.

---

## 4. Troubleshooting Guide

This section documents common failures and their solutions. The GitHub Actions logs are the primary source for debugging.

| Symptom | Error Log Message | Root Cause | Solution |
| :--- | :--- | :--- | :--- |
| **Workflow Fails to Push** | `Updates were rejected because the remote contains work that you do not have locally` | **Race Condition:** The workflow's local repo is out of date when it tries to push. Another commit (e.g., a manual push) was made while it was running. | **Fixed:** Added a `git pull origin main --rebase` step to the workflow before the push. This syncs the local state first. |
| **Empty `run_log.json`, No `summaries.json`** | (No specific error, script just finishes early) | **Flawed Diff Logic:** The script was using `git diff HEAD~1 HEAD`, which was unreliable in the workflow context and often returned no files, causing a premature exit. | **Fixed:** The workflow now passes the specific commit SHA to the script, which uses `git show {commit_sha}` for precise file detection. |
| **Fetcher Fails for a URL** | `Client error '403 Forbidden'` or `[Errno -5] No address associated` | **Anti-Bot Measures:** The target site is blocking simple HTTP requests. | Change the `"renderer"` for that URL in `platform_urls.json` from `"httpx"` to `"playwright"`. |
| **Gemini API Errors** | `google.api_core.exceptions.PermissionDenied: 403 API key not valid` | The `GEMINI_API_KEY` secret is incorrect, expired, or lacks the necessary permissions. | Verify the API key in Google AI Studio and ensure it's correctly configured as a GitHub Secret for the repository. |

*   **Date:** July 19, 2025
*   **Project:** Trust & Safety (T&S) Policy Watcher
*   **Current Status:** **Development Blocked** - Core functionality is built, but a CI/CD environment issue is preventing the system from executing its primary task.

### **1. Executive Summary & Vision**

**What are we trying to achieve?**
The goal is to create a zero-maintenance, automated system that acts as a competitive intelligence tool for the eBay Live Trust & Safety team. It will proactively monitor the public T&S policy pages of key competitors (Whatnot, TikTok, Instagram, YouTube), detect changes, use AI to summarize their impact, and send timely alerts. This tool will save dozens of manual work hours and provide a strategic advantage by flagging competitor feature launches and policy shifts as they happen.

**Where are we?**
The project is approximately 80% complete in terms of code and architecture for the MVP. All core scripts, configuration files, and the complete CI/CD automation workflow are written. However, the system is currently blocked by a silent failure within the GitHub Actions runner environment.

### **2. Current State of the Project (What's Working)**

The foundational architecture is in place and has been proven to work up to a point:

*   **CI/CD Automation:** The GitHub Actions workflow (`.github/workflows/watch.yml`) is correctly configured. It successfully triggers on schedule and manually, checks out the code, and installs all Python and system dependencies (including Playwright and its browsers) without error.
*   **Git Committing & Pushing:** The workflow steps that configure Git, commit changes, and push back to the repository are functional.
*   **Secret Management:** The architecture for handling secrets (`GEMINI_API_KEY`, `MAIL_USERNAME`, `MAIL_PASSWORD`) is correctly integrated into the workflow file.
*   **Modular Scripts:** The logic is cleanly separated into four distinct Python scripts (`fetch`, `diff_and_notify`, `create_github_issue`) and a JSON configuration, which is a robust design.

In essence, we have a car with a perfectly functioning engine, transmission, and chassis, but for an unknown reason, the engine is shutting off the instant the gas pedal is pressed.

### **3. The Critical Bug: The "Silent Failure"**

This is the central issue blocking all further progress.

**The Symptom:**
When the GitHub Action workflow runs, the "Run Fetcher Script" step executes and completes with a green checkmark in **0 seconds**. It does not fail the build, but it also produces no output—no HTML files are created in the `snapshots/` directory. The subsequent steps correctly determine that no files have changed and the workflow finishes "successfully," having accomplished nothing.

**The Diagnosis & Evidence:**
1.  **Instantaneous Execution (0s):** The logs show the `fetch.py` script starts but immediately terminates. This indicates a fatal error is occurring *before* the main processing loop begins.
2.  **No Error Output:** The workflow is not reporting a non-zero exit code. This suggests the error is either being suppressed or is happening in a way that the `bash -e` flag (which should stop the job on any error) is not catching.
3.  **Verbose Logging Ineffective:** The updated, highly verbose `fetch.py` script was committed. The logs show its *very first* `print` statement ("--- Starting Fetcher Script ---"), but none of the subsequent checks (e.g., "FATAL: Configuration file not found...", "Successfully loaded...").

**Primary Suspect: Working Directory & File Path Issue**
This is the most common cause of such behavior in CI/CD environments. The Python script is likely failing its very first file operation: `if not URL_CONFIG_FILE.is_file():`. It believes the `platform_urls.json` file does not exist, causing it to exit.

The reason it's not printing the "FATAL" error message is likely due to how the GitHub Actions runner handles `stdout` vs. `stderr` on immediate exits, effectively swallowing the message. **The core problem is that the script isn't finding its own configuration file, even though it's in the repository root.**

### **4. IMMEDIATE NEXT STEP: The Definitive Debugging Action**

To solve this, we need to stop guessing and get ground truth from the runner itself. We must verify exactly what files exist and where the runner is executing our script from.

**Action Required:**

Modify the `.github/workflows/watch.yml` file. Add a single, simple debugging step right before the script is run.

**Find this step in `watch.yml`:**
```yaml
      - name: 'Run Fetcher Script'
        id: fetcher
        run: python scripts/fetch.py
```

**Change it to this:**
```yaml
      - name: 'DEBUG: List files in workspace'
        run: |
          echo "Current Working Directory:"
          pwd
          echo "---"
          echo "Recursive file listing:"
          ls -R

      - name: 'Run Fetcher Script'
        id: fetcher
        run: python scripts/fetch.py
```

**Why this will work:**
This new `DEBUG` step will force the runner to:
1.  Print its current working directory (`pwd`).
2.  Print a complete, recursive list of every single file and folder it sees (`ls -R`).

The output of this step will tell us definitively:
*   Is `platform_urls.json` present at the root as we expect?
*   Are the `scripts/` and `snapshots/` directories where they should be?

This information will allow the next developer to immediately fix the pathing issue, likely by adjusting how `fetch.py` constructs its file paths (e.g., by using an absolute path relative to the script's own location) or by changing the working directory in the YAML file.

### **5. Project Roadmap (Post-Bugfix)**

Once the file path issue is resolved and the `fetch.py` script successfully populates the `snapshots/` directory, the project will be unblocked. The immediate roadmap is:

1.  **Confirm Seeding Run:** Trigger a manual workflow run and verify that it populates the `snapshots/` directory and creates a commit.
2.  **Test the Full Change-Detection Pipeline:** Manually edit one of the newly created HTML files to simulate a policy change, then trigger another manual run.
3.  **Verify Notification:** Confirm that the AI summary is generated and the email notification is successfully received.
4.  **Verify Error Handling:** Manually introduce a typo into a URL in `platform_urls.json` and run the workflow to confirm a GitHub Issue is automatically created.
5.  **Expand and Deploy:** If all tests pass, expand the `platform_urls.json` file to include the full list of ~40 researched URLs and let the system run on its 6-hour schedule.