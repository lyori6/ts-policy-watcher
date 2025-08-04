#!/bin/bash
# Script to load local environment variables for testing

if [ -f ".env.local" ]; then
    echo "Loading environment variables from .env.local..."
    export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)
    echo "Environment loaded. You can now run:"
    echo "  python3 scripts/fetch.py"
    echo "  python3 scripts/diff_and_notify.py"
else
    echo "Error: .env.local file not found!"
    echo "Please create .env.local with your API keys first."
    exit 1
fi