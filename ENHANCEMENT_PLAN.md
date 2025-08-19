# T&S Policy Watcher Enhancement Plan

*Created: 2025-08-10*
*Status: Ready for Implementation*

## **Phase 1: Critical URL Fixes & Infrastructure (Priority: HIGH)**
*Estimated Time: 15-20 minutes*

### 1.1 Fix Broken YouTube URLs ⚠️
- **Issue**: 2 YouTube URLs consistently returning 404 errors
- **Action**: Remove problematic URLs from `platform_urls.json`
  - Remove `youtube-harassment-policy` (9 consecutive failures)
  - Remove `youtube-shopping-ads-requirements` (9 consecutive failures)
- **Files**: `platform_urls.json`
- **Impact**: Eliminates noise from health monitoring, improves system uptime metrics

### 1.2 Verify Health JSON Files for Production
- **Issue**: Ensure health monitoring files are accessible in production
- **Action**: Update `.vercelignore` to include health monitoring files
  - Add `!url_health.json`
  - Add `!health_alerts.json`
- **Files**: `.vercelignore`
- **Impact**: Dashboard health features work in production

---

## **Phase 2: Dashboard UI/UX Improvements (Priority: MEDIUM)**
*Estimated Time: 45-60 minutes*

### 2.1 Fix Platform Icons
- **Issue**: Meta and Whatnot icons not displaying correctly
- **Action**: Update `getPlatformIcon()` function in `dashboard/script.js`
  - Change Meta: `'fab fa-meta'` → `'fab fa-facebook'`
  - Change Whatnot: `'fas fa-gavel'` → `'fas fa-store'`
- **Files**: `dashboard/script.js` (line ~558)
- **Impact**: Icons render correctly across Policy Matrix and insight cards

### 2.2 Make Cards Collapsed by Default
- **Issue**: Cards should only show content up to the grey line initially
- **Action**: Implement collapsible card functionality
  - Add CSS for collapsed state in `dashboard/style.css`
  - Add JavaScript toggle functionality in `dashboard/script.js`
  - Update card structure in `dashboard/index.html`
- **Files**: All dashboard files
- **Impact**: Cleaner initial view, better information hierarchy

### 2.3 Link Policy Names to Source URLs
- **Issue**: Latest Key Change policy names should be clickable
- **Action**: Update `renderLatestKeyChangeInsight()` function
  - Find URL from `platformData` using slug
  - Wrap policy name in `<a target="_blank" rel="noopener noreferrer">`
- **Files**: `dashboard/script.js` (line ~843)
- **Impact**: Direct access to source policies from dashboard

### 2.4 CSV Export Safety Guard
- **Issue**: Potential array bounds issue in CSV export
- **Action**: Update `exportMatrix()` function
  - Change condition from `cells.length >= 7` to `cells.length >= 8`
- **Files**: `dashboard/script.js` (line ~1331)
- **Impact**: Prevents malformed CSV downloads

### 2.5 ESC Key Modal Accessibility
- **Action**: Add keyboard event listener for modal dismissal
  - Add `document.addEventListener('keydown', ...)` for Escape key
  - Close `policy-summary-modal` and `run-log-modal` on ESC
- **Files**: `dashboard/script.js`
- **Impact**: Better keyboard accessibility

### 2.6 Sticky Header for Policy Matrix
- **Action**: Add sticky positioning to table header
  - Apply `position: sticky; top: 0; z-index: 1;` to thead
- **Files**: `dashboard/style.css`
- **Impact**: Better readability when scrolling large tables

### 2.7 Environment Badge
- **Action**: Add dev/preview badge to header
  - Show "Preview (dev)" badge when not on main branch
  - Update `dashboard/index.html`, `script.js`, and `style.css`
- **Files**: All dashboard files
- **Impact**: Clear distinction between development and production

### 2.8 Add Column Tooltips
- **Action**: Add helpful tooltips to Policy Matrix column headers
  - Add `title` attributes to "Coverage", "Key Features", "Enforcement" columns
- **Files**: `dashboard/index.html`
- **Impact**: Better user understanding of data categories

---

## **Phase 3: System Performance & Monitoring (Priority: LOW)**
*Estimated Time: 20-30 minutes*

### 3.1 Health Check Timeout Configuration
- **Action**: Add configurable timeout settings
  - Add timeout parameters to `health_check.py`
  - Optimize for faster health check cycles
- **Files**: `scripts/health_check.py`
- **Impact**: More responsive health monitoring

### 3.2 Performance Metrics Dashboard
- **Action**: Add simple response time trending
  - Create basic performance visualization
  - Show competitor site performance patterns
- **Files**: Dashboard files
- **Impact**: Insight into competitor site performance trends

### 3.3 URL Validation Helper Script
- **Action**: Create validation script for URL configuration
  - Simple script to test all URLs in `platform_urls.json`
  - Catch broken URLs before they affect monitoring
- **Files**: New script file
- **Impact**: Proactive URL health validation

---

## **Acceptance Criteria & QA Checklist**

### **Critical (Must Pass)**
- [ ] No 404 errors in health monitoring logs
- [ ] Health data accessible in production dashboard
- [ ] Platform icons display correctly in all locations
- [ ] Cards collapse/expand properly

### **Important (Should Pass)**  
- [ ] Policy names link to source URLs correctly
- [ ] CSV export generates exactly 8 columns per row
- [ ] ESC key closes modals
- [ ] Sticky header works on scroll
- [ ] Environment badge shows on dev, hidden on main

### **Nice to Have**
- [ ] Column tooltips provide helpful information
- [ ] Health checks complete faster with optimized timeouts
- [ ] Performance metrics show in dashboard

---

## **Implementation Strategy**
1. **Start with Phase 1** - Fix critical infrastructure issues
2. **Implement Phase 2 incrementally** - One UI improvement at a time
3. **Phase 3 as time permits** - Performance enhancements

**Total Estimated Time: 80-110 minutes**
**Recommended Session: 2-3 focused work blocks**

---

## **Implementation Log**
- [ ] 2025-08-10: Plan created and documented
- [ ] Phase 1.1: Fix broken YouTube URLs
- [ ] Phase 1.2: Update .vercelignore for health files
- [ ] Phase 2.1: Fix platform icons
- [ ] Phase 2.2: Implement collapsible cards
- [ ] Phase 2.3: Link policy names to URLs
- [ ] Phase 2.4: Add CSV export safety
- [ ] Phase 2.5: Add ESC key functionality
- [ ] Phase 2.6: Add sticky header
- [ ] Phase 2.7: Add environment badge
- [ ] Phase 2.8: Add column tooltips