#!/bin/bash

# Subscription API Server Launcher
echo "🚀 Starting Policy Watch Subscription API..."

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

# Start the API server
echo "📧 Email notifications will be sent to: ${RECIPIENT_EMAIL:-lyori6us@gmail.com}"
echo "🌐 API will be available at: http://localhost:8080/api/subscribe"
echo ""

python3 subscribe.py