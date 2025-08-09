# Trust & Safety Policy Watcher

An automated competitive intelligence system that monitors competitor Trust & Safety policies, detects meaningful changes, and delivers AI-powered summaries to product teams.

## What It Does

The T&S Policy Watcher automatically:
- **Monitors** 20+ policy pages across TikTok, YouTube, Meta, and Whatnot every 6 hours
- **🆕 Enhanced Health Checks** with real Playwright validation for bot-protected sites (WhatNot, etc.)
- **Detects** substantive policy changes while filtering out cosmetic updates  
- **Summarizes** changes using AI (Google Gemini) with product manager-focused insights
- **🆕 Alerts** on both policy changes AND URL health issues with 90% uptime accuracy
- **Tracks** system health and policy trends through a comprehensive dashboard

## Why It's Useful

In fast-moving social commerce, staying ahead of competitor policy changes is critical for strategic decisions. Manual monitoring is time-consuming and unreliable. This system transforms reactive policy checking into proactive competitive intelligence.

## Quick Start

### Prerequisites
```bash
git clone https://github.com/lyori6/ts-policy-watcher.git
cd ts-policy-watcher
pip install -r requirements.txt
playwright install
```

### Environment Setup
```bash
export GEMINI_API_KEY="your_gemini_api_key"
export RESEND_API_KEY="your_resend_api_key" 
export RECIPIENT_EMAIL="your_email@domain.com"
```

### Running Locally
```bash
# 🆕 Run health checks (new - prevents silent failures)
python scripts/health_check.py

# Fetch policy snapshots
python scripts/fetch.py

# Generate summaries & send notifications  
python scripts/diff_and_notify.py
```

### Dashboard
- **Production**: https://ts-policy-watcher.vercel.app/ (deploys from `main` branch)
- **Development**: Preview deployments generated from `dev` branch PRs
- **Local**: Open `dashboard/index.html` in a browser

## Development Workflow

This project uses a **dev branch workflow** with Vercel preview deployments for safe development.

### Branch Strategy
- **`main`** - Production branch (auto-deploys to live site)
- **`dev`** - Development branch (creates preview deployments)

### Making Changes
1. **Work in dev branch**:
   ```bash
   git checkout dev
   git pull origin dev
   # Make your changes
   git add .
   git commit -m "your changes"
   git push origin dev
   ```

2. **Vercel automatically creates preview deployments** for `dev` branch pushes
   - Preview URL will be visible in GitHub commits/PRs
   - Test your changes in the preview environment

3. **Deploy to production**:
   ```bash
   git checkout main
   git merge dev
   git push origin main
   ```

### Preview Deployment Benefits
- ✅ **Safe testing** - Changes are isolated from production
- ✅ **Automatic previews** - Every dev branch push creates a preview URL
- ✅ **Team collaboration** - Share preview links for review
- ✅ **Zero downtime** - Production remains stable during development

## Troubleshooting

**"Dashboard shows 0 pages checked"**:
- Check if `run_log.json` exists and contains valid data
- Verify `scripts/fetch.py` completed successfully
- Review GitHub Actions logs for errors

**"No email notifications received"**:
- Verify `RESEND_API_KEY` and `RECIPIENT_EMAIL` environment variables
- Check that changes were committed to Git (required for diff detection)
- Review script output for API errors

**"System detecting false positives"**:
- Enable debug mode: `DEBUG_FETCH=1 python3 scripts/fetch.py`
- Review cleaned HTML output in `/tmp/` directory
- Check if dynamic content needs additional filtering in `clean_html()` function

## System Status: ✅ Production Ready

- **Monitoring**: 20 policies across 4 major platforms
- **Accuracy**: Excellent change detection with minimal false positives
- **Reliability**: 95%+ uptime with comprehensive error handling
- **Quality**: Professional AI summaries optimized for mobile email consumption

## Sample Output

**Email Notification Example**:
```
Subject: Policy Update: YouTube

T&S Policy Updates
1 change detected • August 04, 2025 at 19:16 UTC

YOUTUBE
=======

Hiding Users (Updated)
---------------------
• Specific Changes: The entire user feedback form previously located 
  at the bottom of the policy page has been completely removed
• Impact: Users can no longer provide direct feedback about policy 
  clarity or report issues through this interface
• Business Implication: Signals potential shift toward centralized 
  feedback channels or policy finalization

────────────────────────────────────────
View detailed changes at:
https://ts-policy-watcher.vercel.app/
```

## Architecture Overview

**System Flow Diagram**:
```
┌─────────────────┐    ┌──────────────────┐    ┌────────────────────┐
│ GitHub Actions  │───▶│ scripts/fetch.py │───▶│ snapshots/ (Git)   │
│ (6hr Schedule)  │    │ Change Detection │    │ HTML Storage       │
└─────────────────┘    └────────┬─────────┘    └────────────────────┘
                                │
                                ▼
                      ┌─────────────────────┐    ┌─────────────────┐
                      │ scripts/diff_notify │───▶│ Email + Dashboard│
                      │ AI Analysis (Gemini)│    │ Notifications    │
                      └─────────────────────┘    └─────────────────┘
                                │
                                ▼
                ┌──────────────────┐    ┌──────────────────┐
                │ run_log.json     │    │ summaries.json   │
                │ System Health    │    │ AI Intelligence  │
                └──────────────────┘    └──────────────────┘
```

**Key Components**:
- `scripts/fetch.py` - Policy collection with intelligent change detection
- `scripts/diff_and_notify.py` - AI summarization and email notifications  
- `dashboard/` - Static web interface for policy tracking
- `platform_urls.json` - Configuration of monitored policies
- `run_log.json` & `summaries.json` - System data and intelligence storage

## Documentation

This repository contains three comprehensive documents that provide complete context for understanding, maintaining, and extending the system:

- **[Technical Handoff](TECHNICAL_HANDOFF.md)** - Complete technical guide, architecture, debugging, and AI agent onboarding
- **[Product Brief](PRODUCT_BRIEF.md)** - Business case, user stories, implementation approach, and strategic impact

These documents contain all necessary context for developers, AI assistants, or product managers to work effectively with this system.

---

*Built for product managers who need reliable competitive intelligence without the manual overhead.*