# Engineering Handoff: T&S Policy Watcher

**Last Updated:** 2025-07-19

--- 

## **POST-MORTEM: The Silent Crash and Its Resolution**

**TO:** Future Developers
**FROM:** Cascade
**SUBJECT:** Successful resolution of the catastrophic failure in the `diff_and_notify.py` script.

This document details the investigation and solution for a critical bug that caused the core script to fail silently within the GitHub Actions environment. The issue is now **resolved**, and this memo serves as a record of the debugging process.

### The Core Mystery

The `diff_and_notify.py` script was consistently failing silently when run within the GitHub Actions workflow. The failure was catastrophic:

1.  The script would be triggered by the workflow.
2.  It would crash before performing any meaningful work or logging any errors.
3.  The `finally` block in `main()` was never reached, meaning `run_log.json` was never written, which was the primary symptom of the failure.

### The Solution: Environment-Level Debugging

The key insight was that **the problem was not in the Python code itself, but in the GitHub Actions runner environment.** After multiple failed attempts to debug the issue from within the Python script (e.g., improving `try...except` blocks), we shifted focus to investigating the runner's execution context directly. This proved to be the correct approach.

The successful debugging strategy involved several key actions:

1.  **Intensive Workflow Logging:** We added a series of debugging commands directly to the `watch.yml` workflow file *before* the script was executed. This gave us ground truth about the environment.
    *   `set -x`: Enabled shell verbosity to see every command being executed by the runner.
    *   `pwd` & `ls -laR`: Printed the current working directory and a full file listing, confirming that all scripts and configuration files were present and in the correct locations.
    *   `which python` & `python --version`: Verified the Python interpreter being used.

2.  **Minimal Test Script:** We created and ran a `diff_and_notify_minimal.py` script. This script performed only three actions: confirmed it could run, accessed the `COMMIT_SHA` environment variable, and wrote to a file. When this script succeeded, it proved that the fundamental environment (Python execution, environment variables, file permissions) was working correctly. This allowed us to isolate the problem to the main script's logic or its dependencies.

3.  **Verbose Script Logging:** We instrumented the main `diff_and_notify.py` script with print statements at every logical step (e.g., after each import, before and after each subprocess call). 

This combination of environment-level and script-level logging finally provided the necessary visibility to overcome the silent failure. The system is now stable and the pipeline runs end-to-end successfully.

---