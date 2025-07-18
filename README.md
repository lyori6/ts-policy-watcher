# T&S Policy Watcher

## Overview
Automated system to monitor competitor Trust & Safety policy changes and transparently report operational health.

## File Structure
- `platform_urls.json`: List of competitor policy URLs to track
- `run_log.json`: Log of each run, including errors
- `fetch.py`: Fetches policy pages
- `diff_and_notify.py`: Detects changes and sends notifications
- `create_github_issue.py`: Handles error reporting to GitHub Issues
- `.github/workflows/main.yml`: GitHub Actions scheduler for automation

## Workflow
1. **GitHub Actions** triggers scheduled runs
2. **fetch.py** attempts to fetch all URLs
3. **diff_and_notify.py** checks for changes and notifies
4. **create_github_issue.py** creates GitHub Issues for critical errors

## See PRD.md for full requirements and flow.
