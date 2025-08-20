#!/usr/bin/env python3
"""
Comprehensive GTM Implementation Test
=====================================

This script tests the Google Tag Manager implementation on the dashboard using Playwright.
It verifies:
1. GTM script loads properly in the head section
2. GTM noscript iframe is present
3. dataLayer is initialized
4. GTM events fire correctly when subscribing to newsletter
5. Browser console for GTM-related errors

Usage:
    python test_gtm_implementation.py
"""

import asyncio
import json
import re
from datetime import datetime
from playwright.async_api import async_playwright

class GTMTestResult:
    def __init__(self):
        self.timestamp = datetime.now().isoformat()
        self.tests = {}
        self.console_logs = []
        self.network_requests = []
        self.errors = []
        
    def add_test(self, test_name, passed, details=None, error=None):
        self.tests[test_name] = {
            'passed': passed,
            'details': details,
            'error': str(error) if error else None
        }
        
    def add_console_log(self, log_type, message):
        self.console_logs.append({
            'type': log_type,
            'message': message,
            'timestamp': datetime.now().isoformat()
        })
        
    def add_network_request(self, url, method, status, response_type):
        self.network_requests.append({
            'url': url,
            'method': method,
            'status': status,
            'type': response_type,
            'timestamp': datetime.now().isoformat()
        })
        
    def add_error(self, error_message):
        self.errors.append({
            'message': error_message,
            'timestamp': datetime.now().isoformat()
        })

