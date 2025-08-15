# Development Guide

## Development Workflow with Vercel Preview Deployments

This project follows a **dev branch workflow** with automatic Vercel preview deployments for safe, collaborative development.

## Branch Strategy

### Production Branch (`main`)
- **Purpose**: Production-ready code only
- **Deployment**: Auto-deploys to https://ts-policy-watcher.vercel.app/
- **Protection**: Direct pushes discouraged; use PRs from `dev`

### Development Branch (`dev`)
- **Purpose**: Active development and testing
- **Deployment**: Creates preview deployments on every push
- **Usage**: Primary branch for all feature development

## Development Process

### 1. Setup Development Environment
```bash
# Clone and setup
git clone https://github.com/lyori6/ts-policy-watcher.git
cd ts-policy-watcher

# Switch to dev branch
git checkout dev
git pull origin dev

# Install dependencies
pip install -r requirements.txt
playwright install
```

### 2. Making Changes
```bash
# Always work in dev branch
git checkout dev

# Make your changes to dashboard/, scripts/, etc.
# Test locally: open dashboard/index.html in browser

# Stage and commit
git add .
git commit -m "FEATURE: Add new dashboard component"
git push origin dev
```

### 3. Preview Deployment
- **Automatic**: Vercel creates preview deployment on every `dev` push
- **URL**: Check GitHub commit status or Vercel dashboard for preview URL
- **Testing**: Use preview URL to test changes in live environment

### 4. Deploy to Production
```bash
# Merge dev to main for production deployment
git checkout main
git pull origin main
git merge dev
git push origin main
```

## Vercel Configuration

### vercel.json
```json
{
  "rewrites": [
    {
      "source": "/",
      "destination": "/dashboard/index.html"
    }
  ],
  "git": {
    "deploymentEnabled": {
      "main": true,
      "dev": true
    }
  },
  "github": {
    "silent": false,
    "autoJobCancelation": false
  }
}
```

### .vercelignore
- Excludes heavy files (snapshots/, venv/) from deployments
- Keeps only essential dashboard and data files
- Optimizes build performance

## Development Best Practices

### 1. Dashboard Development
- **Local Testing**: Open `dashboard/index.html` directly
- **Data Sources (simplified)**: Dashboard always fetches data artifacts (`summaries.json`, `run_log.json`, `url_health.json`, `health_alerts.json`) from the `main` branch to avoid dev/main data drift.
  - Preview or local UI changes on `dev` still render against production data from `main`.
  - Console logs active UI branch: "Dashboard using branch: dev" (for asset/code context only).
- **Styling**: Edit `dashboard/style.css` for visual changes
  - Follows Apple-inspired B2B design principles
  - Clean, minimal aesthetics with static cards (no expand/collapse)
- **Functionality**: Edit `dashboard/script.js` for behavior

### 2. Python Scripts
- **Environment**: Always use virtual environment
- **Testing**: Test scripts locally before pushing
- **Debugging**: Use `DEBUG_FETCH=1` for verbose output

### 3. Configuration Changes
- **URLs**: Edit `platform_urls.json` to add/remove monitored policies
  - Use Playwright audit scripts to validate URL health
  - Update broken/redirected links to final destinations
  - Test URLs before deployment to avoid 404 errors
- **Environment**: Update GitHub Actions secrets for API keys

## Common Development Tasks

### Adding New Dashboard Features
1. Work in `dev` branch
2. Edit `dashboard/index.html`, `script.js`, `style.css`
3. Test locally and via preview deployment
4. Merge to `main` when ready

### Modifying Policy Monitoring
1. Update `platform_urls.json`
2. Test with `scripts/fetch.py`
3. Verify changes in `run_log.json`

### Policy URL Audit & Management
1. **Create audit script** to test all policy URLs with Playwright
2. **Identify issues**: Broken links (404), redirected URLs, inaccessible pages
3. **Research correct URLs**: Find updated policy pages on platform help centers  
4. **Update platform_urls.json**: Replace broken URLs with working ones
5. **Verify fixes**: Test updated URLs before deployment

### Debugging Issues
1. Check preview deployment logs in Vercel dashboard
2. Use browser dev tools on preview URL
3. Test data sources: `summaries.json`, `run_log.json` (fetched from `main`)
4. **Branch Context**: Check console for "Dashboard using branch: X" message (affects UI assets only)
5. **Data Consistency**: Dashboard intentionally reads production data from `main` on all branches

## Preview Deployment Benefits

