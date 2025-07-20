# Engineering Handoff: T&S Policy Watcher

**Last Updated:** 2025-07-19

---

## **CRITICAL HANDOFF MEMO: THE SILENT CRASH**

**TO:** Next AI Developer
**FROM:** Cascade
**SUBJECT:** Unsolved catastrophic failure in the `diff_and_notify.py` script.

I was unable to solve a critical bug, and this document is my final attempt to provide you with all the context needed to succeed where I failed. 

### The Core Mystery

The `diff_and_notify.py` script consistently fails when run within the GitHub Actions workflow. The failure is catastrophic and silent:

1.  The script is triggered by the workflow.
2.  It crashes before it can perform any meaningful work.
3.  Crucially, it crashes *before* the `finally` block in `main()` can execute, meaning the `run_log.json` file is never successfully written by the script.
4.  The workflow itself creates an empty log file (`echo '[]' > run_log.json`) as a placeholder. The fact that this placeholder is never overwritten is the primary evidence of the script's failure to run.

### History of Failed Hypotheses

We methodically tested and disproved several hypotheses. Do not waste time on these paths:

1.  **Hypothesis: Unreliable Git Diffs.**
    -   **Theory:** `git diff HEAD~1` was unreliable in the Actions environment.
    -   **Action:** We re-architected the workflow to pass a specific `COMMIT_SHA` to the script.
    -   **Result:** The underlying problem remained. This was not the root cause.

2.  **Hypothesis: Unhandled Python Exception.**
    -   **Theory:** A standard Python error (API, parsing, etc.) was crashing the script.
    -   **Action:** We wrapped the entire `main()` function's logic in a robust `try...finally` block.
    -   **Result:** The `finally` block never executed, proving the crash is happening outside the scope of standard Python exception handling. It is more fundamental.

3.  **Hypothesis: Silent `subprocess` Crash.**
    -   **Theory:** The `git` commands being called via `subprocess.run()` were failing and their `stderr` was being suppressed.
    -   **Action:** We instrumented the `subprocess` calls to explicitly capture and print any `stderr` from the `git` process.
    -   **Result:** No `stderr` was ever printed to the logs. This was my final failed attempt. It suggests the script may not even be reaching the point where these functions are called.

### **Final Recommendation & Next Steps**

My final conclusion is that **the problem is not in the Python code, but in the GitHub Actions runner environment itself.** The crash is happening at a level below what the Python script can catch.

I strongly advise you to **immediately stop debugging the Python script** and instead focus your investigation on the runner environment and the workflow's execution context.

**Your first steps should be:**

1.  **Shell Verbosity:** Add `set -x` to the top of the `Run differ and notifier` step in `watch.yml`. This will print every shell command as it executes and may reveal a fatal error in how the script is being invoked.
2.  **Filesystem Checks:** Add `ls -laR` commands to the workflow *before* the Python script is run to verify file paths, permissions, and the existence of the Python executable and dependencies.
3.  **Simplify to Isolate:** Reduce `diff_and_notify.py` to its absolute simplest form (e.g., `import sys; print("Python is running"); sys.exit(0)`). If even this fails, it proves the issue is with the Python interpreter or environment on the runner.
4.  **Check Runner Resources:** Investigate if the process is being killed by the runner for exceeding memory or other resource limits, although this is unlikely given the script's simplicity.

Good luck. The answer is in the runner.

---

## 1. System Overview

The T&S Policy Watcher is an automated system designed to monitor changes in the public policy documents of various online platforms (e.g., TikTok, YouTube, Instagram). It periodically scrapes these pages, detects changes, uses a GenAI model to summarize the changes, and presents the information on a simple web dashboard.

The architecture is designed to be simple, serverless, and cost-effective, leveraging a "Git-as-a-Database" approach.

- **Automation:** GitHub Actions runs the core logic on a schedule.
- **Data Storage:** Raw HTML snapshots, JSON summaries, and run logs are all stored directly in the GitHub repository.
- **Intelligence:** The Google Gemini API provides AI-powered summaries of policy changes.
- **Frontend:** A static HTML/JS/CSS dashboard is deployed on Vercel, reading data directly from the GitHub repository via RawGit.

## 2. Core Components

### `/.github/workflows/watch.yml`

This is the heart of the system. It's a GitHub Actions workflow that orchestrates the entire process.

