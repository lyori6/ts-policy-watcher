# fetch.py Error Handling Analysis

**Current State Investigation - January 7, 2025**

## 🔍 Current Error Handling Audit

### 1. HTTP Error Handling

#### httpx Renderer (lines 39-45)
```python
def fetch_with_httpx(url: str) -> str:
    headers = {"User-Agent": USER_AGENT}
    with httpx.Client(headers=headers, follow_redirects=True) as client:
        response = client.get(url, timeout=30.0)
        response.raise_for_status()  # ← THIS RAISES FOR 4xx/5xx
        return response.text
```

**Current Behavior:**
- ✅ **404 Not Found**: `raise_for_status()` throws `HTTPStatusError` 
- ✅ **403 Forbidden**: `raise_for_status()` throws `HTTPStatusError`
- ✅ **500 Server Error**: `raise_for_status()` throws `HTTPStatusError`
- ✅ **Network timeout**: 30-second timeout throws `TimeoutException`
- ❌ **No status code differentiation**: All HTTP errors treated identically

#### Playwright Renderer (lines 47-61)
```python
def fetch_with_playwright(url: str) -> str:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(user_agent=USER_AGENT)
        try:
            page.goto(url, timeout=60000, wait_until='domcontentloaded')
            page.wait_for_timeout(3000)
            content = page.content()
        except PlaywrightTimeoutError as e:
            print(f"    ERROR: Playwright timeout for {url}: {e}", file=sys.stderr)
            raise  # ← RE-RAISES THE ERROR
        finally:
            browser.close()
        return content
```

**Current Behavior:**
- ✅ **Timeout handling**: 60-second timeout with specific error logging
- ❌ **HTTP status codes**: Playwright doesn't check response.status by default
- ❌ **4xx/5xx errors**: May return error page content as "successful" fetch
- ❌ **No response validation**: Could fetch 404 error pages as content

### 2. Retry Logic (lines 177-192)

```python
for attempt in range(RETRY_ATTEMPTS):  # RETRY_ATTEMPTS = 2
    try:
        if renderer == "playwright":
            content = fetch_with_playwright(url)
        else:
            content = fetch_with_httpx(url)
        break 
    except Exception as e:
        error_msg = f"Attempt {attempt + 1}/{RETRY_ATTEMPTS} FAILED for {slug}. Reason: {e}"
        print(f"    - {error_msg}", file=sys.stderr)
        if attempt < RETRY_ATTEMPTS - 1:
            time.sleep(RETRY_DELAY_SECONDS)  # 5 seconds
        else:
            failures.append({"url": url, "platform": slug, "reason": str(e)})
            errors.append(error_msg)
```

**Current Behavior:**
- ✅ **Retry attempts**: 2 attempts with 5-second delay
- ✅ **Failure tracking**: Errors logged to `failures` list and `errors` list
- ❌ **No retry intelligence**: Retries 404s (pointless) same as network timeouts
- ❌ **No exponential backoff**: Fixed 5-second delay

### 3. Error Logging & Reporting

#### Run Log (lines 235-267)
```python
run_log_entry = {
    "timestamp_utc": run_start_time.isoformat().replace('+00:00', 'Z'),
    "status": "success" if not failures else "partial_failure",
    "pages_checked": pages_checked,
    "changes_found": changes_found,
    "errors": errors  # ← BASIC ERROR MESSAGES
}
```

#### Failure Log (lines 268-278)
```python
if failures:
    print(f"\n--- Fetch completed with {len(failures)} failures. ---", file=sys.stderr)
    with open(FAILURE_LOG_FILE, "w") as f:  # failures.log
        for failure in failures:
            f.write(json.dumps(failure) + "\n")
```

**Current Behavior:**
- ✅ **Run status tracking**: `success` vs `partial_failure`
- ✅ **Error message logging**: Basic error strings saved
- ✅ **Failure details**: Written to `failures.log` file
- ❌ **No error classification**: All errors treated as generic failures
- ❌ **No alerting mechanism**: Errors logged but no notifications sent
- ❌ **No persistent failure tracking**: No way to detect chronic URL problems

