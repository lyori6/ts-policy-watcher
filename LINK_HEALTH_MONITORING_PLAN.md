# Link Health Monitoring & Broken URL Detection System

**A comprehensive plan to eliminate silent monitoring failures and ensure 100% policy URL uptime**

---

## 🚨 Executive Summary

Our Trust & Safety policy monitoring system has a critical blind spot: broken URLs cause silent failures, potentially missing important competitor policy changes. This document outlines a systematic approach to detect, alert on, and automatically maintain policy URL health.

**Goal**: Transform from reactive broken link fixing to proactive monitoring health management.

---

## 1. Problem Statement & Current Risk Analysis

### 1.1 The Silent Failure Problem

**What Happened**: Meta Commerce Policies URL (`https://help.instagram.com/1627591227523036`) returned "This Page Isn't Available" but our system continued running without alerts.

**Impact**: 
- We were unknowingly not monitoring a key competitor policy
- No visibility into monitoring system health
- Discovered broken link only during manual audit
- Could miss critical competitor policy changes indefinitely

### 1.2 Current Risk Assessment

| **Risk Level** | **Scenario** | **Impact** | **Current Detection** |
|----------------|--------------|------------|---------------------|
| 🔴 **HIGH** | Silent 404s on policy URLs | Miss competitor changes | None - discovered manually |
| 🟡 **MEDIUM** | Network timeouts/SSL errors | Intermittent monitoring gaps | Logged but not alerted |
| 🟢 **LOW** | Temporary site maintenance | Brief monitoring pause | Retry logic exists |

### 1.3 Scale of the Problem

- **Current monitoring**: 25+ policy URLs across 4 platforms
- **Manual maintenance**: No systematic health checking
- **Discovery method**: Accidental (during unrelated work)
- **Mean time to detection**: Unknown (could be weeks/months)

---

## 2. Current System Deep Audit

### 2.1 fetch.py Error Handling Analysis

**Current Behavior** (needs verification):
```python
# Likely current approach
response = await page.goto(policy['url'])
if response.status != 200:
    # What happens here? Log only? Skip? Fail silently?
```

**Questions to investigate**:
- How are HTTP 404/403/500 errors handled?
- Are network timeouts retried?
- Do failures get logged to run_log.json?
- Are persistent failures tracked across runs?

### 2.2 Notification System Gap Analysis

**Current Notifications**:
- ✅ Policy content changes → Email via Resend
- ❌ Broken URLs → No notification
- ❌ System health issues → No visibility  
- ❌ Persistent failures → No tracking

**Notification Channels**:
- **Policy Changes**: Professional email summaries
- **System Health**: Missing entirely
- **Maintenance Alerts**: No system

### 2.3 Manual Link Maintenance

**Current Process**:
1. Broken link discovered accidentally
2. Manual research for replacement URL
3. Update `platform_urls.json`
4. No systematic validation

**Problems**:
- Reactive, not proactive
- No early warning system
- Scales poorly (25+ URLs, growing)
- Human error prone

---

## 3. Comprehensive Solution Architecture

### Phase 1: Immediate Fixes & Foundation
**Timeline**: 1-2 days
**Goal**: Stop current bleeding, establish foundation

#### 3.1.1 Fix Meta Icon Display
- Investigate Font Awesome version compatibility
- Ensure `fab fa-meta` icon loads correctly
- Test across different Font Awesome CDN versions

#### 3.1.2 Enhanced Error Handling in fetch.py
```python
class PolicyFetchResult:
    success: bool
    url: str
    status_code: int
    error_type: str  # 'network', 'http_error', 'timeout', 'content_blocked'
    content: str
    retry_count: int
    timestamp: datetime
```

#### 3.1.3 Basic Broken Link Detection
- Classify HTTP responses: 200 (OK), 404 (broken), 403 (blocked), timeout
- Log all failures with classification
- Add failure tracking to run_log.json

### Phase 2: Proactive Health Monitoring System
**Timeline**: 3-5 days  
**Goal**: Systematic health checking independent of policy monitoring

#### 3.2.1 Daily Link Health Checks
```python
# New script: scripts/health_check.py
class LinkHealthChecker:
    async def check_all_urls(self):
        # Quick HEAD requests to all policy URLs
        # Separate from content fetching
        # Focus only on accessibility
    
    async def classify_failures(self):
        # 404: Broken link (immediate alert)
        # 403: Access blocked (investigate)
        # Timeout: Network issue (retry logic)
        # 5xx: Server error (temporary?)
```

