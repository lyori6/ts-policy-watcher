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
- **Data Sources**: Uses live GitHub raw files (summaries.json, run_log.json)
- **Styling**: Edit `dashboard/style.css` for visual changes
- **Functionality**: Edit `dashboard/script.js` for behavior

### 2. Python Scripts
- **Environment**: Always use virtual environment
- **Testing**: Test scripts locally before pushing
- **Debugging**: Use `DEBUG_FETCH=1` for verbose output

### 3. Configuration Changes
- **URLs**: Edit `platform_urls.json` to add/remove monitored policies
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

### Debugging Issues
1. Check preview deployment logs in Vercel dashboard
2. Use browser dev tools on preview URL
3. Test data sources: summaries.json, run_log.json

## Preview Deployment Benefits

✅ **Risk-Free Development**: Changes isolated from production
✅ **Team Collaboration**: Share preview URLs for review
✅ **Live Testing**: Test with real data in live environment  
✅ **Automatic**: Zero manual deployment steps
✅ **Fast Feedback**: Immediate preview URL on push

## Troubleshooting Development

### Preview Deployment Not Working
- Check Vercel dashboard for build errors
- Verify `.vercelignore` is not excluding needed files
- Ensure `vercel.json` configuration is valid

### Local Dashboard Issues  
- Verify data files exist: `summaries.json`, `run_log.json`
- Check browser console for JavaScript errors
- Ensure file paths are correct in `script.js`

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

*This development workflow ensures safe, collaborative development while maintaining production stability.*