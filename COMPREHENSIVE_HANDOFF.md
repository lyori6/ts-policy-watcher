## 📞 **Handoff Instructions for Next Developer**

**Last Updated**: 2025-07-22  
**Status**: ✅ **RESOLVED** - False positive issue has been successfully fixed!

### **1. System Overview**

You are inheriting the **T&S Policy Watcher**, a Python-based automated intelligence system. Its purpose is to monitor the Trust & Safety policy pages of competitors (YouTube, TikTok, etc.), detect content changes, use AI to summarize them, and send email notifications.

- **Core Logic**: `scripts/fetch.py` scrapes pages and saves HTML snapshots. `scripts/diff_and_notify.py` was intended to find changed snapshots, but the primary change detection now resides in `fetch.py` to prevent saving snapshots if no meaningful content change is detected.
- **Architecture**: It runs on a schedule via GitHub Actions. It uses `httpx` and `playwright` for scraping, `BeautifulSoup` for HTML cleaning, and `git` for versioning snapshots.

### **2. The Critical Problem: Persistent False Positives**

The system suffers from a persistent false positive issue, specifically with Google/YouTube policy pages. On every run, the script detects changes to these pages even when the visible policy text has not changed. This triggers unnecessary snapshot updates and would cause spam notifications, undermining the system's value.

### **3. Chronicle of the Investigation (What We've Tried)**

Our debugging has been a process of elimination, progressively narrowing down the root cause:

1.  **Initial Fix: Stable Filenames & Git Logic**: We first addressed an issue where snapshots were saved with timestamps, causing every run to be a "change." We fixed this by using a stable `snapshot.html` filename and corrected the `git diff` logic in `diff_and_notify.py` to compare against the parent commit. This solved the most basic false positives.

2.  **Second Fix: HTML Cleaning**: We then discovered that dynamic HTML elements (like ads, recommendations, and invisible metadata) were causing changes. We implemented a `clean_html` function in `fetch.py` using `BeautifulSoup` to strip `<script>`, `<style>`, `<meta>`, and other non-content tags, and then compared the normalized plain text.

3.  **Third Fix: Surgical Cleaning**: This fixed most pages, but three YouTube policies remained. We added debug logic to `diff` the *cleaned text* between two consecutive fetches. This revealed dynamic text from a "Was this helpful?" feedback form. We updated `clean_html` to be more surgical, first isolating the main article `div` and then explicitly removing the `div.article-survey-container` from it. This was a significant improvement.

4.  **Final Diagnosis: The True Root Cause**: Despite these efforts, the same YouTube pages continued to show changes. As a final diagnostic step, we modified `fetch.py` to save the **raw, unfiltered HTML** from two consecutive fetches to `/tmp/fetch1.html` and `/tmp/fetch2.html` and diffed them.

### **4. Definitive Root Cause & Key Evidence**

The raw `diff` revealed the definitive culprit: **dynamically generated `nonce` attributes within `<script>` tags.**

**Evidence (`diff /tmp/fetch1.html /tmp/fetch2.html`):**
```diff
< script nonce="vG+wIsGiIqsawlRSSf7z">...</script>
---
> script nonce="yrQSTs77msrGjAQX1ydX">...</script>
```
On every page load, Google's server generates a unique `nonce` (number used once) for every inline script for security purposes (Content Security Policy). These nonces are different on every single request.

**The core problem is that our `clean_html` function, while designed to remove `<script>` tags entirely, is not preventing these changes from registering.** The comparison logic in `fetch.py` is as follows:

```python
# From scripts/fetch.py
old_content = read_file(snapshot_path)
new_content = fetch_content(page['url'], renderer)

if not old_content or clean_html(old_content) != clean_html(new_content):
    # Write new snapshot
```

This implies one of two possibilities:
1.  The `clean_html` function is not successfully removing all script tags before the comparison.
2.  The `new_content` variable, which is raw HTML, is being compared or handled elsewhere before it gets cleaned.

### **5. Your Task & Recommended Next Steps**

Your mission is to fix this final piece of the puzzle.

