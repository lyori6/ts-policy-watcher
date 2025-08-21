# Architecture Decisions & Design History

**A consolidated record of key technical decisions made during system development.**

---

## Health Monitoring Architecture (Phase 4 - Completed)

**Decision**: Implement integrated health monitoring with non-blocking design
**Rationale**: Prevent silent failures where broken URLs stop policy monitoring without notification
**Implementation**: 
- Pre-flight HEAD requests before content monitoring
- Health alerts combined with policy notifications
- Dashboard shows simple "Operational" status for external users

**Key Design Choices**:
- Health failures don't block content monitoring (non-blocking)
- Health data committed to Git alongside snapshots
- Visual health alert banners with auto-dismiss functionality

---

## Content Change Detection (Phase 1-3)

**Decision**: Multi-layered HTML cleaning with intelligent change detection
**Rationale**: Distinguish meaningful policy changes from cosmetic website updates
**Implementation**: BeautifulSoup-based content extraction with noise filtering

---

## AI Summarization Strategy (Phase 2)

**Decision**: Google Gemini API for product manager-focused summaries  
**Rationale**: Generate strategic insights rather than raw technical diffs
**Implementation**: Structured prompts optimizing for PM decision-making context

---

## Notification Architecture (Phase 2-4)

**Decision**: Single unified email combining policy changes and health alerts
**Rationale**: Reduce notification fatigue while ensuring comprehensive coverage
**Implementation**: Plain text emails optimized for mobile consumption

---

## Dashboard Design Philosophy (Phase 3-4)

**Decision**: Static dashboard with branch-aware data loading
**Rationale**: Zero-maintenance deployment with development/production separation
**Implementation**: 
- Vercel hosting with automatic deployments
- Direct GitHub raw content API consumption
- Branch detection for dev vs production data

---

## Files Consolidated

The following architectural documents were consolidated into this summary:
- `PHASE2_DESIGN.md` → Core design decisions captured above
- `LINK_HEALTH_MONITORING_PLAN.md` → Health monitoring implementation completed
- `SNAPSHOT_ARCHITECTURE_IMPROVEMENT.md` → Improvements implemented in production
- `FETCH_ERROR_ANALYSIS.md` → Error patterns resolved with health monitoring

For comprehensive implementation details, see:
- **`TECHNICAL_HANDOFF.md`** → Complete system architecture and setup guide
- **`PRODUCT_BRIEF.md`** → Business case and strategic impact
- **`DEVELOPMENT.md`** → Development workflow and contribution guide