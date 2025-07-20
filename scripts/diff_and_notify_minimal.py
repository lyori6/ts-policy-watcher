#!/usr/bin/env python3
"""
Minimal test version of diff_and_notify.py to isolate the silent crash issue.
This script reduces the functionality to its absolute simplest form to determine
if the issue is with Python execution, imports, or environment variables.
"""

import sys
import os
import json
from datetime import datetime

def main():
    print("=== MINIMAL DIFF_AND_NOTIFY TEST ===")
    print("Python is running successfully!")
    
    try:
        print(f"Python version: {sys.version}")
        print(f"Current working directory: {os.getcwd()}")
        print(f"Script location: {__file__}")
        
        # Test environment variable access
        commit_sha = os.environ.get("COMMIT_SHA")
        print(f"COMMIT_SHA environment variable: '{commit_sha}'")
        
        # Test file operations
        run_log_file = "run_log.json"
        print(f"Attempting to write to {run_log_file}...")
        
        log_entry = {
            "timestamp_utc": datetime.utcnow().isoformat() + 'Z',
            "status": "minimal_test_success",
            "test_info": "Minimal script executed successfully"
        }
        
        with open(run_log_file, 'w') as f:
            json.dump([log_entry], f, indent=2)
        
        print(f"✓ Successfully wrote {run_log_file}")
        print("=== MINIMAL TEST COMPLETED SUCCESSFULLY ===")
        
    except Exception as e:
        print(f"ERROR in minimal test: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()