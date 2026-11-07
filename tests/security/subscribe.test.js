// Run with: node --test tests/security/subscribe.test.js
// Checks the abuse limits in dashboard/api/subscribe.js with a fake Resend.
const test = require('node:test');
const assert = require('node:assert');
const handler = require('../../dashboard/api/subscribe.js');

process.env.RESEND_API_KEY = 'test-key';
process.env.RECIPIENT_EMAIL = 'owner@example.com';

let sends = 0;
let nextOk = true;
global.fetch = async () => { sends++; return { ok: nextOk, status: nextOk ? 200 : 500, text: async () => 'echo' }; };

function call({ email = 'a@example.com', ip = '1.1.1.1', type = 'application/json' } = {}) {
    const req = { method: 'POST', headers: { 'content-type': type, 'x-forwarded-for': ip }, body: { email } };
    const res = { code: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    return handler(req, res).then(() => res);
}

test.beforeEach(() => { handler.resetLimits(); sends = 0; nextOk = true; });

test('sends one email for a valid signup', async () => {
    assert.equal((await call()).code, 200);
    assert.equal(sends, 1);
});

test('rejects non-JSON bodies', async () => {
    assert.equal((await call({ type: 'text/plain' })).code, 415);
    assert.equal(sends, 0);
});

test('same address twice sends one email', async () => {
    await call({ ip: '2.2.2.1' });
    const r = await call({ ip: '2.2.2.2' });
    assert.equal(r.code, 200);
    assert.equal(sends, 1);
});

test('limits one IP to 3 requests per window', async () => {
    const codes = [];
    for (let i = 0; i < 12; i++) codes.push((await call({ email: `u${i}@example.com` })).code);
    assert.deepEqual(codes.slice(0, 3), [200, 200, 200]);
    assert.ok(codes.slice(3).every((c) => c === 429));
    assert.equal(sends, 3);
});

test('caps total owner emails per hour', async () => {
    for (let i = 0; i < 30; i++) await call({ email: `g${i}@example.com`, ip: `10.0.0.${i}` });
    assert.equal(sends, 20);
});

test('a failed send can be retried', async () => {
    nextOk = false;
    assert.equal((await call({ ip: '3.3.3.1' })).code, 502);
    nextOk = true;
    assert.equal((await call({ ip: '3.3.3.2' })).code, 200);
    assert.equal(sends, 2);
});
