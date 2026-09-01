# Sliplane Deployment Guide
# ========================
#
# Sliplane deploys Docker containers from your repo.
# 
# Prerequisites:
#   1. A Sliplane account (https://sliplane.io)
#   2. A managed PostgreSQL instance (e.g. Neon, Supabase, or Sliplane's own)
#   3. A managed Redis instance (e.g. Upstash, or Sliplane's own)
#
# Setup Steps:
#   1. Connect your GitHub repo to Sliplane
#   2. Set the Dockerfile path to: backend/Dockerfile
#   3. Set the build context to: backend/
#   4. Configure the following environment variables in Sliplane dashboard
#
# Required Environment Variables:
#   NODE_ENV=production
#   PORT=3000
#   APP_URL=https://api.yourdomain.com
#   FRONTEND_URL=https://app.yourdomain.com
#   DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
#   REDIS_URL=redis://default:pass@host:6379
#   JWT_SECRET=<generate-strong-random-string-32-chars-min>
#   GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
#   GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>
#   GOOGLE_CALLBACK_URL=https://api.yourdomain.com/auth/google/callback
#   ANTHROPIC_API_KEY=<your-anthropic-api-key>
#   STRIPE_SECRET_KEY=<your-stripe-live-key>
#   STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
#   STRIPE_SUBSCRIPTION_PRICE_ID=<your-stripe-price-id>
#   R2_ACCOUNT_ID=<cloudflare-account-id>
#   R2_ACCESS_KEY_ID=<r2-access-key>
#   R2_SECRET_ACCESS_KEY=<r2-secret-key>
#   R2_BUCKET_NAME=<r2-bucket>
#   R2_ENDPOINT=<r2-endpoint-url>
#   R2_PUBLIC_URL=<r2-public-url>
#   VERCEL_API_TOKEN=<vercel-token>
#   VERCEL_TEAM_ID=<vercel-team-id>
#   VERCEL_PROJECT_ID=<vercel-project-id>
#   BYPASS_BILLING=false
#
# Health Check:
#   Path: /health
#   Port: 3000
#   Expected: 200 OK
#
# The Dockerfile automatically runs `prisma migrate deploy` on startup
# to apply any pending migrations before the app starts.
