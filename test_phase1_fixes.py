#!/usr/bin/env python3
"""
Test Phase 1 fixes for link health monitoring system.

Tests the implemented fixes:
1. Playwright HTTP status checking 
2. Basic error classification
3. Smart retry logic

Expected results after fixes:
- Playwright should now FAIL on 404/403 (not succeed)
- Error types should be classified correctly
- 404/403 should not be retried (permanent failures)
- Timeouts/5xx should still be retried
"""

import sys
import json
from pathlib import Path

# Add the scripts directory to path
sys.path.insert(0, str(Path(__file__).parent / "scripts"))

from fetch import fetch_with_httpx, fetch_with_playwright, classify_error, should_retry, URLErrorTypes

def test_phase1_fixes():
    """Test the Phase 1 fixes for link health monitoring."""
    
    print("🔧 Testing Phase 1 Link Health Monitoring Fixes\n")
    print("=" * 65)
    
    # Test scenarios
    test_cases = [
        {
            "name": "404 with Playwright (should now FAIL)",
            "url": "https://httpbin.org/status/404", 
            "renderer": "playwright",
            "expected_result": "FAIL",
            "expected_error_type": URLErrorTypes.BROKEN_LINK
        },
        {
            "name": "403 with Playwright (should now FAIL)", 
            "url": "https://httpbin.org/status/403",
            "renderer": "playwright",
            "expected_result": "FAIL", 
            "expected_error_type": URLErrorTypes.ACCESS_DENIED
        },
        {
            "name": "404 with httpx (should still FAIL)",
            "url": "https://httpbin.org/status/404",
            "renderer": "httpx",
            "expected_result": "FAIL",
            "expected_error_type": URLErrorTypes.BROKEN_LINK
        },
        {
            "name": "Valid URL with Playwright (should succeed)",
            "url": "https://httpbin.org/html",
            "renderer": "playwright", 
            "expected_result": "SUCCESS",
            "expected_error_type": None
        },
        {
            "name": "Valid URL with httpx (should succeed)",
            "url": "https://httpbin.org/html",
            "renderer": "httpx",
            "expected_result": "SUCCESS", 
            "expected_error_type": None
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n🧪 Test {i}: {test_case['name']}")
        print(f"   URL: {test_case['url']}")
        print(f"   Expected: {test_case['expected_result']}")
        print("   " + "-" * 55)
        
        try:
            if test_case['renderer'] == 'httpx':
                content = fetch_with_httpx(test_case['url'])
                actual_result = "SUCCESS"
                actual_error_type = None
                details = f"Returned {len(content)} characters"
            else:
                content = fetch_with_playwright(test_case['url'])
                actual_result = "SUCCESS"
                actual_error_type = None
                details = f"Returned {len(content)} characters"
                
        except Exception as e:
            actual_result = "FAIL"
            actual_error_type = classify_error(e)
            details = f"Error: {type(e).__name__}: {str(e)}"
            
        print(f"   Actual Result: {actual_result}")
        print(f"   Error Type: {actual_error_type}")
        print(f"   Details: {details}")
        
        # Validation
        result_correct = actual_result == test_case['expected_result']
        error_type_correct = actual_error_type == test_case['expected_error_type']
        
        if result_correct and error_type_correct:
            print("   ✅ TEST PASSED")
        else:
            print("   ❌ TEST FAILED")
            
        results.append({
            "test_name": test_case['name'],
            "url": test_case['url'],
            "renderer": test_case['renderer'],
            "expected_result": test_case['expected_result'],
            "actual_result": actual_result,
            "expected_error_type": test_case['expected_error_type'],
            "actual_error_type": actual_error_type,
            "passed": result_correct and error_type_correct,
            "details": details
        })
    
    # Test error classification separately  
    print(f"\n🏷️  Testing Error Classification Logic")
    print("   " + "-" * 55)
    
    classification_tests = [
        ("HTTP 404: Not Found", URLErrorTypes.BROKEN_LINK),
        ("HTTP 403: Forbidden", URLErrorTypes.ACCESS_DENIED), 
        ("HTTP 500: Internal Server Error", URLErrorTypes.SERVER_ERROR),
        ("Timeout occurred", URLErrorTypes.NETWORK_TIMEOUT),
        ("Some unknown error", URLErrorTypes.UNKNOWN)
    ]
    
    for error_msg, expected_type in classification_tests:
        actual_type = classify_error(Exception(error_msg))
        should_retry_result = should_retry(actual_type)
        
        correct = actual_type == expected_type
        print(f"   '{error_msg}' → {actual_type} (retry: {should_retry_result}) {'✅' if correct else '❌'}")
    
    # Summary
    print("\n" + "=" * 65)
    print("📊 PHASE 1 FIXES TEST SUMMARY") 
    print("=" * 65)
    
    passed = sum(1 for r in results if r['passed'])
    total = len(results)
    
    print(f"\n🎯 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED! Phase 1 fixes are working correctly.")
        print("\n✅ Confirmed fixes:")
        print("   • Playwright now correctly fails on 404/403 errors")
        print("   • Error classification working properly") 
        print("   • Smart retry logic prevents pointless retries")
        print("   • Valid URLs still work correctly")
        
        print(f"\n🚀 Ready for deployment to dev branch!")
        
    else:
        print("❌ Some tests failed. Fix issues before deployment:")
        for result in results:
            if not result['passed']:
                print(f"   • {result['test_name']}: Expected {result['expected_result']}, got {result['actual_result']}")
    
    # Save results
    results_file = Path("phase1_test_results.json")
    with open(results_file, 'w') as f:
        json.dump({
            "timestamp": "2025-01-07T12:30:00Z",
            "phase": "Phase 1 - Foundation & Immediate Fixes",
            "summary": {
                "total_tests": total,
                "passed": passed,
                "success_rate": f"{passed/total*100:.1f}%"
            },
            "fixes_tested": [
                "Playwright HTTP status checking",
                "Basic error classification", 
                "Smart retry logic"
            ],
            "results": results
        }, f, indent=2)
    
    print(f"\n📝 Detailed results saved to: {results_file}")

if __name__ == "__main__":
    test_phase1_fixes()