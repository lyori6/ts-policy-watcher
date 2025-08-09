#!/usr/bin/env python3
"""
Test the localhost dashboard using Playwright to see exactly what health alerts it shows
"""

import asyncio
from playwright.async_api import async_playwright
import json

async def test_dashboard():
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=False)  # Set to False to see what's happening
        page = await browser.new_page()
        
        print("🚀 Testing localhost:5173 dashboard...")
        
        try:
            # Navigate to dashboard
            await page.goto('http://localhost:5173', timeout=10000)
            await page.wait_for_timeout(3000)  # Wait for dashboard to load
            
            print("✅ Dashboard loaded successfully")
            
            # Check if health alert banner is visible
            health_banner = page.locator('#health-alert-banner')
            is_visible = await health_banner.is_visible()
            
            print(f"🏥 Health alert banner visible: {is_visible}")
            
            if is_visible:
                # Get the alert text
                alert_text = await page.locator('#health-alert-text').text_content()
                print(f"🚨 Alert message: {alert_text}")
                
                # Check what data was loaded
                health_alerts = await page.evaluate('window.policyDashboard ? window.policyDashboard.healthAlerts : null')
                print(f"📊 Dashboard loaded {len(health_alerts) if health_alerts else 0} health alerts")
                
                if health_alerts:
                    for alert in health_alerts:
                        print(f"  - {alert['platform']} {alert['slug']}: {alert['current_status']} ({alert['timestamp']})")
                
            else:
                print("✅ No health alert banner - dashboard is working correctly!")
                
            # Check console errors
            print("\n🔍 Console messages:")
            
            # Listen for console messages
            def on_console_message(msg):
                if msg.type in ['error', 'warning']:
                    print(f"  {msg.type.upper()}: {msg.text}")
            
            page.on('console', on_console_message)
            await page.wait_for_timeout(2000)
            
        except Exception as e:
            print(f"❌ Error testing dashboard: {e}")
            
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(test_dashboard())