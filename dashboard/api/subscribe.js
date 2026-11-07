// Vercel serverless function: POST /api/subscribe
// Emails the project owner (via Resend) when someone subscribes from the
// dashboard widget. Needs RESEND_API_KEY and RECIPIENT_EMAIL set in the
// Vercel project's environment variables.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Abuse limits. Each request emails the owner, so cap how often that can happen.
// These counters live in this function instance's memory: they reset on a cold start
// and are not shared between instances, so they slow down a flood rather than stop it.
// A Vercel Firewall rate limit on /api/subscribe is the hard limit (see docs/SECURITY.md).
const PER_IP_LIMIT = 3;                    // requests per IP per window
const PER_IP_WINDOW_MS = 10 * 60 * 1000;   // 10 minutes
const GLOBAL_LIMIT = 20;                   // owner emails per instance per hour
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const DEDUPE_MS = 24 * 60 * 60 * 1000;     // same address only notifies once a day
const MAX_TRACKED = 5000;

const ipHits = new Map();
const recentEmails = new Map();
let globalSends = [];

function prune(map, maxAgeMs, now) {
    if (map.size < MAX_TRACKED) return;
    for (const [key, value] of map) {
        const last = Array.isArray(value) ? value[value.length - 1] : value;
        if (now - last > maxAgeMs) map.delete(key);
    }
    if (map.size >= MAX_TRACKED) map.clear();
}

function clientIp(req) {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '');
    return forwarded.split(',')[0].trim() || String(req.headers?.['x-real-ip'] || 'unknown');
}

function ipAllowed(ip, now) {
    prune(ipHits, PER_IP_WINDOW_MS, now);
    const hits = (ipHits.get(ip) || []).filter((t) => now - t < PER_IP_WINDOW_MS);
    hits.push(now);
    ipHits.set(ip, hits);
    return hits.length <= PER_IP_LIMIT;
}

function globalAllowed(now) {
    globalSends = globalSends.filter((t) => now - t < GLOBAL_WINDOW_MS);
    return globalSends.length < GLOBAL_LIMIT;
}

function isDuplicate(email, now) {
    prune(recentEmails, DEDUPE_MS, now);
    const last = recentEmails.get(email);
    return last !== undefined && now - last < DEDUPE_MS;
}

// Test hook: lets the local test reset counters between cases.
function resetLimits() {
    ipHits.clear();
    recentEmails.clear();
    globalSends = [];
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { RESEND_API_KEY, RECIPIENT_EMAIL } = process.env;
    if (!RESEND_API_KEY || !RECIPIENT_EMAIL) {
        console.error('Subscribe: RESEND_API_KEY or RECIPIENT_EMAIL is not configured');
        return res.status(500).json({ success: false, error: 'Subscriptions are not configured' });
    }

    const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
    if (!contentType.startsWith('application/json')) {
        return res.status(415).json({ success: false, error: 'Send JSON' });
    }

    const now = Date.now();
    if (!ipAllowed(clientIp(req), now)) {
        res.setHeader('Retry-After', String(PER_IP_WINDOW_MS / 1000));
        return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        if (body.length > 2000) return res.status(413).json({ success: false, error: 'Request too large' });
        try { body = JSON.parse(body); } catch { body = {}; }
    }

    const email = String(body?.email || '').trim().toLowerCase();
    const source = String(body?.source || 'dashboard').slice(0, 50);

    if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
        return res.status(400).json({ success: false, error: 'Please enter a valid email address' });
    }

    // A repeat of a recent address gets the same success answer, but no second email.
    if (isDuplicate(email, now)) {
        return res.status(200).json({ success: true });
    }
    if (!globalAllowed(now)) {
        console.error('Subscribe: hourly notification budget reached');
        return res.status(429).json({ success: false, error: 'Too many requests. Please try again later.' });
    }
    globalSends.push(now);
    recentEmails.set(email, now);

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
            // Status only: Resend can echo the submitted address back in its error body.
            console.error('Subscribe: Resend error', response.status);
            recentEmails.delete(email); // let them try again
            return res.status(502).json({ success: false, error: 'Could not send the subscription request' });
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Subscribe: request failed', error?.name || 'Error');
        recentEmails.delete(email);
        return res.status(502).json({ success: false, error: 'Could not send the subscription request' });
    }
}

module.exports = handler;
module.exports.resetLimits = resetLimits;