#### 3.2.2 Multi-Channel Notification System
- **Policy Changes**: Existing email system (unchanged)
- **System Health**: New Slack/email channel for broken links
- **Dashboard Integration**: Visual health status indicators

#### 3.2.3 Health Status Dashboard
- Real-time URL accessibility status
- Historical uptime per policy URL
- Last successful check timestamps
- Failure pattern analysis

### Phase 3: Automated Maintenance Workflows  
**Timeline**: 5-7 days
**Goal**: Self-healing and automated URL maintenance

#### 3.3.1 Smart URL Replacement Discovery
```python
class URLMaintenance:
    async def find_replacement_url(self, broken_url, policy_name, platform):
        # Try common URL pattern variations
        # Search platform help centers
        # Use Archive.org for historical URLs
        # Return suggested replacements
```

#### 3.3.2 Automated Retry & Recovery
- Exponential backoff for transient failures
- Alternative URL attempts for same policy
- Graceful degradation when primary URL fails

#### 3.3.3 Self-Healing Capabilities
- Try alternative URLs for same policy content
- Archive.org fallback for temporary outages  
- Automated policy URL research workflows

### Phase 4: Operational Excellence
**Timeline**: 7-10 days
**Goal**: Zero-maintenance health monitoring

#### 3.4.1 Comprehensive Monitoring Dashboard
- Policy monitoring uptime (target: 99.5%+)
- URL health trends and patterns
- Alert fatigue prevention (smart grouping)
- Maintenance task automation

#### 3.4.2 Automated Maintenance Workflows
- Weekly comprehensive URL audits
- Quarterly policy URL freshness reviews
- Integration with competitive research workflows
- Automated documentation updates

---

## 4. Technical Implementation Details

### 4.1 Error Classification System

```python
class URLHealthStatus:
    HEALTHY = "healthy"           # 200 OK
    DEGRADED = "degraded"         # Slow but working
    BROKEN = "broken"             # 404, dead link
    BLOCKED = "blocked"           # 403, access denied  
    MAINTENANCE = "maintenance"   # 5xx, temporary
    UNKNOWN = "unknown"          # Network timeout, DNS
```

### 4.2 Enhanced Logging Schema

```json
{
  "url_health_check": {
    "timestamp": "2025-01-07T10:30:00Z",
    "url": "https://example.com/policy",
    "status": "broken",
    "status_code": 404,
    "response_time_ms": 1250,
    "retry_count": 3,
    "error_details": "Page not found",
    "suggested_alternatives": ["https://example.com/new-policy"]
  }
}
```

### 4.3 Notification Templates

#### System Health Alert
```
🚨 Policy Monitoring Alert

BROKEN LINK DETECTED:
• Platform: Meta
• Policy: Commerce Policies  
• URL: https://help.instagram.com/1627591227523036
• Error: 404 Not Found
• Duration: 2 days
• Impact: Missing competitor commerce policy monitoring

SUGGESTED ACTION:
• Research replacement URL for Meta commerce policies
• Update platform_urls.json with working link
• Verify new URL accessibility

Dashboard: https://ts-policy-watcher.vercel.app/health
```

### 4.4 Self-Healing URL Discovery

```python
async def discover_replacement_url(broken_url, policy_info):
    """Smart URL replacement discovery"""
    
    strategies = [
        # Try common URL pattern variations
        lambda: try_url_variations(broken_url),
        
        # Search platform help centers
        lambda: search_help_center(policy_info.platform, policy_info.name),
        
        # Use Archive.org historical URLs
        lambda: find_archived_versions(broken_url),
        
        # Research competitor policy pages
        lambda: research_policy_pages(policy_info.platform, policy_info.keywords)
    ]
    
    for strategy in strategies:
        candidates = await strategy()
        if candidates:
            return await validate_candidates(candidates)
    
    return None
```

---

## 5. Testing Strategy

### 5.1 Unit Testing Approach

```python
# Test error classification
def test_error_classification():
    assert classify_response(404) == URLHealthStatus.BROKEN
    assert classify_response(200) == URLHealthStatus.HEALTHY
    assert classify_response(500) == URLHealthStatus.MAINTENANCE

# Test retry logic  
def test_retry_logic():
    # Verify exponential backoff
    # Test max retry limits
    # Validate failure escalation
```

