#!/usr/bin/env python3
"""
Phase 2.2: Enhanced Core Health Checking Service

Proactive URL health monitoring to detect issues before they impact policy monitoring.
- Quick HEAD requests for fast health validation (httpx URLs)
- ENHANCED: Real Playwright health checks for bot-protected URLs
- Health status tracking and history
- Integration with existing fetch.py system
- Separate from content fetching for efficiency

Design Goals:
- Fast health checks (<30s for all URLs)
- Minimal bandwidth usage (HEAD requests for httpx URLs)
- ENHANCED: Smart bot protection handling (Playwright health checks for real validation)
- Robust error classification
- Historical health tracking

Recent Enhancements:
- Playwright integration for bot-protected sites (WhatNot, TikTok, Meta)
- Real HTTP status validation instead of assumption-based health reporting
- Configurable Playwright health check behavior
- Improved error detection and classification
"""

import json
import httpx
import time
import ssl
import concurrent.futures
from pathlib import Path
from datetime import datetime, UTC, timedelta
from typing import Dict, List, Optional, NamedTuple
from dataclasses import dataclass, asdict
from enum import Enum
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# Health Status Classifications
class HealthStatus(Enum):
    HEALTHY = "healthy"          # HTTP 200, fast response, no recent failures
    DEGRADED = "degraded"        # HTTP 200 but slow, or intermittent failures  
    FAILED = "failed"            # HTTP 4xx/5xx, timeout, DNS failure, consecutive failures
    UNKNOWN = "unknown"          # New URL, insufficient data

@dataclass
class HealthCheckResult:
    """Result of a single health check"""
    url: str
    slug: str
    platform: str
    timestamp: str
    status: HealthStatus
    http_status: Optional[int]
    response_time_ms: Optional[int]
    error_message: Optional[str]
    ssl_valid: Optional[bool]