## 🚨 Critical Gaps Identified

### 1. Silent 404 Handling with Playwright

**THE BIG PROBLEM**: Playwright doesn't check HTTP status codes by default!

```python
page.goto(url, timeout=60000, wait_until='domcontentloaded')
content = page.content()  # ← GETS 404 PAGE CONTENT, NOT ERROR!
```

**What Actually Happens:**
- ✅ httpx: 404 → `HTTPStatusError` → retry → failure logged
- ❌ Playwright: 404 → returns "This page isn't available" HTML → SUCCESS!

**Impact**: The Instagram Commerce Policies 404 was likely "successfully" fetched as HTML content containing "This Page Isn't Available" message.

### 2. No Error Classification

All errors treated identically:
- 404 (permanent failure) → retry (pointless)  
- Network timeout (transient) → retry (good)
- 403 (access blocked) → retry (pointless)
- 500 (server error) → retry (good)

### 3. No Health Monitoring

- No way to detect URLs that are chronically failing
- No visibility into which URLs are working vs broken
- No alerts for system health degradation

### 4. Poor Failure Visibility

- Errors logged to files, not operational systems
- No dashboard integration showing URL health
- No way to proactively detect broken monitoring

## 🔧 Required Fixes

### Phase 1: Immediate Fixes

1. **Fix Playwright HTTP Status Checking**
```python
response = page.goto(url, timeout=60000, wait_until='domcontentloaded')
if response.status >= 400:
    raise Exception(f"HTTP {response.status}: {response.status_text}")
```

2. **Add Error Classification**
```python
class URLError:
    BROKEN_LINK = "404_not_found"      # Don't retry
    ACCESS_DENIED = "403_forbidden"     # Don't retry  
    SERVER_ERROR = "5xx_server_error"   # Retry
    NETWORK_TIMEOUT = "timeout"         # Retry
    UNKNOWN = "unknown_error"           # Retry once
```

3. **Smart Retry Logic**
- Don't retry 404s or 403s
- Exponential backoff for server errors
- Different retry counts by error type

### Phase 2: Health Monitoring

1. **Health Check Endpoint**
- Separate daily URL health validation
- Quick HEAD requests to check accessibility
- Status tracking independent of content fetching

2. **Enhanced Logging**
```json
{
  "url": "https://example.com/policy",
  "status_code": 404,
  "error_type": "broken_link", 
  "retry_count": 0,
  "last_success": "2025-01-01T10:00:00Z",
  "consecutive_failures": 3
}
```

3. **Dashboard Integration**
- Real-time URL health indicators
- Historical uptime tracking
- Alert thresholds for chronic failures

## 🎯 Testing Plan

### Test Scenarios to Validate

1. **404 with httpx**: Should fail and be logged
2. **404 with Playwright**: Currently succeeds (BUG!), should fail  
3. **Network timeout**: Should retry and eventually fail
4. **403 Access Denied**: Should fail immediately, no retry
5. **500 Server Error**: Should retry with backoff
6. **Temporary DNS failure**: Should retry

### Test Implementation

```python
# Create test URLs that return specific status codes
test_urls = [
    {"url": "http://httpbin.org/status/404", "expected": "broken_link"},
    {"url": "http://httpbin.org/status/403", "expected": "access_denied"},
    {"url": "http://httpbin.org/status/500", "expected": "server_error"},
    {"url": "http://httpbin.org/delay/10", "expected": "timeout"},
]
```

## 💡 Next Steps

1. **Validate current behavior** with test cases
2. **Fix Playwright HTTP status checking**
3. **Implement error classification**
4. **Add smart retry logic**
5. **Deploy to dev branch for testing**
6. **Monitor improvements in production**

This analysis reveals why we didn't detect the Instagram Commerce Policies failure - Playwright was successfully fetching the 404 error page as content!