class GTMTester:
    def __init__(self):
        self.dashboard_url = "http://localhost:8000/dashboard/"
        self.gtm_id = "GTM-NDXP433F"
        self.result = GTMTestResult()
        
    async def run_all_tests(self):
        """Run all GTM tests"""
        print("🔬 Starting GTM Implementation Tests...")
        print(f"📍 Testing URL: {self.dashboard_url}")
        print(f"🏷️  GTM ID: {self.gtm_id}")
        print("-" * 60)
        
        async with async_playwright() as p:
            # Launch browser with debugging enabled
            browser = await p.chromium.launch(
                headless=False,  # Show browser for debugging
                args=['--disable-web-security', '--disable-features=VizDisplayCompositor']
            )
            
            try:
                context = await browser.new_context()
                page = await context.new_page()
                
                # Set up console and network monitoring
                await self.setup_monitoring(page)
                
                # Navigate to dashboard
                print("🌐 Navigating to dashboard...")
                try:
                    response = await page.goto(self.dashboard_url, wait_until='networkidle', timeout=10000)
                    if response.status != 200:
                        self.result.add_error(f"Failed to load dashboard: HTTP {response.status}")
                        return self.result
                except Exception as e:
                    self.result.add_error(f"Failed to navigate to dashboard: {e}")
                    return self.result
                
                # Wait for page to fully load
                await page.wait_for_timeout(2000)
                
                # Run tests
                await self.test_gtm_script_in_head(page)
                await self.test_gtm_noscript_iframe(page)
                await self.test_datalayer_initialization(page)
                await self.test_gtm_network_requests(page)
                await self.test_newsletter_subscription_event(page)
                await self.check_console_errors(page)
                
                print("✅ All tests completed!")
                
            except Exception as e:
                self.result.add_error(f"Test execution failed: {e}")
                print(f"❌ Test execution failed: {e}")
            finally:
                await browser.close()
                
        return self.result
    
    async def setup_monitoring(self, page):
        """Set up console and network monitoring"""
        
        # Monitor console messages
        page.on("console", lambda msg: self.result.add_console_log(
            msg.type, msg.text
        ))
        
        # Monitor network requests
        page.on("response", lambda response: self.result.add_network_request(
            response.url, 
            response.request.method,
            response.status,
            response.request.resource_type
        ))
        
        # Monitor page errors
        page.on("pageerror", lambda error: self.result.add_error(
            f"Page error: {error}"
        ))
    
    async def test_gtm_script_in_head(self, page):
        """Test 1: Check that GTM script loads properly in the head section"""
        print("🔍 Test 1: Checking GTM script in head section...")
        
        try:
            # Check for GTM script tag in head
            gtm_script = await page.locator('head script').count()
            
            # More specific check for GTM script content
            gtm_script_content = await page.evaluate("""
                () => {
                    const scripts = document.head.querySelectorAll('script');
                    for (let script of scripts) {
                        if (script.textContent && script.textContent.includes('GTM-NDXP433F')) {
                            return {
                                found: true,
                                content: script.textContent.substring(0, 200) + '...',
                                hasGTMId: script.textContent.includes('GTM-NDXP433F'),
                                hasDataLayer: script.textContent.includes('dataLayer')
                            };
                        }
                    }
                    return { found: false };
                }
            """)
            
            if gtm_script_content['found']:
                self.result.add_test(
                    "gtm_script_in_head", 
                    True, 
                    {
                        "total_scripts": gtm_script,
                        "gtm_script_found": True,
                        "contains_gtm_id": gtm_script_content['hasGTMId'],
                        "contains_datalayer": gtm_script_content['hasDataLayer'],
                        "script_preview": gtm_script_content['content']
                    }
                )
                print("   ✅ GTM script found in head with correct ID")
            else:
                self.result.add_test(
                    "gtm_script_in_head", 
                    False, 
                    {"total_scripts": gtm_script, "gtm_script_found": False}
                )
                print("   ❌ GTM script not found in head")
                
        except Exception as e:
            self.result.add_test("gtm_script_in_head", False, error=e)
            print(f"   ❌ Error checking GTM script: {e}")
    
    async def test_gtm_noscript_iframe(self, page):
        """Test 2: Verify the GTM noscript iframe is present"""
        print("🔍 Test 2: Checking GTM noscript iframe...")
        
        try:
            # Check for noscript iframe
            noscript_iframe = await page.evaluate("""
                () => {
                    const noscripts = document.querySelectorAll('noscript');
                    console.log('Found noscript tags:', noscripts.length);
                    
                    for (let i = 0; i < noscripts.length; i++) {
                        const noscript = noscripts[i];
                        console.log('Noscript', i, 'innerHTML:', noscript.innerHTML);
                        
                        const iframe = noscript.querySelector('iframe');
                        if (iframe) {
                            console.log('Found iframe in noscript', i, 'src:', iframe.src);
                            const src = iframe.src || iframe.getAttribute('src');
                            if (src && src.includes('googletagmanager.com/ns.html')) {
                                return {
                                    found: true,
                                    src: src,
                                    hasGTMId: src.includes('GTM-NDXP433F'),
                                    dimensions: {
                                        height: iframe.height || iframe.getAttribute('height'),
                                        width: iframe.width || iframe.getAttribute('width')
                                    },
                                    style: iframe.style.cssText || iframe.getAttribute('style')
                                };
                            }
                        }
                    }
                    return { 
                        found: false,
                        noscript_count: noscripts.length,
                        noscript_contents: Array.from(noscripts).map(ns => ns.innerHTML)
                    };
                }
            """)
            
            if noscript_iframe['found']:
                self.result.add_test(
                    "gtm_noscript_iframe", 
                    True, 
                    noscript_iframe
                )
                print("   ✅ GTM noscript iframe found with correct configuration")
            else:
                self.result.add_test("gtm_noscript_iframe", False)
                print("   ❌ GTM noscript iframe not found")
                
        except Exception as e:
            self.result.add_test("gtm_noscript_iframe", False, error=e)
            print(f"   ❌ Error checking noscript iframe: {e}")
    
    async def test_datalayer_initialization(self, page):
        """Test 3: Test that the dataLayer is initialized"""
        print("🔍 Test 3: Checking dataLayer initialization...")
        
        try:
            datalayer_info = await page.evaluate("""
                () => {
                    return {
                        exists: typeof window.dataLayer !== 'undefined',
                        isArray: Array.isArray(window.dataLayer),
                        length: window.dataLayer ? window.dataLayer.length : 0,
                        content: window.dataLayer ? window.dataLayer.slice(0, 3) : null // First 3 entries for inspection
                    };
                }
            """)
            
            if datalayer_info['exists'] and datalayer_info['isArray']:
                self.result.add_test(
                    "datalayer_initialization", 
                    True, 
                    datalayer_info
                )
                print(f"   ✅ dataLayer initialized successfully with {datalayer_info['length']} entries")
            else:
                self.result.add_test(
                    "datalayer_initialization", 
                    False, 
                    datalayer_info
                )
                print("   ❌ dataLayer not properly initialized")
                
        except Exception as e:
            self.result.add_test("datalayer_initialization", False, error=e)
            print(f"   ❌ Error checking dataLayer: {e}")
    
    async def test_gtm_network_requests(self, page):
        """Test 4: Check for GTM-related network requests"""
        print("🔍 Test 4: Checking GTM network requests...")
        
        try:
            # Wait a bit more for GTM to load
            await page.wait_for_timeout(3000)
            
            # Check network requests for GTM
            gtm_requests = [req for req in self.result.network_requests 
                          if 'googletagmanager.com' in req['url'] or 'gtm.js' in req['url']]
            
            google_analytics_requests = [req for req in self.result.network_requests 
                                       if 'google-analytics.com' in req['url'] or 'analytics.js' in req['url']]
            
            if gtm_requests:
                self.result.add_test(
                    "gtm_network_requests", 
                    True, 
                    {
                        "gtm_requests": len(gtm_requests),
                        "ga_requests": len(google_analytics_requests),
                        "gtm_urls": [req['url'] for req in gtm_requests],
                        "successful_requests": [req for req in gtm_requests if req['status'] == 200]
                    }
                )
                print(f"   ✅ Found {len(gtm_requests)} GTM network requests")
            else:
                self.result.add_test(
                    "gtm_network_requests", 
                    False, 
                    {"total_requests": len(self.result.network_requests)}
                )
                print("   ❌ No GTM network requests found")
                
        except Exception as e:
            self.result.add_test("gtm_network_requests", False, error=e)
            print(f"   ❌ Error checking network requests: {e}")
    
    async def test_newsletter_subscription_event(self, page):
        """Test 5: Try subscribing to newsletter to test GTM events"""
        print("🔍 Test 5: Testing newsletter subscription GTM events...")
        
        try:
            # Check if newsletter widget is present
            widget_visible = await page.locator('#newsletterWidget').is_visible()
            
            if not widget_visible:
                self.result.add_test(
                    "newsletter_subscription_event", 
                    False, 
                    {"error": "Newsletter widget not visible"}
                )
                print("   ❌ Newsletter widget not visible")
                return
            
            # Store initial dataLayer state
            initial_datalayer = await page.evaluate("window.dataLayer ? window.dataLayer.length : 0")
            
            # Fill out newsletter form
            await page.fill('#widgetEmail', 'test@example.com')
            
            # Click subscribe button
            await page.click('#widgetSubscribeBtn')
            
            # Wait for potential GTM events
            await page.wait_for_timeout(2000)
            
            # Check if dataLayer was updated
            final_datalayer = await page.evaluate("""
                () => {
                    if (!window.dataLayer) return null;
                    
                    // Look for newsletter subscription events
                    const events = window.dataLayer.filter(entry => 
                        entry.event && (
                            entry.event.includes('newsletter') || 
                            entry.event.includes('subscription')
                        )
                    );
                    
                    return {
                        total_length: window.dataLayer.length,
                        newsletter_events: events,
                        recent_events: window.dataLayer.slice(-5) // Last 5 events
                    };
                }
            """)
            
            if final_datalayer and len(final_datalayer['newsletter_events']) > 0:
                self.result.add_test(
                    "newsletter_subscription_event", 
                    True, 
                    {
                        "initial_datalayer_length": initial_datalayer,
                        "final_datalayer_info": final_datalayer,
                        "events_fired": len(final_datalayer['newsletter_events'])
                    }
                )
                print(f"   ✅ Newsletter subscription events fired successfully")
            else:
                # Check if subscription happened anyway (form changed)
                success_message = await page.locator('text=You\'re subscribed!').count()
                
                if success_message > 0:
                    self.result.add_test(
                        "newsletter_subscription_event", 
                        False, 
                        {
                            "subscription_successful": True,
                            "gtm_events_fired": False,
                            "final_datalayer_info": final_datalayer
                        }
                    )
                    print("   ⚠️  Subscription successful but no GTM events detected")
                else:
                    self.result.add_test(
                        "newsletter_subscription_event", 
                        False, 
                        {"subscription_successful": False}
                    )
                    print("   ❌ Newsletter subscription failed")
                
        except Exception as e:
            self.result.add_test("newsletter_subscription_event", False, error=e)
            print(f"   ❌ Error testing newsletter subscription: {e}")
    
    async def check_console_errors(self, page):
        """Test 6: Check browser console for GTM-related errors"""
        print("🔍 Test 6: Checking console for GTM-related errors...")
        
        try:
            # Filter console logs for GTM-related messages
            gtm_logs = [log for log in self.result.console_logs 
                       if any(keyword in log['message'].lower() 
                             for keyword in ['gtm', 'tag manager', 'datalayer', 'google', 'analytics'])]
            
            error_logs = [log for log in gtm_logs if log['type'] == 'error']
            warning_logs = [log for log in gtm_logs if log['type'] == 'warning']
            info_logs = [log for log in gtm_logs if log['type'] in ['log', 'info']]
            
            self.result.add_test(
                "console_error_check", 
                len(error_logs) == 0, 
                {
                    "total_gtm_logs": len(gtm_logs),
                    "error_count": len(error_logs),
                    "warning_count": len(warning_logs),
                    "info_count": len(info_logs),
                    "errors": error_logs,
                    "warnings": warning_logs,
                    "info": info_logs
                }
            )
            
            if len(error_logs) == 0:
                print(f"   ✅ No GTM errors found ({len(gtm_logs)} GTM-related logs total)")
            else:
                print(f"   ❌ Found {len(error_logs)} GTM-related errors")
                
        except Exception as e:
            self.result.add_test("console_error_check", False, error=e)
            print(f"   ❌ Error checking console logs: {e}")