1.  **Reproduce the Issue**: Run the following commands to see the raw diff for yourself.
    ```bash
    # Run the script in debug mode to fetch the raw files
    DEBUG_FETCH=1 python3 scripts/fetch.py

    # Diff the raw output to see the nonce changes
    diff /tmp/fetch1.html /tmp/fetch2.html
    ```

2.  **Focus on `scripts/fetch.py`**: The error is almost certainly in the `clean_html` function or the main processing loop where it's called. Review this logic flow meticulously.

3.  **Hypothesize and Test Solutions**:
    *   **Is BeautifulSoup failing?** Add print statements inside `clean_html` to see the HTML *after* the `decompose()` calls. Is it possible some malformed HTML is preventing the scripts from being parsed and removed correctly?
    *   **Aggressive Cleaning**: Consider an alternative, more aggressive cleaning method. Instead of decomposing specific tags, perhaps create a new `BeautifulSoup` object containing *only* the desired `div.article-body-container` and its contents. This would implicitly discard everything else.
    *   **Serialization Issue**: Could the issue be how BeautifulSoup serializes the cleaned HTML back to a string for comparison? Test different parsers (`lxml`, `html.parser`).

4.  **Validate the Fix**: Once you've implemented a change, run `python3 scripts/fetch.py` (with debug mode off). A successful fix will result in "NO CHANGE" being printed for all YouTube policies after the initial baseline is set.

**Note on `hashlib` errors**: You will see `ValueError: unsupported hash type blake2b` errors in the logs. These appear to be red herrings related to the Python environment's OpenSSL version and have not impeded our debugging. You can likely ignore them.

By solving the `nonce` issue, you will have fully resolved the false positive problem and made the T&S Policy Watcher a reliable, high-value intelligence tool.

---

## 🎉 **RESOLUTION COMPLETED** (2025-07-22)

### **Final Root Cause Analysis**

The false positive issue was **successfully diagnosed and fixed**. The actual root cause was more complex than initially suspected:

1. **Dynamic Follow Button IDs**: Google/YouTube pages generate random IDs for follow buttons (e.g., `follow-button-0.875129209325659`) that change on every request
2. **Zwieback Session IDs**: Hidden `<div data-page-data-key="zwieback_id">` elements contain dynamic session numbers that change per request
3. **Script Nonces**: CSP nonce attributes in `<script>` tags change on every page load
4. **Article Body Selector Issue**: The original `clean_html` function looked for `class="article-body"` but Google pages use `itemprop="articleBody"`

### **Solution Implemented**

Enhanced the `clean_html()` function in `scripts/fetch.py` with comprehensive dynamic content filtering:

```python
# Key improvements made:
1. Fixed article body detection (added itemprop="articleBody" support)
2. Remove dynamic ID patterns with regex (.*-\d+\.\d+.*)
3. Remove subscribe/follow button containers (div.subscribe-btn)
4. Remove zwieback_id tracking divs
5. Remove hidden elements with display:none styling
6. Enhanced script/style/meta tag removal
```

### **Verification Results**

✅ **All YouTube policies now show consistent "NO CHANGE" behavior:**
- youtube-community-guidelines: NO CHANGE ✓
- youtube-harassment-policy: NO CHANGE ✓  
- youtube-shopping-ads-policy: NO CHANGE ✓
- youtube-hiding-users: NO CHANGE ✓

✅ **Multiple consecutive runs confirm the fix is stable and reliable**

### **Debug Tools Added**

Added `DEBUG_FETCH=1` environment variable support for future troubleshooting:
```bash
DEBUG_FETCH=1 python3 scripts/fetch.py
```
This saves raw HTML and cleaned content to `/tmp/{slug}_fetch*.html` and `/tmp/{slug}_cleaned*.txt` for comparison.

### **Next Steps for Operations**

The system is now **production-ready** and will reliably detect only genuine policy content changes. You can safely:

1. **Commit and push changes** to the repository
2. **Enable the GitHub Actions workflow** for automated monitoring  
3. **Set up email notifications** for detected policy changes
4. **Monitor the system** - it should now run cleanly without false positives

The T&S Policy Watcher is now a fully functional, reliable intelligence tool! 🚀