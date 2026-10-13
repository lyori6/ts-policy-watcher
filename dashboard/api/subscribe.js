// Vercel serverless function: POST /api/subscribe
// Emails the project owner (via Resend) when someone subscribes from the
// dashboard widget. Needs RESEND_API_KEY and RECIPIENT_EMAIL set in the
// Vercel project's environment variables.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { RESEND_API_KEY, RECIPIENT_EMAIL } = process.env;
    if (!RESEND_API_KEY || !RECIPIENT_EMAIL) {
        console.error('Subscribe: RESEND_API_KEY or RECIPIENT_EMAIL is not configured');
        return res.status(500).json({ success: false, error: 'Subscriptions are not configured' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }

    const email = String(body?.email || '').trim().toLowerCase();
    const source = String(body?.source || 'dashboard').slice(0, 50);

    if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
        return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
    }

    const subscribedAt = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Policy Watcher <onboarding@resend.dev>',
                to: [RECIPIENT_EMAIL],
                reply_to: email,
                subject: `New Policy Watcher subscriber: ${email}`,
                html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px;">
                        <h2 style="margin: 0 0 12px;">New subscriber</h2>
                        <p style="margin: 0 0 4px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
                        <p style="margin: 0 0 4px; color: #475467;"><strong>Source:</strong> ${escapeHtml(source)}</p>
                        <p style="margin: 0 0 16px; color: #475467;"><strong>Subscribed:</strong> ${subscribedAt}</p>
                        <p style="margin: 0; color: #475467;">Add them to the weekly summary recipients. Replying to this email goes straight to the subscriber.</p>
                    </div>
                `
            })
        });

        if (!response.ok) {
            console.error('Subscribe: Resend error', response.status, await response.text());
            return res.status(502).json({ success: false, error: 'Could not send the subscription request' });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Subscribe: request failed', error);
        return res.status(502).json({ success: false, error: 'Could not send the subscription request' });
    }
};
