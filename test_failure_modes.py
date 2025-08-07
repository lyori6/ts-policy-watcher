#!/usr/bin/env python3
"""
Test script to validate current failure mode handling in fetch.py

This script tests how the current system handles:
1. 404 Not Found errors (with httpx vs Playwright) 
2. Network timeouts
3. 403 Access Denied errors
4. Valid URLs for comparison

Based on FETCH_ERROR_ANALYSIS.md findings.
"""

import sys
import json
from pathlib import Path
import tempfile
import os

# Add the scripts directory to path to import fetch functions
sys.path.insert(0, str(Path(__file__).parent / "scripts"))

from fetch import fetch_with_httpx, fetch_with_playwright

def test_failure_scenarios():
    """Test various failure scenarios to validate current error handling."""
    
    print("🧪 Testing Current Failure Mode Handling\n")
    print("=" * 60)
    
    # Test scenarios based on publicly available test endpoints
    test_cases = [
        {
            "name": "404 Not Found with httpx",
            "url": "https://httpbin.org/status/404", 
            "renderer": "httpx",
            "expected_behavior": "Should throw HTTPStatusError and fail"
        },
        {
            "name": "404 Not Found with Playwright", 
            "url": "https://httpbin.org/status/404",
            "renderer": "playwright", 
            "expected_behavior": "CRITICAL BUG: Currently succeeds, should fail"
        },
        {
            "name": "403 Forbidden with httpx",
            "url": "https://httpbin.org/status/403",
            "renderer": "httpx",
            "expected_behavior": "Should throw HTTPStatusError and fail"
        },
        {
            "name": "403 Forbidden with Playwright",
            "url": "https://httpbin.org/status/403", 
            "renderer": "playwright",
            "expected_behavior": "CRITICAL BUG: Currently succeeds, should fail"
        },
        {
            "name": "Valid URL with httpx",
            "url": "https://httpbin.org/html",
            "renderer": "httpx", 
            "expected_behavior": "Should succeed and return HTML content"
        },
        {
            "name": "Valid URL with Playwright",
            "url": "https://httpbin.org/html",
            "renderer": "playwright",
            "expected_behavior": "Should succeed and return HTML content"
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 Test {i}: {test_case['name']}")
        print(f"   URL: {test_case['url']}")
        print(f"   Expected: {test_case['expected_behavior']}")
        print("   " + "-" * 50)
        
        try:
            if test_case['renderer'] == 'httpx':
                content = fetch_with_httpx(test_case['url'])
                result = "SUCCESS"
                details = f"Returned {len(content)} characters"
            else:
                content = fetch_with_playwright(test_case['url'])
                result = "SUCCESS" 
                details = f"Returned {len(content)} characters"
                
                # Check if it's actually an error page that looks like success
                if "404" in content or "Not Found" in content:
                    details += " (⚠️  CONTAINS 404 ERROR PAGE - FALSE SUCCESS!)"
                elif "403" in content or "Forbidden" in content:
                    details += " (⚠️  CONTAINS 403 ERROR PAGE - FALSE SUCCESS!)"
                    
        except Exception as e:
            result = "FAILED"
            details = f"Error: {type(e).__name__}: {str(e)}"
            
        print(f"   Result: {result}")
        print(f"   Details: {details}")
        
        results.append({
            "test_name": test_case['name'],
            "url": test_case['url'],
            "renderer": test_case['renderer'], 
            "expected": test_case['expected_behavior'],
            "actual_result": result,
            "actual_details": details
        })
    
    # Summary Analysis
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY & ANALYSIS")
    print("=" * 60)
    
    critical_bugs = []
    working_correctly = []
    
    for result in results:
        if "404" in result['url'] and result['renderer'] == 'playwright' and result['actual_result'] == 'SUCCESS':
            critical_bugs.append(f"❌ {result['test_name']}: False success on 404")
        elif "403" in result['url'] and result['renderer'] == 'playwright' and result['actual_result'] == 'SUCCESS':  
            critical_bugs.append(f"❌ {result['test_name']}: False success on 403")
        elif "404" in result['url'] and result['renderer'] == 'httpx' and result['actual_result'] == 'FAILED':
            working_correctly.append(f"✅ {result['test_name']}: Correctly failed on 404")
        elif "403" in result['url'] and result['renderer'] == 'httpx' and result['actual_result'] == 'FAILED':
            working_correctly.append(f"✅ {result['test_name']}: Correctly failed on 403")
        elif "html" in result['url'] and result['actual_result'] == 'SUCCESS':
            working_correctly.append(f"✅ {result['test_name']}: Correctly succeeded")
    
    print("\n🔧 Working Correctly:")
    for item in working_correctly:
        print(f"   {item}")
        
    print(f"\n🚨 Critical Bugs Found ({len(critical_bugs)}):")
    for item in critical_bugs:
        print(f"   {item}")
    
    if critical_bugs:
        print(f"\n💡 VALIDATION: The analysis in FETCH_ERROR_ANALYSIS.md is confirmed!")
        print("   Playwright is NOT checking HTTP status codes by default.")
        print("   This causes silent failures where 404/403 pages are fetched as 'successful' content.")
    
    # Save detailed results
    results_file = Path("test_failure_results.json")
    with open(results_file, 'w') as f:
        json.dump({
            "timestamp": "2025-01-07T12:00:00Z",
            "summary": {
                "total_tests": len(results),
                "critical_bugs_found": len(critical_bugs), 
                "working_correctly": len(working_correctly)
            },
            "detailed_results": results
        }, f, indent=2)
    
    print(f"\n📝 Detailed results saved to: {results_file}")
    print(f"\n🎯 Next Step: Implement Playwright HTTP status checking fix")
    
if __name__ == "__main__":
    test_failure_scenarios()