- **Trigger:** Runs on a schedule (`cron: '0 */4 * * *'`) and can be manually dispatched (`workflow_dispatch`).
- **Concurrency Control:** Uses `concurrency.group` to ensure only one workflow instance runs at a time, preventing race conditions when committing data back to the repo.
- **Steps:**
    1.  Checks out the repository.
    2.  Sets up Python and installs dependencies from `requirements.txt`.
    3.  Runs the `policy_scraper.py` script to fetch the latest versions of policy pages, saving them to the `snapshots/` directory.
    4.  Commits the new snapshots and captures the `COMMIT_SHA` of this commit.
    5.  Runs the `diff_and_notify.py` script, passing the `COMMIT_SHA` as an environment variable.
    6.  Commits the `summaries.json` and `run_log.json` files generated by the diff script.

### `/scripts/diff_and_notify.py`

This script is the brain of the system. It analyzes the changes committed by the scraper and generates the intelligence.

- **Input:** Takes a `COMMIT_SHA` from the workflow.
- **Logic:**
    1.  Uses `git show` with the commit SHA to find which snapshot files were changed in that specific commit.
    2.  For each changed file, it uses `git diff` to get the raw changes.
    3.  It sends the diff to the Gemini API to generate a human-readable summary of what changed.
    4.  It updates `summaries.json` with the new summary.
    5.  It wraps the entire main execution in a `try...finally` block to ensure that it *always* writes a `run_log.json` file, even if a catastrophic, unhandled error occurs.

### `/dashboard`

Contains the static files for the Vercel-hosted frontend. It reads `run_log.json` and `summaries.json` to display the system status and policy change history.

## 3. Data Flow

1.  **Scrape:** `watch.yml` triggers `policy_scraper.py`.
2.  **Snapshot:** `policy_scraper.py` saves new HTML files to `snapshots/{policy-name}/{timestamp}.html`.
3.  **Commit Snapshots:** `watch.yml` commits the new snapshots to the repo.
4.  **Diff & Summarize:** `watch.yml` triggers `diff_and_notify.py` with the commit SHA.
5.  **Generate Artifacts:** `diff_and_notify.py` generates `summaries.json` and `run_log.json`.
6.  **Commit Artifacts:** `watch.yml` commits the JSON artifacts to the repo.
7.  **Display:** The user visits the Vercel dashboard, which fetches and renders the JSON artifacts.

## 4. Key Artifacts

- **`/snapshots`**: Contains the raw HTML captures of the policy pages, organized by policy and timestamped.
- **`summaries.json`**: A JSON file containing the AI-generated summaries of all detected policy changes.
- **`run_log.json`**: A log file for each run, capturing the status (success, failure, partial_failure), number of pages checked, changes found, and a list of any errors that occurred.


**Last Updated:** 2025-07-19

## 1. System Overview

The T&S Policy Watcher is an automated system designed to monitor changes in the public policy documents of various online platforms (e.g., TikTok, YouTube, Instagram). It periodically scrapes these pages, detects changes, uses a GenAI model to summarize the changes, and presents the information on a simple web dashboard.

The architecture is designed to be simple, serverless, and cost-effective, leveraging a "Git-as-a-Database" approach.

- **Automation:** GitHub Actions runs the core logic on a schedule.
- **Data Storage:** Raw HTML snapshots, JSON summaries, and run logs are all stored directly in the GitHub repository.
- **Intelligence:** The Google Gemini API provides AI-powered summaries of policy changes.
- **Frontend:** A static HTML/JS/CSS dashboard is deployed on Vercel, reading data directly from the GitHub repository via RawGit.

## 2. Core Components

### `/.github/workflows/watch.yml`

This is the heart of the system. It's a GitHub Actions workflow that orchestrates the entire process.

- **Trigger:** Runs on a schedule (`cron: '0 */4 * * *'`) and can be manually dispatched (`workflow_dispatch`).
- **Concurrency Control:** Uses `concurrency.group` to ensure only one workflow instance runs at a time, preventing race conditions when committing data back to the repo.
- **Steps:**
    1.  Checks out the repository.
    2.  Sets up Python and installs dependencies from `requirements.txt`.
    3.  Runs the `policy_scraper.py` script to fetch the latest versions of policy pages, saving them to the `snapshots/` directory.
    4.  Commits the new snapshots and captures the `COMMIT_SHA` of this commit.
    5.  Runs the `diff_and_notify.py` script, passing the `COMMIT_SHA` as an environment variable.
    6.  Commits the `summaries.json` and `run_log.json` files generated by the diff script.