@dataclass  
class URLHealthRecord:
    """Complete health record for a URL"""
    slug: str
    platform: str
    url: str
    current_status: HealthStatus
    last_success: Optional[str]
    last_failure: Optional[str]
    consecutive_failures: int
    total_checks: int
    success_count: int
    health_history: List[Dict]  # Recent check results
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate percentage"""
        if self.total_checks == 0:
            return 0.0
        return (self.success_count / self.total_checks) * 100

class URLHealthChecker:
    """Core health checking service"""
    
    def __init__(self, config_file: Path = None):
        self.config_file = config_file or Path("platform_urls.json")
        self.health_db_file = Path("url_health.json")
        self.max_history_entries = 30  # Keep 30 days of history
        self.timeout_seconds = 10
        self.slow_threshold_ms = 2000    # >2s is degraded
        self.failed_threshold = 3        # 3 consecutive failures = failed status
        self.playwright_timeout_ms = 15000  # 15s timeout for Playwright health checks
        self.enable_playwright_health = True  # Enable Playwright-based health checks
        self.playwright_user_agent = "TrustAndSafety-Policy-Watcher/1.0 Health Check"
        
    def run_health_checks(self) -> Dict:
        """Run health checks for all URLs in configuration"""
        
        print("🏥 Starting URL Health Check System")
        print("=" * 50)
        
        # Load URL configuration
        if not self.config_file.exists():
            raise FileNotFoundError(f"Configuration file not found: {self.config_file}")
            
        with open(self.config_file, 'r') as f:
            platform_urls = json.load(f)
        
        print(f"📋 Loaded {len(platform_urls)} URLs for health checking")
        
        # Load existing health database
        health_db = self.load_health_database()
        
        # Run health checks
        check_results = []
        start_time = time.time()
        
        # Use ThreadPoolExecutor for concurrent health checks
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            # Create tasks for concurrent health checks
            future_to_config = {}
            for url_config in platform_urls:
                future = executor.submit(
                    self.check_url_health,
                    url_config["url"], 
                    url_config["slug"],
                    url_config["platform"],
                    url_config.get("renderer", "httpx")
                )
                future_to_config[future] = url_config
            
            # Execute all health checks concurrently
            print("🔍 Running concurrent health checks...")
            for future in concurrent.futures.as_completed(future_to_config):
                try:
                    result = future.result()
                    check_results.append(result)
                except Exception as e:
                    print(f"   ❌ Health check exception: {e}")
        
        # Process results and update health database  
        for result in check_results:
            if isinstance(result, HealthCheckResult):
                self.update_url_health_record(health_db, result)
        
        elapsed_time = time.time() - start_time
        
        # Update system health summary
        system_health = self.calculate_system_health(health_db)
        health_db["system_health"] = system_health
        health_db["system_health"]["last_check"] = datetime.now(UTC).isoformat().replace('+00:00', 'Z')
        
        # Save updated health database
        self.save_health_database(health_db)
        
        # Print summary
        print(f"\n📊 Health Check Summary:")
        print(f"   Total URLs checked: {len(check_results)}")
        print(f"   Healthy: {system_health['healthy_urls']} 🟢")
        print(f"   Degraded: {system_health['degraded_urls']} 🟡") 
        print(f"   Failed: {system_health['failed_urls']} 🔴")
        print(f"   System uptime: {system_health['system_uptime']:.1f}%")
        print(f"   Elapsed time: {elapsed_time:.2f}s")
        
        return {
            "results": check_results,
            "system_health": system_health,
            "elapsed_time": elapsed_time
        }
    
    def check_url_health(self, url: str, slug: str, platform: str, renderer: str = "httpx") -> HealthCheckResult:
        """
        Perform health check on a single URL with smart renderer selection.
        
        - httpx URLs: Fast HEAD requests for basic health validation
        - playwright URLs: Full browser health checks to bypass bot protection
        
        Args:
            url: URL to check
            slug: URL slug identifier 
            platform: Platform name
            renderer: "httpx" or "playwright" - determines checking method
            
        Returns:
            HealthCheckResult with status, timing, and error information
        """
        
        print(f"   🔍 Checking {slug}...")
        
        start_time = time.time()
        
        try:
            # Use Playwright for bot-protected URLs instead of skipping health checks
            if renderer == "playwright":
                if not self.enable_playwright_health:
                    # Fallback to old behavior if Playwright health checks are disabled
                    print(f"      🎭 Playwright health checks disabled - marking as healthy")
                    return HealthCheckResult(
                        url=url,
                        slug=slug,
                        platform=platform,
                        timestamp=datetime.now(UTC).isoformat().replace('+00:00', 'Z'),
                        status=HealthStatus.HEALTHY,
                        http_status=None,
                        response_time_ms=None,
                        error_message="Playwright health checks disabled - assumed healthy",
                        ssl_valid=None
                    )
                
                print(f"      🎭 Using Playwright for health check (bot protection handling)")
                http_status, response_time_ms, error_message = self.check_url_health_with_playwright(url)
                
                # Determine health status based on Playwright results
                if http_status >= 200 and http_status < 400:
                    if response_time_ms <= self.slow_threshold_ms:
                        status = HealthStatus.HEALTHY
                    else:
                        status = HealthStatus.DEGRADED  # Slow response
                else:
                    status = HealthStatus.FAILED
                
                # Check SSL if HTTPS (optional for Playwright checks)
                ssl_valid = None
                if url.startswith('https://') and status != HealthStatus.FAILED:
                    ssl_valid = self.check_ssl_health(url)
                
                print(f"      ✅ {status.value} ({http_status}, {response_time_ms}ms)")
                
                return HealthCheckResult(
                    url=url,
                    slug=slug,
                    platform=platform,
                    timestamp=datetime.now(UTC).isoformat().replace('+00:00', 'Z'),
                    status=status,
                    http_status=http_status,
                    response_time_ms=response_time_ms,
                    error_message=error_message,
                    ssl_valid=ssl_valid
                )
            
            # Perform HEAD request for quick health check using httpx
            with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
                response = client.head(url)
                response_time_ms = int((time.time() - start_time) * 1000)
                status_code = response.status_code

                if status_code >= 400 and self.should_retry_with_get(url, status_code):
                    initial_status = status_code
                    get_start = time.time()
                    response = client.get(url)
                    response_time_ms = int((time.time() - get_start) * 1000)
                    status_code = response.status_code
                    print(f"      ↻ HEAD returned {initial_status}; GET fallback returned {status_code}")
                
                # Determine health status
                if status_code == 200:
                    if response_time_ms <= self.slow_threshold_ms:
                        status = HealthStatus.HEALTHY
                    else:
                        status = HealthStatus.DEGRADED  # Slow response
                elif 300 <= status_code < 400:
                    # Redirects are generally OK for health checks
                    status = HealthStatus.HEALTHY if response_time_ms <= self.slow_threshold_ms else HealthStatus.DEGRADED
                else:
                    # 4xx/5xx errors
                    status = HealthStatus.FAILED
                
                # Check SSL if HTTPS
                ssl_valid = None
                if url.startswith('https://'):
                    ssl_valid = self.check_ssl_health(url)
                
                print(f"      ✅ {status.value} ({status_code}, {response_time_ms}ms)")
                
                return HealthCheckResult(
                    url=url,
                    slug=slug,
                    platform=platform,
                    timestamp=datetime.now(UTC).isoformat().replace('+00:00', 'Z'),
                    status=status,
                    http_status=status_code,
                    response_time_ms=response_time_ms,
                    error_message=None,
                    ssl_valid=ssl_valid
                )
                
        except httpx.TimeoutException:
            print(f"      ❌ timeout")
            return HealthCheckResult(
                url=url,
                slug=slug, 
                platform=platform,
                timestamp=datetime.now(UTC).isoformat().replace('+00:00', 'Z'),
                status=HealthStatus.FAILED,
                http_status=None,
                response_time_ms=None,
                error_message="Request timeout",
                ssl_valid=None
            )
            
        except Exception as e:
            print(f"      ❌ error: {str(e)[:50]}...")
            return HealthCheckResult(
                url=url,
                slug=slug,
                platform=platform,
                timestamp=datetime.now(UTC).isoformat().replace('+00:00', 'Z'),
                status=HealthStatus.FAILED,
                http_status=None,
                response_time_ms=None,
                error_message=str(e)[:200],  # Truncate long error messages
                ssl_valid=None
            )
    
    def check_ssl_health(self, url: str) -> bool:
        """Quick SSL certificate validation"""
        try:
            # Simple SSL check - just verify the certificate is valid
            parsed = urlparse(url)
            
            # Create SSL context for validation
            context = ssl.create_default_context()
            
            # Quick SSL handshake test with timeout
            with ssl.create_connection((parsed.hostname, parsed.port or 443), timeout=5) as sock:
                with context.wrap_socket(sock, server_hostname=parsed.hostname) as ssock:
                    # If we get here, SSL is valid
                    return True
                    
        except Exception:
            return False
    
    def check_url_health_with_playwright(self, url: str) -> tuple[int, int, Optional[str]]:
        """
        Perform lightweight health check using Playwright for bot-protected sites.
        Returns: (http_status, response_time_ms, error_message)
        """
        start_time = time.time()
        
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch()
                page = browser.new_page(user_agent=self.playwright_user_agent)
                
                try:
                    # Navigate to the page with a reasonable timeout
                    response = page.goto(url, timeout=self.playwright_timeout_ms, wait_until='domcontentloaded')
                    response_time_ms = int((time.time() - start_time) * 1000)
                    
                    if response:
                        http_status = response.status
                        
                        # For health checks, we just need to verify the page loads
                        # No need to wait for full rendering or extract content
                        if http_status >= 200 and http_status < 300:
                            return http_status, response_time_ms, None
                        elif http_status >= 300 and http_status < 400:
                            # Redirects are generally OK for health checks
                            return http_status, response_time_ms, None
                        else:
                            return http_status, response_time_ms, f"HTTP {http_status}"
                    else:
                        return 0, int((time.time() - start_time) * 1000), "No response received"
                        
                except PlaywrightTimeoutError:
                    response_time_ms = int((time.time() - start_time) * 1000)
                    return 0, response_time_ms, "Playwright timeout"
                    
                finally:
                    browser.close()
                    
        except Exception as e:
            response_time_ms = int((time.time() - start_time) * 1000)
            return 0, response_time_ms, f"Playwright error: {str(e)[:100]}"

    def should_retry_with_get(self, url: str, status_code: int) -> bool:
        """
        Some providers (notably support.google.com) return false 4xx responses for HEAD
        requests even though a normal GET succeeds. This guard falls back to GET for a
        known set of hosts so we avoid flagging healthy pages as failed.
        """
        if status_code not in (403, 404, 405):
            return False

        hostname = urlparse(url).hostname or ""
        fallback_hosts = {
            "support.google.com",
        }

        return any(hostname == host or hostname.endswith(f".{host}") for host in fallback_hosts)
    
    def load_health_database(self) -> Dict:
        """Load existing health database or create new one"""
        
        if not self.health_db_file.exists():
            return {
                "urls": {},
                "system_health": {
                    "last_check": None,
                    "total_urls": 0,
                    "healthy_urls": 0,
                    "degraded_urls": 0,
                    "failed_urls": 0,
                    "system_uptime": 0.0
                }
            }
        
        try:
            with open(self.health_db_file, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"⚠️  Error loading health database: {e}")
            print("   Creating new health database...")
            # Delete corrupted file and return empty database
            if self.health_db_file.exists():
                self.health_db_file.unlink()
            return {
                "urls": {},
                "system_health": {
                    "last_check": None,
                    "total_urls": 0,
                    "healthy_urls": 0,
                    "degraded_urls": 0,
                    "failed_urls": 0,
                    "system_uptime": 0.0
                }
            }
    
    def save_health_database(self, health_db: Dict):
        """Save health database to disk"""
        try:
            with open(self.health_db_file, 'w') as f:
                json.dump(health_db, f, indent=2)
        except IOError as e:
            print(f"❌ Error saving health database: {e}")
    
    def update_url_health_record(self, health_db: Dict, result: HealthCheckResult):
        """Update health record for a URL based on check result"""
        
        urls = health_db.setdefault("urls", {})
        
        # Get or create health record
        if result.url not in urls:
            record = URLHealthRecord(
                slug=result.slug,
                platform=result.platform,
                url=result.url,
                current_status=HealthStatus.UNKNOWN,
                last_success=None,
                last_failure=None,
                consecutive_failures=0,
                total_checks=0,
                success_count=0,
                health_history=[]
            )
        else:
            # Convert dict back to dataclass for easier manipulation
            record_data = urls[result.url].copy()
            # Convert string status back to enum
            if 'current_status' in record_data:
                record_data['current_status'] = HealthStatus(record_data['current_status'])
            record = URLHealthRecord(**record_data)
        
        # Update record based on check result
        record.total_checks += 1
        
        if result.status in [HealthStatus.HEALTHY, HealthStatus.DEGRADED]:
            record.success_count += 1
            record.last_success = result.timestamp
            record.consecutive_failures = 0
        else:
            record.last_failure = result.timestamp  
            record.consecutive_failures += 1
        
        # Determine current status based on consecutive failures
        if record.consecutive_failures >= self.failed_threshold:
            record.current_status = HealthStatus.FAILED
        else:
            record.current_status = result.status
        
        # Add to health history (keep only recent entries)
        history_entry = {
            "timestamp": result.timestamp,
            "status": result.status.value,
            "http_status": result.http_status,
            "response_time_ms": result.response_time_ms,
            "error_message": result.error_message,
            "ssl_valid": result.ssl_valid
        }
        
        record.health_history.insert(0, history_entry)
        record.health_history = record.health_history[:self.max_history_entries]
        
        # Convert to dict and handle enum serialization
        record_dict = asdict(record)
        record_dict['current_status'] = record.current_status.value
        
        # Save back to database
        urls[result.url] = record_dict
    
    def calculate_system_health(self, health_db: Dict) -> Dict:
        """Calculate overall system health metrics"""
        
        urls = health_db.get("urls", {})
        
        total_urls = len(urls)
        healthy_urls = 0
        degraded_urls = 0
        failed_urls = 0
        
        for url_data in urls.values():
            status = url_data.get("current_status", "unknown")
            if status == "healthy":
                healthy_urls += 1
            elif status == "degraded":
                degraded_urls += 1
            elif status == "failed":
                failed_urls += 1
        
        # Calculate system uptime (percentage of healthy + degraded URLs)
        if total_urls > 0:
            system_uptime = ((healthy_urls + degraded_urls) / total_urls) * 100
        else:
            system_uptime = 0.0
        
        return {
            "total_urls": total_urls,
            "healthy_urls": healthy_urls,
            "degraded_urls": degraded_urls,
            "failed_urls": failed_urls,
            "unknown_urls": total_urls - healthy_urls - degraded_urls - failed_urls,
            "system_uptime": round(system_uptime, 2),
            "last_check": datetime.now(UTC).isoformat().replace('+00:00', 'Z')
        }
    
    def detect_health_alerts(self, current_health_db: Dict, previous_health_db: Dict = None) -> List[Dict]:
        """Detect newly failed URLs and generate health alerts"""
        
        alerts = []
        current_urls = current_health_db.get("urls", {})
        previous_urls = previous_health_db.get("urls", {}) if previous_health_db else {}
        
        for url, current_data in current_urls.items():
            current_status = current_data.get("current_status", "unknown")
            slug = current_data.get("slug", "unknown")
            platform = current_data.get("platform", "unknown")
            
            # Check if URL just failed (was healthy/degraded, now failed)
            if current_status == "failed":
                previous_data = previous_urls.get(url, {})
                previous_status = previous_data.get("current_status", "unknown")
                
                # New failure detected
                if previous_status in ["healthy", "degraded", "unknown"] or not previous_urls:
                    error_msg = None
                    if current_data.get("health_history") and len(current_data["health_history"]) > 0:
                        error_msg = current_data["health_history"][0].get("error_message")
                    
                    alert = {
                        "type": "url_failure",
                        "url": url,
                        "slug": slug,
                        "platform": platform,
                        "previous_status": previous_status,
                        "current_status": current_status,
                        "error_message": error_msg,
                        "timestamp": datetime.now(UTC).isoformat().replace('+00:00', 'Z')
                    }
                    alerts.append(alert)
                    
        return alerts
    
    def save_health_alerts(self, alerts: List[Dict]) -> None:
        """Save health alerts to file for consumption by notification system"""
        alert_file = Path("health_alerts.json")
        
        # Save only current active alerts (replaces existing file)
        with open(alert_file, 'w') as f:
            json.dump(alerts, f, indent=2)
        
        if alerts:
            print(f"💾 Saved {len(alerts)} active health alerts to {alert_file}")
        else:
            print(f"💾 Cleared health alerts file (no active alerts)")

def main():
    """Main entry point for health checking"""
    
    health_checker = URLHealthChecker()
    
    try:
        # Load previous health data for alert detection
        previous_health_db = None
        if health_checker.health_db_file.exists():
            try:
                with open(health_checker.health_db_file, 'r') as f:
                    previous_health_db = json.load(f)
            except (json.JSONDecodeError, IOError):
                previous_health_db = None
        
        # Run current health checks
        results = health_checker.run_health_checks()
        
        # Detect health alerts by comparing with previous state
        alerts = health_checker.detect_health_alerts(results, previous_health_db)
        
        # Save alerts for notification system (always call to clear resolved alerts)
        health_checker.save_health_alerts(alerts)
        if alerts:
            print(f"🚨 Generated {len(alerts)} health alerts")
            for alert in alerts:
                print(f"   ⚠️  {alert['platform']} - {alert['slug']}: {alert['previous_status']} → {alert['current_status']}")
        else:
            print(f"✅ No active health alerts")
        
        # Report summary
        failed_count = results["system_health"]["failed_urls"]
        if failed_count > 0:
            print(f"\n⚠️  {failed_count} URLs failed health checks")
            # Don't exit with error code - we want the workflow to continue
            # Health issues will be reported via alerts and notifications
        else:
            print(f"\n✅ All URLs passed health checks")
            
    except Exception as e:
        print(f"\n❌ Health check system error: {e}")
        import traceback
        traceback.print_exc()
        # Don't exit with error code - we want the workflow to continue

if __name__ == "__main__":
    main()
