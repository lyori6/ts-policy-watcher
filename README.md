# Trust & Safety Policy Watcher

An automated system designed to monitor competitor Trust & Safety policy pages, generate AI-powered summaries of changes, and provide a simple dashboard for at-a-glance intelligence.

## About The Project

In the fast-paced world of live shopping, staying informed about changes to competitor platforms' rules and policies is critical for strategic decision-making. Manually checking these pages is tedious and unreliable. This project automates the entire process.

This system runs on a schedule, fetches a list of predefined policy URLs, intelligently detects substantive changes, uses the Google Gemini API to summarize what's new, and logs its own operational health. The goal is a zero-maintenance, "set it and forget it" intelligence pipeline.

### Core Features:
*   **Automated Monitoring:** Uses GitHub Actions to run on a schedule.
*   **Intelligent Fetching:** Uses `httpx` for fast requests and falls back to `playwright` (a full browser) for sites that block simple scrapers.
*   **AI-Powered Summaries:** Leverages the Gemini API to generate concise, human-readable summaries of policy changes.
*   **Persistent Memory:** Stores initial and update summaries in `summaries.json` to build a historical record.
*   **Health & Error Monitoring:** Logs every run to `run_log.json` and uses GitHub Issues for persistent, de-duplicated error tracking.
*   **Intelligence Dashboard:** A simple, static web dashboard to visualize system health and explore policy summaries.

---

## Getting Started

To run this project locally, you'll need Python 3 and the following setup.

### Prerequisites

1.  Clone the repository:
    ```sh
    git clone https://github.com/lyori6/ts-policy-watcher.git
    cd ts-policy-watcher
    ```

2.  Install the required Python packages:
    ```sh
    pip install -r requirements.txt
    ```

3.  **Set up your Gemini API Key:** This project uses the Google Gemini API for summarization. You must set it as an environment variable.
    ```sh
    export GEMINI_API_KEY="your_api_key_here"
    ```

### Running the Scripts

*   **To fetch snapshots:** `python scripts/fetch.py`
*   **To generate summaries:** `python scripts/diff_and_notify.py` (requires a git history with changes to the `snapshots/` directory).

---

## Project Structure & Key Artifacts

*   **`dashboard/`**: Contains the static HTML, CSS, and JS for the user-facing intelligence dashboard.
*   **`scripts/`**: Houses the core Python logic for the data pipeline.
    *   `fetch.py`: Responsible for fetching URLs and saving HTML snapshots.
    *   `diff_and_notify.py`: Detects changes between snapshots, calls the Gemini API, and updates the `summaries.json` and `run_log.json` files.
*   **`snapshots/`**: Stores timestamped HTML snapshots of the policy pages. This directory is the "database" of raw data.
*   **`.github/workflows/main.yml`**: The GitHub Actions workflow that automates the entire process on a schedule.
*   **`platform_urls.json`**: The configuration file listing all competitor URLs to be monitored.
*   **`run_log.json`**: A log of all automation runs, including timestamps, status, and any errors. This file powers the "System Health" view on the dashboard.
*   **`summaries.json`**: The persistent database of AI-generated summaries. It stores an initial summary and the most recent update summary for each tracked policy.
*   **`PRD.md`**: The formal Product Requirements Document, outlining the project's goals, features, and technical design in detail.