def generate_report(result):
    """Generate a comprehensive test report"""
    
    print("\n" + "="*80)
    print("📊 GTM IMPLEMENTATION TEST REPORT")
    print("="*80)
    print(f"Timestamp: {result.timestamp}")
    print(f"Dashboard URL: http://localhost:8000/dashboard/")
    print(f"GTM ID: GTM-NDXP433F")
    
    # Test Results Summary
    total_tests = len(result.tests)
    passed_tests = sum(1 for test in result.tests.values() if test['passed'])
    
    print(f"\n📋 TEST SUMMARY")
    print(f"Total Tests: {total_tests}")
    print(f"Passed: {passed_tests}")
    print(f"Failed: {total_tests - passed_tests}")
    print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
    
    # Detailed Results
    print(f"\n🔍 DETAILED RESULTS")
    print("-" * 40)
    
    for test_name, test_data in result.tests.items():
        status = "✅ PASS" if test_data['passed'] else "❌ FAIL"
        print(f"{status} {test_name.replace('_', ' ').title()}")
        
        if test_data['details']:
            for key, value in test_data['details'].items():
                if isinstance(value, (list, dict)):
                    print(f"    {key}: {json.dumps(value, indent=6)}")
                else:
                    print(f"    {key}: {value}")
        
        if test_data['error']:
            print(f"    Error: {test_data['error']}")
        print()
    
    # Network Activity
    print(f"🌐 NETWORK ACTIVITY")
    print("-" * 40)
    gtm_requests = [req for req in result.network_requests 
                   if 'googletagmanager.com' in req['url'] or 'gtm.js' in req['url']]
    
    print(f"Total Network Requests: {len(result.network_requests)}")
    print(f"GTM-related Requests: {len(gtm_requests)}")
    
    if gtm_requests:
        print("GTM Requests:")
        for req in gtm_requests:
            print(f"  {req['method']} {req['url']} - Status: {req['status']}")
    
    # Console Activity
    print(f"\n📝 CONSOLE ACTIVITY")
    print("-" * 40)
    print(f"Total Console Messages: {len(result.console_logs)}")
    
    by_type = {}
    for log in result.console_logs:
        by_type[log['type']] = by_type.get(log['type'], 0) + 1
    
    for log_type, count in by_type.items():
        print(f"  {log_type}: {count}")
    
    # Errors
    if result.errors:
        print(f"\n⚠️  ERRORS ENCOUNTERED")
        print("-" * 40)
        for error in result.errors:
            print(f"  {error['timestamp']}: {error['message']}")
    
    # Recommendations
    print(f"\n💡 RECOMMENDATIONS")
    print("-" * 40)
    
    if not result.tests.get('gtm_script_in_head', {}).get('passed'):
        print("❌ GTM script not loading properly - check script implementation")
    
    if not result.tests.get('gtm_noscript_iframe', {}).get('passed'):
        print("❌ GTM noscript fallback missing - add noscript iframe")
    
    if not result.tests.get('datalayer_initialization', {}).get('passed'):
        print("❌ dataLayer not initialized - ensure dataLayer is available before GTM script")
    
    if not result.tests.get('newsletter_subscription_event', {}).get('passed'):
        print("❌ Newsletter events not firing - check event tracking implementation")
    
    if result.tests.get('console_error_check', {}).get('details', {}).get('error_count', 0) > 0:
        print("⚠️  GTM console errors detected - review browser console for issues")
    
    if passed_tests == total_tests:
        print("✅ All tests passed! GTM implementation is working correctly.")
    
    print("\n" + "="*80)

async def main():
    """Main test execution"""
    tester = GTMTester()
    result = await tester.run_all_tests()
    generate_report(result)
    
    # Save detailed results to file
    with open('/Users/lyor/ts-policy-watcher/gtm_test_results.json', 'w') as f:
        json.dump({
            'timestamp': result.timestamp,
            'tests': result.tests,
            'console_logs': result.console_logs,
            'network_requests': result.network_requests,
            'errors': result.errors
        }, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /Users/lyor/ts-policy-watcher/gtm_test_results.json")

if __name__ == "__main__":
    asyncio.run(main())