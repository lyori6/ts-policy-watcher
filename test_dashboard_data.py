#!/usr/bin/env python3
"""
Test script to simulate dashboard data loading and check what health alerts are being fetched
"""

import json
import requests
import sys
from pathlib import Path

def test_local_files():
    """Test what's in local files"""
    print("🔍 Testing Local Files:")
    print("=" * 40)
    
    # Check local health_alerts.json
    try:
        with open('health_alerts.json', 'r') as f:
            local_alerts = json.load(f)
        print(f"Local health_alerts.json: {len(local_alerts)} alerts")
        if local_alerts:
            for alert in local_alerts:
                print(f"  - {alert['platform']} {alert['slug']}: {alert['current_status']}")
        else:
            print("  - No alerts (empty array)")
    except Exception as e:
        print(f"  ERROR reading local file: {e}")
    
    print()

def test_github_raw_urls():
    """Test GitHub raw content URLs that dashboard uses"""
    print("🌐 Testing GitHub Raw Content URLs:")
    print("=" * 40)
    
    # URLs the dashboard uses
    base_url = "https://raw.githubusercontent.com/lyori6/ts-policy-watcher"
    branches = ['dev', 'main']
    
    for branch in branches:
        print(f"\n📂 Branch: {branch}")
        health_alerts_url = f"{base_url}/{branch}/health_alerts.json"
        
        try:
            response = requests.get(health_alerts_url, timeout=10)
            if response.status_code == 200:
                alerts = response.json()
                print(f"  ✅ health_alerts.json: {len(alerts)} alerts")
                if alerts:
                    for alert in alerts:
                        print(f"    - {alert['platform']} {alert['slug']}: {alert['current_status']}")
                        print(f"      Timestamp: {alert['timestamp']}")
                else:
                    print("    - No alerts (empty array)")
            else:
                print(f"  ❌ HTTP {response.status_code}")
        except Exception as e:
            print(f"  ERROR: {e}")

def test_dashboard_logic():
    """Test the dashboard's alert filtering logic"""
    print("\n🧠 Testing Dashboard Alert Logic:")
    print("=" * 40)
    
    # Simulate dashboard logic (from script.js line 1174-1193)
    try:
        with open('health_alerts.json', 'r') as f:
            health_alerts = json.load(f)
        
        print(f"Loaded {len(health_alerts)} alerts")
        
        # Filter for recent alerts (last 24 hours) - dashboard logic
        from datetime import datetime, timedelta
        twenty_four_hours_ago = datetime.now() - timedelta(hours=24)
        
        recent_alerts = []
        for alert in health_alerts:
            try:
                alert_time = datetime.fromisoformat(alert['timestamp'].replace('Z', '+00:00'))
                if alert_time > twenty_four_hours_ago:
                    recent_alerts.append(alert)
                    print(f"  ✅ Recent alert: {alert['platform']} {alert['slug']} ({alert_time})")
                else:
                    print(f"  ⏰ Old alert: {alert['platform']} {alert['slug']} ({alert_time})")
            except Exception as e:
                print(f"  ❌ Error parsing alert timestamp: {e}")
        
        print(f"\nRecent alerts (last 24h): {len(recent_alerts)}")
        print(f"Should show banner: {'YES' if recent_alerts else 'NO'}")
        
        # Count by platform (dashboard logic)
        if recent_alerts:
            platform_counts = {}
            for alert in recent_alerts:
                platform = alert.get('platform', 'Unknown')
                platform_counts[platform] = platform_counts.get(platform, 0) + 1
            
            print("Platform breakdown:")
            for platform, count in platform_counts.items():
                print(f"  - {platform}: {count} URL{'s' if count != 1 else ''}")
                
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    print("🔧 Dashboard Data Test")
    print("=" * 50)
    
    test_local_files()
    test_github_raw_urls()
    test_dashboard_logic()