#!/bin/bash

# Test Resend API with curl
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_SoF8AxLT_NGYh7RUUXeUYVQ9jbVVZ3w5m' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "Policy Watcher <onboarding@resend.dev>",
    "to": ["lyori6ux+tswatcher@gmail.com"],
    "subject": "Policy Watcher Test Email",
    "html": "<h1>Test Email</h1><p>This is a test email from the Policy Watcher system.</p>"
  }'