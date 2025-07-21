# T&S Policy Watcher: Consolidated Roadmap & Status

## Project Vision

A professional-grade competitive intelligence tool that automatically monitors competitor Trust & Safety policies, detects changes, and provides actionable insights for product management decisions. Focus: **competitor policy change notifications + organized policy comparison**.

---

## Current Status Assessment ✅ **SYSTEM OPERATIONAL**

### What's Working (December 2024)
- **Core monitoring pipeline**: 20+ policies monitored across 4 platforms (TikTok, Whatnot, YouTube, Instagram)
- **Automated data collection**: Running every 6 hours via GitHub Actions with 95%+ uptime
- **AI-powered summaries**: Using Gemini 2.5-flash with backup key support and intelligent filtering
- **Email notifications**: Fully operational Resend integration with markdown-to-HTML conversion and platform grouping
- **Complete dashboard**: Feature-rich UI with policy matrix, trend analysis, focus areas, and real-time operational status

### What's Recently Completed (December 2024)
- ✅ **Email markdown rendering**: Fixed AI summaries now render properly formatted in emails
- ✅ **Dashboard UI overhaul**: Moved operational stats to header status bar, improved layout and responsiveness
- ✅ **Focus area redesign**: Concise PM-focused summary of monitoring scope
- ✅ **Policy matrix improvements**: Enhanced with status-based view controls and better organization
- ✅ **JavaScript error resolution**: Fixed setupModal error and improved code reliability
- ✅ **Enhanced change detection**: Smart filtering to reduce noise while maintaining sensitivity

---

## Roadmap Priorities

### 🔥 Phase 1: Core System & Reliability (✅ COMPLETE)
| Feature | Status | Notes |
|---------|---------|-------|
| Email notifications via Resend | ✅ Complete | Markdown-to-HTML conversion, platform grouping, smart filtering |
| Instagram policies bug fix | ✅ Complete | Switched to playwright renderer for JavaScript sites |
| AI model upgrade | ✅ Complete | Using Gemini 2.5-flash with backup key support |
| Dashboard UX fixes | ✅ Complete | Complete UI overhaul with operational status bar |

### 🎯 Phase 2: Enhanced Intelligence & UX (✅ COMPLETE)
| Feature | Status | Priority | Notes |
|---------|---------|----------|-------|
| **Block/Mute policy tracking** | ✅ Complete | High | Comprehensive coverage across all platforms |
| **Platform comparison insights** | ✅ Complete | High | Real-time trend analysis and platform activity |
| **Policy theme categorization** | ✅ Complete | Medium | Focus on user safety, blocking & moderation |
| **Dashboard UI overhaul** | ✅ Complete | High | Header status bar, improved navigation, responsive design |
| **Email formatting improvements** | ✅ Complete | High | Markdown rendering, platform grouping, concise summaries |

### 🚀 Phase 3: Optimization & Quality (🔄 CURRENT FOCUS)
| Feature | Status | Priority | Notes |
|---------|---------|----------|-------|
| **Change detection refinement** | 🔄 In Progress | High | Reduce false positives, improve diff accuracy |
| **AI summary quality audit** | ⏳ Pending | Medium | Ensure PM-relevant insights in all notifications |
| **Historical trend analysis** | ⏳ Future | Low | Track policy evolution patterns over time |
| **Performance optimization** | ⏳ Future | Low | Faster loading, caching improvements |

---

## Key Metrics & Success Criteria

### Operational Health ✅
- **System uptime**: >95% (currently: excellent, automated monitoring every 6 hours)
- **Email delivery**: 100% successful notification delivery via Resend
- **Response time**: Email alerts within 6 hours of policy changes
- **Dashboard availability**: 99%+ uptime on Vercel hosting

### Content Quality 🔧
- **Policy coverage**: 20+ policies across 4 major competitors
- **Focus alignment**: 90%+ policies relate to blocking, moderation, or enforcement
- **Summary relevance**: PM-actionable insights with markdown formatting
- **Detection accuracy**: Currently experiencing some false positives - optimization needed

---

## Technical Architecture

### Core Components ✅
- **GitHub Actions workflow**: Automated scheduling every 6 hours with environment variable management
- **Python pipeline**: Web scraping (httpx + playwright) + AI analysis with intelligent change detection
- **Static dashboard**: HTML/CSS/JS hosted on Vercel with real-time status monitoring
- **Email service**: Resend integration with markdown-to-HTML conversion and platform grouping
- **Data storage**: JSON files in repository (summaries.json, run_log.json, platform_urls.json)

### Key URLs Monitored
- **TikTok**: Community guidelines, Live moderation, Blocking users, Shop policies
- **Whatnot**: Blocking, Enforcement actions, Hate/harassment, Moderation, Reporting
- **YouTube**: Community guidelines, Harassment policy, Shopping ads, User hiding
- **Instagram**: Community guidelines, Blocking, Commerce policies, Appeals

---

## Next Actions (Current Phase Focus)

### 🔥 Immediate Priority: Change Detection Optimization
1. **Refine diff algorithm** - Reduce false positives from cosmetic changes
2. **Improve content filtering** - Better distinguish substantive policy changes from navigation/formatting updates
3. **Test detection thresholds** - Calibrate sensitivity to minimize noise while maintaining coverage

### 🎯 Short-term Improvements
1. **AI summary quality audit** - Review recent summaries for PM relevance and actionable insights
2. **Performance monitoring** - Track false positive rates and adjust detection logic
3. **URL validation** - Ensure all tracked competitor URLs remain accessible and relevant

### 🚀 Future Enhancements
- **Slack integration** as alternative to email notifications
- **Weekly digest emails** with trend analysis for strategic planning
- **Policy diff visualization** for complex multi-section changes
- **Historical pattern analysis** to predict competitor policy trends
- **Mobile app** for on-the-go competitive intelligence access

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

*Last updated: December 2024*
*Status: System fully operational, optimization phase in progress*
*Next focus: Change detection accuracy improvements*