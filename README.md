# Trust & Safety Policy Watcher

An automated competitive intelligence system that monitors competitor Trust & Safety policy pages, generates AI-powered summaries of changes, and provides a comprehensive dashboard for strategic decision-making.

## About The Project

In the fast-paced world of live commerce, staying informed about changes to competitor platforms' Trust & Safety policies is critical for strategic decision-making. Manually checking these pages is tedious and unreliable. This project automates the entire process with a focus on user safety controls, content moderation approaches, and enforcement mechanisms.

This system runs on a schedule, fetches a list of predefined policy URLs across TikTok, YouTube, Instagram, and Whatnot, intelligently detects substantive changes, uses the Google Gemini API to summarize what's new, and logs its own operational health. The goal is a zero-maintenance, "set it and forget it" intelligence pipeline that delivers actionable insights to product managers.

### Core Features:
*   **Automated Monitoring:** Uses GitHub Actions to run every 6 hours, monitoring 20+ policies across 4 major platforms.
*   **Intelligent Fetching:** Uses `httpx` for fast requests and falls back to `playwright` (a full browser) for sites that block simple scrapers.
*   **AI-Powered Summaries:** Leverages Gemini 2.5 Flash API to generate concise, PM-focused summaries of policy changes with markdown formatting.
*   **Smart Email Notifications:** Uses Resend service to send beautifully formatted email alerts with markdown-to-HTML conversion and platform grouping.
*   **Comprehensive Dashboard:** Feature-rich intelligence dashboard with policy matrix, trend analysis, platform comparison, and real-time operational status.
*   **Persistent Memory:** Stores initial and update summaries in `summaries.json` to build a historical record of competitive intelligence.
*   **Health & Error Monitoring:** Logs every run to `run_log.json` with detailed error tracking and transparent system status reporting.

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

3.  **Set up your environment variables:** This project requires several API keys and configuration:
    ```sh
    export GEMINI_API_KEY="your_gemini_api_key_here"
    export GEMINI_API_KEY_2="your_backup_gemini_key"  # Optional but recommended
    export RESEND_API_KEY="your_resend_api_key"
    export RECIPIENT_EMAIL="your_notification_email@domain.com"
    ```

4.  **Install Playwright browsers** (for JavaScript-heavy sites):
    ```sh
    playwright install
    ```

### Running the Scripts

*   **To fetch snapshots:** `python scripts/fetch.py`
*   **To generate summaries and send notifications:** `python scripts/diff_and_notify.py` (requires a git history with changes to the `snapshots/` directory)
*   **To test email functionality:** `python simple_email_test.py`

### Dashboard

The dashboard is a static web application located in the `dashboard/` directory. Simply open `dashboard/index.html` in a browser or deploy to any static hosting service (currently deployed on Vercel).

---

## Technical Overview

The system is an autonomous intelligence pipeline orchestrated by a GitHub Actions workflow (`.github/workflows/watch.yml`). It runs on a schedule to fetch, process, and store data.

For a complete technical breakdown of the architecture, data flow, core logic, and a comprehensive troubleshooting guide, please see the **[Engineering Handoff Document](handoff.md)**.

### Key Artifacts

*   **`.github/workflows/watch.yml`**: The GitHub Actions workflow that automates the entire process.
*   **`dashboard/`**: Contains the static HTML, CSS, and JS for the user-facing intelligence dashboard.
*   **`scripts/`**: Houses the core Python logic for the data pipeline (`fetch.py`, `diff_and_notify.py`).
*   **`snapshots/`**: Stores the raw, timestamped HTML content of the tracked policy pages.
*   **`platform_urls.json`**: The configuration file that defines which URLs to track.
*   **`run_log.json`**: Records the status of each workflow run for the dashboard's System Health view.
*   **`summaries.json`**: The persistent database of all AI-generated summaries.

## Current System Status

### ✅ **Operational Features**
- **Email Notifications**: Working with Resend integration, markdown-to-HTML conversion, and platform grouping
- **Dashboard UI**: Fully functional with policy matrix, trend analysis, focus areas, and real-time status monitoring
- **AI Summaries**: Using Gemini 2.5 Flash with backup key support and intelligent change filtering
- **Automated Monitoring**: Running every 6 hours via GitHub Actions across 20+ competitor policies

### 🔧 **Known Issues & Optimization Areas**
- **False Positives**: The change detection algorithm may be too sensitive, triggering notifications for minor updates
- **Change Recognition**: Diff logic may need refinement to better distinguish substantive policy changes from cosmetic updates

### 📊 **Current Coverage**
- **TikTok**: Community Guidelines, Live Moderation, Shop Prohibited Products, User Blocking
- **YouTube**: Community Guidelines, Harassment Policy, Shopping Ads Policy, User Hiding
- **Instagram**: Community Guidelines, User Blocking, Commerce Policies, Appeal Process  
- **Whatnot**: Community Guidelines, Hate & Harassment, Enforcement Actions, Moderation Guidelines, User Blocking, Buyer Protection, Reporting

### 🎯 **Next Phase Focus**
The system is operationally stable. The next major focus area is **improving change detection accuracy** to reduce false positives and ensure only meaningful policy updates generate notifications.
