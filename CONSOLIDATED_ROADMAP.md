# T&S Policy Watcher: Consolidated Roadmap & Status

## Project Vision

A professional-grade competitive intelligence tool that automatically monitors competitor Trust & Safety policies, detects changes, and provides actionable insights for product management decisions. Focus: **competitor policy change notifications + organized policy comparison**.

---

## Current Status Assessment ✅

### What's Working
- **Core monitoring pipeline**: 15+ policies monitored across 4 platforms (TikTok, Whatnot, YouTube, Instagram)
- **Automated data collection**: Running every 6 hours via GitHub Actions
- **AI-powered summaries**: Using Gemini 2.5-flash for policy change analysis
- **Email notifications**: Resend integration implemented
- **Dashboard foundation**: React-style dashboard with competitive insights focus

### What's Fixed (July 2024)
- ✅ **Dashboard functionality**: Fixed critical JavaScript errors in script.js
- ✅ **Content focus**: Added block/mute policies for key competitors
- ✅ **Intelligence panel**: Replaced internal gap analysis with competitor-focused insights
- ✅ **System health**: Compact status indicator with detailed run log modal

---

## Roadmap Priorities

### 🔥 Phase 1: Core Reliability (COMPLETE)
| Feature | Status | Notes |
|---------|---------|-------|
| Email notifications via Resend | ✅ Complete | Consolidated alerts at end of each run |
| Fix Instagram policies bug | ✅ Complete | Switched to playwright renderer |
| Upgrade AI model | ✅ Complete | Using Gemini 2.5-flash |
| Dashboard UX fixes | ✅ Complete | Fixed JS errors, improved intelligence panel |

### 🎯 Phase 2: Enhanced Intelligence (IN PROGRESS)
| Feature | Status | Priority | Notes |
|---------|---------|----------|-------|
| **Block/Mute policy tracking** | ✅ Complete | High | Added policies across all platforms |
| **Platform comparison insights** | ✅ Complete | High | Real-time platform activity analysis |
| **Policy theme categorization** | ✅ Complete | Medium | Focus on blocking & moderation policies |
| **Matrix cleanup** | 🔄 In Progress | Medium | Remove outdated manual content |

### 🚀 Phase 3: Content Quality & Expansion
| Feature | Status | Priority | Notes |
|---------|---------|----------|-------|
| **AI summary audit** | ⏳ Pending | Medium | Ensure PM-relevant insights |
| **Policy coverage expansion** | ⏳ Pending | Low | Add more competitor-specific policies |
| **Historical trend analysis** | ⏳ Future | Low | Track policy evolution over time |

---

## Key Metrics & Success Criteria

### Operational Health
- **System uptime**: >95% (currently: excellent)
- **Detection accuracy**: No false positives in last 30 days
- **Response time**: Email alerts within 6 hours of policy changes

### Content Quality
- **Policy coverage**: 15+ policies across 4 major competitors
- **Focus alignment**: 80%+ policies relate to blocking, moderation, or enforcement
- **Summary relevance**: PM-actionable insights in all summaries

---

## Technical Architecture

### Core Components
- **GitHub Actions workflow**: Automated scheduling every 6 hours
- **Python pipeline**: Web scraping (httpx + playwright) + AI analysis
- **Static dashboard**: HTML/CSS/JS hosted on GitHub Pages
- **Data storage**: JSON files in repository (summaries.json, run_log.json)

### Key URLs Monitored
- **TikTok**: Community guidelines, Live moderation, Blocking users, Shop policies
- **Whatnot**: Blocking, Enforcement actions, Hate/harassment, Moderation, Reporting
- **YouTube**: Community guidelines, Harassment policy, Shopping ads, User hiding
- **Instagram**: Community guidelines, Blocking, Commerce policies, Appeals

---

## Next Actions (Post-Consolidation)

### Immediate (This Week)
1. **Clean up static policy matrix** - Remove outdated manual entries
2. **Test notification system** with GitHub Actions secrets (RESEND_API_KEY, RECIPIENT_EMAIL)
3. **Validate all competitor URLs** are still accessible and relevant

### Short-term (Next 2 weeks)
1. **Audit AI summaries** for PM relevance and accuracy
2. **Add missing block/mute policies** if any competitors have uncovered policies
3. **Documentation update** - Update README with current status

### Future Considerations
- **Slack integration** as alternative to email
- **Weekly digest emails** for less urgent changes
- **Policy diff visualization** for complex changes
- **Mobile-responsive dashboard** improvements

---

## Dependencies & Requirements

### Environment Variables (GitHub Actions)
- `GEMINI_API_KEY`: Google AI API access
- `GEMINI_API_KEY_2`: Backup API key
- `RESEND_API_KEY`: Email notification service
- `RECIPIENT_EMAIL`: Target email for alerts

### Key Files
- `platform_urls.json`: Monitored policy URLs
- `summaries.json`: AI-generated policy summaries
- `run_log.json`: System health tracking
- `dashboard/`: Static web interface

---

*Last updated: July 2024*
*Status: Core functionality complete, enhancement phase in progress*