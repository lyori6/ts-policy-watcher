# Policy Watch Newsletter

A simple and beautiful newsletter subscription form that allows users to subscribe to policy change notifications.

## Features

- ✨ Clean, responsive design that matches your dashboard
- 📧 Sends you email notifications when someone subscribes  
- 🔒 Email validation and privacy-focused
- 📱 Mobile-friendly design
- 🚀 No third-party services required (uses your existing Resend setup)

## How it works

1. User visits the newsletter page and enters their email
2. Form submits to your local server
3. Server validates the email and sends you a notification
4. You manually add the email to your subscriber list
5. They'll automatically get policy change notifications

## Setup

### 1. Start the subscription server
```bash
cd newsletter
./start_server.sh
```

### 2. Serve the static files
You can serve the newsletter form using any web server. For development:
```bash
# From the main project directory
python3 -m http.server 8000
```

Then visit: `http://localhost:8000/newsletter/`

### 3. Environment Variables
The server uses your existing environment variables:
- `RESEND_API_KEY` - Your Resend API key
- `RECIPIENT_EMAIL` - Where subscription notifications are sent (defaults to lyori6us@gmail.com)

## Files

- `index.html` - The newsletter subscription form
- `style.css` - Beautiful, responsive styling
- `script.js` - Form handling and validation
- `subscribe.py` - Backend server for processing subscriptions
- `start_server.sh` - Easy launcher script

## Integration

To add this to your main dashboard, you could:
1. Add a "Subscribe to Updates" link in your dashboard header
2. Create a dedicated `/newsletter` route
3. Embed the form in a modal on your main page

## Customization

The form is fully customizable:
- Colors match your dashboard theme
- Easy to modify text and styling
- Add additional fields if needed
- Integrates with your existing email infrastructure

## Production Notes

For production deployment:
- Consider using a reverse proxy (nginx)
- Add rate limiting for form submissions
- Set up proper logging
- Consider adding a simple database to track subscribers