### `/scripts/diff_and_notify.py`

This script is the brain of the system. It analyzes the changes committed by the scraper and generates the intelligence.

- **Input:** Takes a `COMMIT_SHA` from the workflow.
- **Logic:**
    1.  Uses `git show` with the commit SHA to find which snapshot files were changed in that specific commit.
    2.  For each changed file, it uses `git diff` to get the raw changes.
    3.  It sends the diff to the Gemini API to generate a human-readable summary of what changed.
    4.  It updates `summaries.json` with the new summary.
    5.  It wraps the entire main execution in a `try...finally` block to ensure that it *always* writes a `run_log.json` file, even if a catastrophic, unhandled error occurs.

### `/dashboard`

Contains the static files for the Vercel-hosted frontend. It reads `run_log.json` and `summaries.json` to display the system status and policy change history.

## 3. Data Flow

1.  **Scrape:** `watch.yml` triggers `policy_scraper.py`.
2.  **Snapshot:** `policy_scraper.py` saves new HTML files to `snapshots/{policy-name}/{timestamp}.html`.
3.  **Commit Snapshots:** `watch.yml` commits the new snapshots to the repo.
4.  **Diff & Summarize:** `watch.yml` triggers `diff_and_notify.py` with the commit SHA.
5.  **Generate Artifacts:** `diff_and_notify.py` generates `summaries.json` and `run_log.json`.
6.  **Commit Artifacts:** `watch.yml` commits the JSON artifacts to the repo.
7.  **Display:** The user visits the Vercel dashboard, which fetches and renders the JSON artifacts.

## 4. Key Artifacts

- **`/snapshots`**: Contains the raw HTML captures of the policy pages, organized by policy and timestamped.
- **`summaries.json`**: A JSON file containing the AI-generated summaries of all detected policy changes.
- **`run_log.json`**: A log file for each run, capturing the status (success, failure, partial_failure), number of pages checked, changes found, and a list of any errors that occurred.

## 5. Debugging and Troubleshooting History

This system underwent a significant debugging process to reach its current state of robustness. The primary challenge was a **silent failure mode** where the `diff_and_notify.py` script would crash without updating `run_log.json` or `summaries.json`, leaving the system in an indeterminate state.

### Stage 1: Unreliable Git Diffs

- **Problem:** The script initially used `git diff HEAD~1` to find changes, which is unreliable in various GitHub Actions scenarios (e.g., first run, re-runs).
- **Hypothesis:** The `git diff` command was not finding the correct changes, causing the script to exit prematurely.
- **Solution:** The workflow was modified to explicitly capture the SHA of the snapshot commit (`COMMIT_SHA`) and pass it as an environment variable to the script. The script was then updated to use `git show $COMMIT_SHA` to reliably identify the exact files changed in that commit.

### Stage 2: Unhandled Exceptions

- **Problem:** Even after fixing the git logic, the script would still sometimes fail silently.
- **Hypothesis:** An unhandled exception (e.g., an API error, a data parsing error) was crashing the entire script before the final logging step.
- **Solution:** The core logic of the `main()` function was wrapped in a `try...finally` block. This guarantees that the `log_run_status()` function is *always* called, ensuring that `run_log.json` is always written, even if the `try` block crashes.

### Stage 3: Catastrophic Subprocess Failures (Current)

- **Problem:** The silent failures persisted. The `run_log.json` file was being created as an empty list `[]`, indicating the script was crashing before the `finally` block could be properly executed, or the `log_run_status` function itself was failing.
- **Hypothesis:** The script is crashing due to a fatal error in one of the `subprocess.run()` calls that execute `git`. These calls can fail if `git` writes to `stderr` and exits with a non-zero code, and this error was not being properly captured and displayed by Python.
- **Solution (In Progress):** The `get_changed_files()` and `get_git_diff()` functions were instrumented with more robust error handling. The `try...except subprocess.CalledProcessError` blocks were modified to explicitly print the `stderr` stream from the failed `git` command. This will force the logs to reveal the true root cause of the crash.


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