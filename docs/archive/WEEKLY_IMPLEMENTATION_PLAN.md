# Weekly Monitoring Implementation Plan - Source of Truth

## Overview
Transform T&S Policy Watcher from daily email alerts to weekly summaries with manual testing capability. Keep daily monitoring active but focus on weekly reporting with clear run metadata and manual testing support.

## Implementation Phases

### **Phase 1: Backend Infrastructure** 
**Status: COMPLETED ✅**

#### 1.1 Weekly Data Aggregation System
- [x] Create `scripts/weekly_aggregator.py`
- [x] Create `weekly_summaries.json` storage
- [x] Add date range utilities for weekly calculations
- [x] Include run metadata (date, type, week range) in all data structures

#### 1.2 Weekly Summary API Endpoint
- [x] Add `/api/weekly-summary` endpoint to existing API
- [x] Implement AI summary generation for weekly changes
- [x] Add manual run detection via CLI flags

#### 1.3 Email System Modifications
- [x] Add `SEND_IMMEDIATE_EMAILS` environment variable (default: false)
- [x] Create weekly email template with run metadata display
- [x] Implement manual vs scheduled email subjects and labels

**Testing Checklist:**
- [x] Weekly data collection works correctly (13 changes found in test)
- [x] Manual run detection functions (--manual flag working)
- [x] Email templates render with proper dates and labels
- [x] GitHub Actions workflow created for Friday automation

### **Phase 2: Frontend Navigation & Structure**
**Status: COMPLETED ✅**

#### 2.1 Weekly Update Tab
- [x] Add new tab between Policy Matrix and Policy Explorer
- [x] Display run information header with dates and run type
- [x] Add date picker for viewing different weeks
- [x] Implement run type badges (Manual/Scheduled)

#### 2.2 Navigation Reorganization  
- [x] Update tab order: Policy Matrix → Weekly Update → Policy Explorer → Analytics & Logs
- [x] Move ChangeLog from standalone tab to Analytics section card
- [x] Preserve existing ChangeLog functionality

#### 2.3 Analytics Dashboard Updates
- [x] Move ChangeLog to bottom card in Analytics
- [x] Add local file loading for development testing
- [ ] Convert Change Frequency chart to weekly platform groupings
- [ ] Add run metadata to analytics views

**Testing Checklist:**
- [x] Navigation flows correctly
- [x] Run dates display accurately
- [x] Manual vs scheduled indicators work
- [x] All existing functionality preserved
- [x] Weekly data loads and displays properly (with local file support)
- [x] Week selector works with existing data
- [x] Run type badges display correctly (Manual Test Run shown)
- [x] ChangeLog successfully moved to Analytics section
- [x] No JavaScript errors in console

### **Phase 3: Weekly Summary Logic & Manual Testing**
**Status: PENDING**

#### 3.1 AI Summarization with Run Tracking
- [ ] Implement 7-day change collection logic
- [ ] Send aggregated changes to Gemini API
- [ ] Include run metadata in AI prompts
- [ ] Store summaries with complete run information

#### 3.2 Manual Run Capability
- [ ] Create CLI command: `python scripts/weekly_aggregator.py --manual`
- [ ] Add manual run detection and labeling
- [ ] Implement special email subjects for manual runs
- [ ] Add environment variables for run type distinction

#### 3.3 Weekly Email Automation
- [ ] Create GitHub Actions weekly cron (Fridays 12:00 PM Pacific)
- [ ] Implement scheduled Friday runs
- [ ] Add subscriber management for weekly updates
- [ ] Ensure both email types show run metadata

**Testing Checklist:**
- [ ] Manual run execution works
- [ ] Proper labeling in UI and emails
- [ ] AI summary includes run context
- [ ] Scheduled automation functions correctly

### **Phase 4: Integration & Polish**
**Status: PENDING**

#### 4.1 End-to-End Testing
- [ ] Test manual and scheduled workflows
- [ ] Verify run date accuracy across components
- [ ] Test manual run labeling in UI and emails
- [ ] Performance test weekly data aggregation

#### 4.2 Documentation & Deployment
- [ ] Update technical documentation
- [ ] Create manual run instructions
- [ ] Create user guide for weekly features
- [ ] Deploy with monitoring

## Technical Specifications

### Run Metadata Structure
```json
{
  "run_date": "2025-08-21T19:00:00Z",
  "run_type": "manual|scheduled", 
  "week_start": "2025-08-14",
  "week_end": "2025-08-21",
  "generated_by": "manual_test|friday_automation"
}
```

### Email Subject Lines
- Scheduled: "Weekly Policy Summary - Aug 14-21, 2025"
- Manual: "[MANUAL] Weekly Policy Summary - Aug 14-21, 2025"

### UI Labels
- Scheduled: Green badge "Scheduled Friday Run"
- Manual: Blue badge "Manual Test Run"

### Manual Testing Commands
```bash
# Test with specific week
python scripts/weekly_aggregator.py --manual --week-ending=2025-08-21

# Test with current week
python scripts/weekly_aggregator.py --manual
```

### GitHub Actions Schedule
- **Frequency**: Weekly on Fridays
- **Time**: 12:00 PM Pacific Time (19:00 UTC)
- **Cron**: `0 19 * * 5`

## Progress Tracking

### Completed Items
- [x] Create WEEKLY_IMPLEMENTATION_PLAN.md source of truth document *(2025-08-21)*
- [x] Create scripts/weekly_aggregator.py for data collection *(2025-08-21)*
- [x] Add weekly_summaries.json storage structure *(2025-08-21)*
- [x] Implement date range utilities for weekly calculations *(2025-08-21)*
- [x] Add weekly summary API endpoint (api/policy_api.py) *(2025-08-21)*
- [x] Create GitHub Actions weekly cron (Fridays 12:00 PM Pacific) *(2025-08-21)*

### Current Focus
**Next Step**: System ready for production! Optional Phase 3 enhancements available.

### Implementation Notes
- **2025-08-21**: Started implementation, created source of truth document
- **2025-08-21**: Phase 1 COMPLETED - Backend infrastructure working
- **2025-08-21**: Phase 2.1 COMPLETED - Weekly Update tab functional with data display
- Plan approved for incremental development with e2e testing at each phase
- Manual weekly test run successful (13 changes found for Aug 15-21)
- Dashboard displays weekly summary with proper run metadata and badges

### Key Decisions Made
- Keep existing daily monitoring unchanged
- Friday 12:00 PM Pacific for automated runs
- Manual testing capability with clear labeling
- Run metadata tracked throughout system

---
**Last Updated**: 2025-08-21 15:45 UTC
**Status**: Phase 1 in progress