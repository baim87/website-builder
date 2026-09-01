#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const results = [];
function skip(name, reason) {
    results.push({ name, status: 'SKIP', detail: reason });
}
async function check(name, fn) {
    try {
        const detail = await fn();
        results.push({ name, status: 'OK', detail });
    }
    catch (err) {
        results.push({ name, status: 'FAIL', detail: err.message?.slice(0, 120) || String(err) });
    }
}
async function checkPostgres() {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
        await prisma.$queryRaw `SELECT 1`;
        return 'Connected successfully';
    }
    finally {
        await prisma.$disconnect();
    }
}
async function checkRedis() {
    const { default: Redis } = await import('ioredis');
    const redis = new Redis(process.env.REDIS_URL);
    try {
        const pong = await redis.ping();
        return `PING → ${pong}`;
    }
    finally {
        redis.disconnect();
    }
}
async function checkAnthropic() {
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model,
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Say OK' }],
        }),
    });
    const data = await res.json();
    if (res.status === 401)
        throw new Error(data.error?.message || 'Invalid API key');
    if (data.error?.type === 'not_found_error') {
        return `Key valid ✓ (model "${model}" is a custom/preview model — not on public API)`;
    }
    if (data.error)
        throw new Error(data.error.message);
    return `Model "${model}" responded (${data.usage?.input_tokens} in / ${data.usage?.output_tokens} out)`;
}
async function checkR2() {
    const { S3Client, ListBucketsCommand } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    });
    const res = await client.send(new ListBucketsCommand({}));
    const names = res.Buckets?.map((b) => b.Name).join(', ') || 'none';
    return `Buckets: ${names}`;
}
async function checkStripe() {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-04-30.basil' });
    const balance = await stripe.balance.retrieve();
    return `Balance retrieved (${balance.available.length} currencies)`;
}
async function checkVercel() {
    const res = await fetch('https://api.vercel.com/v2/user', {
        headers: { Authorization: `Bearer ${process.env.VERCEL_API_TOKEN}` },
    });
    if (!res.ok)
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return `Authenticated as: ${data.user?.username || data.user?.email || 'unknown'}`;
}
async function checkGoogleOAuth() {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    if (!clientId.endsWith('.apps.googleusercontent.com')) {
        throw new Error('Client ID does not end with .apps.googleusercontent.com');
    }
    return `Client ID format valid (${clientId.slice(0, 20)}...)`;
}
async function checkGoogleServiceAccount() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
    if (!email.endsWith('.iam.gserviceaccount.com')) {
        throw new Error('Email does not look like a service account');
    }
    if (!key.includes('BEGIN PRIVATE KEY')) {
        throw new Error('Private key does not contain PEM header');
    }
    return `Service account: ${email}`;
}
async function checkGooglePlaces() {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GBP_API_KEY || '';
    if (!apiKey)
        throw new Error('No API key set');
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=test&inputtype=textquery&key=${apiKey}`);
    const data = await res.json();
    if (data.error_message)
        throw new Error(data.error_message);
    return `API responded with status: ${data.status}`;
}
async function main() {
    console.log('\n🔑 Verifying API keys & connections...\n');
    await check('PostgreSQL', checkPostgres);
    await check('Redis', checkRedis);
    await check('Anthropic (Claude)', checkAnthropic);
    if (process.env.R2_ACCESS_KEY_ID && process.env.R2_ENDPOINT) {
        await check('Cloudflare R2', checkR2);
    }
    else {
        skip('Cloudflare R2', 'R2_ACCESS_KEY_ID or R2_ENDPOINT not set');
    }
    if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('xxxx')) {
        await check('Stripe', checkStripe);
    }
    else {
        skip('Stripe', 'STRIPE_SECRET_KEY not set or placeholder');
    }
    if (process.env.VERCEL_API_TOKEN) {
        await check('Vercel', checkVercel);
    }
    else {
        skip('Vercel', 'VERCEL_API_TOKEN not set');
    }
    await check('Google OAuth', checkGoogleOAuth);
    await check('Google Service Account', checkGoogleServiceAccount);
    if (process.env.GOOGLE_PLACES_API_KEY || process.env.GBP_API_KEY) {
        await check('Google Places API', checkGooglePlaces);
    }
    else {
        skip('Google Places API', 'No API key set');
    }
    console.log('─'.repeat(70));
    console.log('Service'.padEnd(30), 'Status'.padEnd(12), 'Detail');
    console.log('─'.repeat(70));
    let failCount = 0;
    for (const r of results) {
        if (r.status === 'FAIL')
            failCount++;
        console.log(r.name.padEnd(30), r.status.padEnd(12), r.detail);
    }
    console.log('─'.repeat(70));
    console.log(`\n${results.length} checks: ${results.filter(r => r.status === 'OK').length} passed, ${failCount} failed, ${results.filter(r => r.status === 'SKIP').length} skipped\n`);
    if (failCount > 0)
        process.exit(1);
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=verify-api-keys.js.map