✅ **Risk-Free Development**: Changes isolated from production
✅ **Team Collaboration**: Share preview URLs for review
✅ **Live Testing**: Test with real data in live environment  
✅ **Automatic**: Zero manual deployment steps
✅ **Fast Feedback**: Immediate preview URL on push
✅ **Branch-Aware Data**: Dev preview automatically uses dev branch data

## Enhanced Development Tools

### Link Auditing with Playwright
```python
# Create comprehensive audit script
python audit_links.py  # Tests all URLs in platform_urls.json

# Quick fix verification  
python test_fixed_urls.py  # Tests specific updated URLs
```

### Dashboard Debugging
- **Console Logging**: Check browser console for branch detection
- **Network Tab**: Verify correct GitHub raw URLs being fetched
- **Branch Detection**: Look for "Dashboard using branch: X" message

### Policy URL Management
```bash
# Test individual policy URLs
playwright codegen --target python-async {policy_url}

# Validate URL changes
python -c "import asyncio; from playwright.async_api import async_playwright; # test code"
```

## Troubleshooting Development

### Preview Deployment Not Working
- Check Vercel dashboard for build errors
- Verify `.vercelignore` is not excluding needed files
- Ensure `vercel.json` configuration is valid

### Local Dashboard Issues  
- Verify data files exist: `summaries.json`, `run_log.json`
- Check browser console for JavaScript errors
- Ensure file paths are correct in `script.js`
- **Snapshot Links**: History links point to `snapshots/production/{policy-slug}` structure

### Data Architecture Notes
- **Snapshots**: Organized as `snapshots/production/` and `snapshots/development/` (dev is for local script testing only)
- **GitHub Links**: Dashboard history buttons link to production snapshots on `main`
- **Data Branching**: Dashboard always fetches data artifacts from `main` regardless of preview branch

### Git Workflow Issues
```bash
# Reset if dev branch gets messy
git checkout dev
git reset --hard origin/main
git push -f origin dev

# Or create fresh dev branch
git checkout main
git branch -D dev
git checkout -b dev
git push -u origin dev
```

---

## 🚨 Link Health Monitoring System Implementation

**Case Study: Eliminating Silent Monitoring Failures**

### Problem Discovered
During Meta renaming work, discovered broken Instagram Commerce Policies URL (`404 Not Found`) that was causing silent monitoring failures. Our system was running without detecting this critical issue.

### Solution Approach
Implementing comprehensive link health monitoring system in phases:

- **Phase 1** ✅ Foundation & Immediate Fixes
  - [x] Meta icon display investigation 
  - [x] Basic error classification in fetch.py
  - [x] Enhanced failure logging
  - [x] **CRITICAL FIX**: Playwright HTTP status checking bug resolved
  - [x] Smart retry logic - no more pointless 404/403 retries
  - [x] All Phase 1 tests passing (5/5) - ready for deployment

- **Phase 2** 🔄 Proactive Health Monitoring  
  - [ ] Daily link health checks
  - [ ] Multi-channel notifications (policy changes vs system health)
  - [ ] Health status dashboard integration

- **Phase 3** ⏳ Automated Maintenance
  - [ ] Smart URL replacement discovery
  - [ ] Self-healing capabilities  
  - [ ] Automated retry logic

- **Phase 4** ⏳ Operational Excellence
  - [ ] Comprehensive monitoring dashboard
  - [ ] Zero-maintenance workflows
  - [ ] 99.5% URL uptime target

### Implementation Log

#### 2025-01-07: Investigation & Implementation Phase
- **Meta Icon Issue**: ✅ Fixed Font Awesome version upgrade to 6.6.0
- **System Audit**: ✅ Complete analysis of fetch.py error handling gaps
- **Failure Testing**: ✅ Confirmed critical Playwright HTTP status bug
- **Phase 1 Implementation**: ✅ Fixed Playwright status checking + error classification
- **Validation Testing**: ✅ All Phase 1 tests passing (5/5) - ready for deployment

#### Next Milestones  
- [x] Complete Phase 1 implementation
- [ ] Deploy Phase 1 fixes to dev branch
- [ ] Establish system health alerts (Phase 2)
- [ ] Achieve zero silent failures target

**Success Metrics**: 0 silent failures, 99.5% URL uptime, <1hr mean time to detection

**Documentation**: See `LINK_HEALTH_MONITORING_PLAN.md` for complete technical plan

---

*This development workflow ensures safe, collaborative development while maintaining production stability.*