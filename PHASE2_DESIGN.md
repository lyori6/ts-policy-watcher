# Phase 2 Design: Proactive Health Monitoring System

**Status**: Design Complete - Ready for Implementation  
**Date**: January 7, 2025

## 🎯 Phase 2 Goals

With Phase 1 bulletproof (100% test pass rate), Phase 2 adds proactive monitoring to prevent failures before they impact policy monitoring.

### Core Objectives

1. **Proactive Detection** - Find broken URLs before they impact monitoring
2. **Health Dashboard** - Visual system health indicators  
3. **Multi-Channel Alerts** - Separate policy changes from system health alerts
4. **Historical Tracking** - URL uptime and health trends

## 🏗️ System Architecture

### Health Check System

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Daily Health  │───▶│  Health Status   │───▶│   Dashboard     │
│   Check Cron    │    │   Database       │    │   Integration   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  URL Validation │    │  Alert System    │    │  Health Metrics │
│  (Quick HEAD)   │    │  (Multi-Channel) │    │  & History      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Component Design

#### 1. Health Check Service (`health_check.py`)
```python
class URLHealthChecker:
    def __init__(self):
        self.health_db = Path("url_health.json")
        self.alert_threshold = 3  # failures before alert
    
    async def check_url_health(self, url: str, renderer: str) -> HealthStatus:
        """Quick health check using HEAD request + light validation"""
        
    def update_health_history(self, url: str, status: HealthStatus):
        """Track URL health over time"""
        
    def should_alert(self, url: str) -> bool:
        """Determine if URL health warrants an alert"""
```

#### 2. Health Status Database (`url_health.json`)
```json
{
  "urls": {
    "https://example.com/policy": {
      "slug": "example-policy",
      "platform": "Example",
      "current_status": "healthy",
      "last_success": "2025-01-07T10:00:00Z",
      "last_failure": null,
      "consecutive_failures": 0,
      "total_checks": 150,
      "success_rate": 98.67,
      "health_history": [
        {"timestamp": "2025-01-07T10:00:00Z", "status": "healthy", "response_time": 245},
        {"timestamp": "2025-01-06T10:00:00Z", "status": "healthy", "response_time": 180}
      ]
    }
  },
  "system_health": {
    "last_check": "2025-01-07T10:00:00Z",
    "total_urls": 20,
    "healthy_urls": 19,
    "degraded_urls": 1,
    "failed_urls": 0,
    "system_uptime": 99.2
  }
}
```

#### 3. Dashboard Health Integration
- **Health Status Indicators** - Green/Yellow/Red dots for each policy
- **System Health Panel** - Overall uptime percentage
- **Health History Charts** - URL uptime trends
- **Alert Status** - Active health alerts vs policy change alerts

#### 4. Multi-Channel Alert System
```python
class HealthAlertSystem:
    def send_health_alert(self, url: str, issue: str):
        """Send system health alert (separate from policy changes)"""
        
    def send_policy_change_alert(self, url: str, changes: str):
        """Send policy content change alert"""
```

## 📋 Implementation Plan

### Phase 2.1: Core Health Checking (Week 1)

**Files to Create/Modify:**
- `scripts/health_check.py` - Main health checking service
- `scripts/health_database.py` - Health data management
- `.github/workflows/daily-health-check.yml` - Daily health cron

**Implementation Steps:**
1. Create health check service with quick HEAD requests
2. Implement health status database
3. Add health history tracking
4. Create daily health check GitHub Action

### Phase 2.2: Dashboard Integration (Week 1)

**Files to Modify:**
- `dashboard/script.js` - Add health status displays
- `dashboard/style.css` - Health indicator styling
- `dashboard/index.html` - Health status UI elements

**Implementation Steps:**
1. Add health status indicators to policy cards
2. Create system health panel in header
3. Add health history tooltips
4. Implement health filtering (show only degraded URLs)

### Phase 2.3: Alert System (Week 2)

**Files to Create:**
- `scripts/alert_system.py` - Multi-channel alerting
- `scripts/health_alerts.py` - Health-specific alerts

**Implementation Steps:**
1. Separate health alerts from policy change alerts
2. Implement alert thresholds and cooldowns
3. Add alert history tracking
4. Create alert management dashboard

## 🧪 Testing Strategy

### Health Check Testing
```python
def test_health_checks():
    """Test health checking against known URLs"""
    # Test healthy URL detection
    # Test degraded URL detection  
    # Test failed URL detection
    # Test health history tracking
```

### Dashboard Testing
```python  
def test_dashboard_health_integration():
    """Test dashboard health features"""
    # Test health status indicators
    # Test system health panel
    # Test health filtering
    # Test health tooltips
```

## 📊 Success Metrics

### Phase 2 Success Criteria
- **🎯 Zero Silent Failures** - All URL failures detected within 24 hours
- **📊 Health Visibility** - 100% of URLs have visible health status
- **⚡ Fast Detection** - Health issues detected in <1 hour (daily checks)
- **📈 Historical Tracking** - 30 days of health history per URL
- **🔔 Smart Alerts** - Health alerts separate from policy change alerts

### Key Performance Indicators
- Mean time to health issue detection: <12 hours
- URL uptime tracking accuracy: 99%+
- False positive health alerts: <5%
- Dashboard health data freshness: <24 hours

## 🔧 Technical Implementation Details

### Health Check Algorithm
```python
async def quick_health_check(url: str) -> HealthStatus:
    """
    Quick health validation:
    1. HTTP HEAD request (fast, minimal data)
    2. Check status code (200, 301, 302 = healthy)
    3. Check response time (<5s = good, 5-10s = degraded, >10s = slow)
    4. DNS resolution check
    5. SSL certificate validation (HTTPS URLs)
    """
```

### Health Status Classification
- **🟢 Healthy**: HTTP 200, fast response (<2s), no recent failures
- **🟡 Degraded**: HTTP 200 but slow (2-5s), or recent intermittent failures
- **🔴 Failed**: HTTP 4xx/5xx, timeout, DNS failure, or 3+ consecutive failures
- **⚪ Unknown**: New URL, insufficient data

### Integration Points
- **GitHub Actions**: Daily health check workflow
- **Dashboard**: Real-time health status display
- **Alert System**: Multi-channel health notifications  
- **Run Log**: Health check results in run history

## 🚀 Phase 2 Deployment Strategy

### Development Process
1. **Build on Dev Branch** - All Phase 2 development in `dev` branch
2. **Incremental Testing** - Test each component before integration
3. **Dashboard Preview** - Use Vercel preview for testing
4. **Full System Testing** - End-to-end health monitoring validation

### Rollout Plan
1. Deploy health check service (no alerts initially)
2. Collect 7 days of health data for baseline
3. Add dashboard health indicators
4. Enable health alerts with conservative thresholds
5. Fine-tune alert sensitivity based on real data

---

## ✅ Phase 2 Ready for Implementation

**Prerequisites Complete:**
- ✅ Phase 1 bulletproof (100% test pass rate)
- ✅ Error handling robust and validated
- ✅ System proven reliable with all 20 production URLs
- ✅ Comprehensive design and testing plan

**Next Step:** Begin Phase 2.1 implementation - Core Health Checking Service