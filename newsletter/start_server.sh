#!/bin/bash

# Newsletter Subscription Server Launcher
echo "🚀 Starting Newsletter Subscription Server..."

# Check if environment variables are set
if [ -z "$RESEND_API_KEY" ]; then
    echo "❌ ERROR: RESEND_API_KEY environment variable not set"
    echo "Please run: export RESEND_API_KEY='your_key_here'"
    exit 1
fi

# Load environment if available
if [ -f "../load_env.sh" ]; then
    source "../load_env.sh"
fi

# Start the subscription server
echo "📧 Email notifications will be sent to: ${RECIPIENT_EMAIL:-lyori6us@gmail.com}"
echo ""

python3 subscribe.py