### 5.2 Integration Testing

#### 5.2.1 Safe Testing Environment
- Test with dedicated test URLs (httpbin.org/status/404)
- Isolated test configuration
- No impact on production monitoring

#### 5.2.2 Failure Simulation
- Simulate various HTTP error codes
- Test network timeout scenarios
- Validate notification delivery

#### 5.2.3 End-to-End Testing
- Full health check workflow
- Notification system integration  
- Dashboard updates verification

### 5.3 Gradual Rollout Plan

#### Week 1: Foundation
- Fix Meta icon issue
- Implement basic error classification
- Add failure logging

#### Week 2: Health Monitoring
- Deploy daily health checks
- Set up system health notifications
- Add basic dashboard integration

#### Week 3: Automation
- Implement smart URL discovery
- Add self-healing capabilities
- Full monitoring dashboard

#### Week 4: Optimization
- Tune alert thresholds
- Optimize performance
- Complete documentation

### 5.4 Rollback Procedures

- Graceful degradation to current system
- Feature flags for new functionality
- Independent deployment of each phase
- Zero impact on existing policy monitoring

---

## 6. Success Metrics & KPIs

### 6.1 Primary Success Metrics

| **Metric** | **Current** | **Target** | **Measurement** |
|------------|-------------|------------|-----------------|
| Silent Failures | Unknown | 0 | Weekly health audits |
| URL Uptime | Unknown | 99.5% | Continuous monitoring |
| Mean Time to Detection | Days/weeks | < 1 hour | Automated alerts |
| Mean Time to Resolution | Manual, slow | < 4 hours | Self-healing + alerts |

### 6.2 Operational Metrics

- **Alert Accuracy**: % of alerts that require action (target: >80%)
- **Maintenance Overhead**: Hours/week spent on URL maintenance (target: <1 hour)
- **System Reliability**: Policy monitoring uptime (target: 99.9%)
- **Coverage**: % of policy URLs health-checked daily (target: 100%)

### 6.3 Business Impact Metrics

- **Competitive Blind Spots**: Number of unmonitored policies due to broken links (target: 0)
- **Policy Change Detection**: % of competitor changes detected within 24 hours (target: 95%)
- **Research Efficiency**: Time saved on manual URL maintenance (measure: hours/month)

---

## 7. Implementation Risks & Mitigation

### 7.1 High-Risk Areas

#### Risk: Breaking Existing Functionality
- **Mitigation**: Feature flags, gradual rollout, comprehensive testing
- **Rollback**: Independent deployment of each component

#### Risk: Alert Fatigue  
- **Mitigation**: Smart alert grouping, tunable thresholds, priority classification
- **Monitoring**: Track alert accuracy and response rates

#### Risk: Performance Impact
- **Mitigation**: Separate health checks from policy monitoring, efficient HEAD requests
- **Testing**: Load testing, performance benchmarks

### 7.2 Medium-Risk Areas

#### Risk: False Positives
- **Mitigation**: Multiple retry attempts, error classification, manual override
- **Monitoring**: Track false positive rates

#### Risk: Increased Complexity
- **Mitigation**: Clear documentation, modular design, comprehensive testing
- **Management**: Regular code reviews, technical debt tracking

---

## 8. Future Enhancements

### 8.1 Advanced Features (Post-MVP)
- Machine learning for URL pattern recognition
- Integration with web archiving services
- Competitive intelligence workflow automation
- Historical policy change trend analysis

### 8.2 Platform Expansion
- Automated discovery of new platform policy pages
- Multi-language policy monitoring
- Policy change impact assessment
- Cross-platform policy comparison tools

---

## 9. Conclusion

This comprehensive link health monitoring system will transform our Trust & Safety monitoring from a reactive, failure-prone process to a proactive, self-healing system. By implementing systematic URL health checking, intelligent alerting, and automated maintenance, we ensure zero blind spots in our competitive intelligence gathering.

**Next Steps**:
1. Review and approve this plan
2. Begin Phase 1 implementation (Meta icon fix + basic error handling)
3. Systematic testing and gradual rollout
4. Continuous monitoring and optimization

**Success Definition**: Zero silent monitoring failures, 99.5% URL uptime, and complete visibility into our competitive intelligence system health.

---

*This plan ensures our Trust & Safety policy monitoring system is robust, reliable, and maintains comprehensive visibility into competitor policy changes without any blind spots.*