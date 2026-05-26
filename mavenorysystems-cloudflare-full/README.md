# Mavenory Systems Profit Planner

Production-ready Cloudflare Pages package for **Mavenory Systems Profit Planner**.

## Stack

- Cloudflare Pages for frontend hosting
- Cloudflare Pages Functions for backend endpoints
- Supabase Auth + Postgres + RLS for workspace data
- Lemon Squeezy for subscription checkout and webhooks

## What is included

```text
index.html                       Landing page
app.html                         Full web app
upgrade.html                     Upgrade page
success.html / cancel.html       Checkout return pages
config.js                        Public browser config
assets/styles.css                UI styles
assets/app.js                    App logic
functions/api/create-checkout.js Lemon Squeezy checkout endpoint
functions/api/lemonsqueezy-webhook.js Lemon Squeezy webhook endpoint
supabase/schema.sql              Database schema + RLS + product limit trigger
_redirects                       Cloudflare route aliases
_headers                         Security headers
.env.example                     Cloudflare env variable list
```

## Important security rule

Never put these in GitHub or browser code:

```text
SUPABASE_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
LEMONSQUEEZY_API_KEY
LEMONSQUEEZY_WEBHOOK_SECRET
```

Only these are safe to paste into `config.js`:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY / anon public key
SITE_URL
```

If you previously pasted an `sb_secret_...` key in `app.html`, rotate/delete that key in Supabase.

## Cloudflare Pages deployment

Use these settings:

```text
Framework preset: None
Build command: leave empty
Build output directory: .
Root directory: / or this folder if it is inside a larger repo
```

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Go to Authentication -> URL Configuration.
5. Set:

```text
Site URL: https://mavenorysystems.pages.dev
Redirect URLs:
https://mavenorysystems.pages.dev/**
https://*.mavenorysystems.pages.dev/**
```

If your Cloudflare Pages production domain is different, use that exact URL.

## Public browser config

Open `config.js` and replace:

```js
SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
SUPABASE_PUBLISHABLE_KEY: "sb_publishable_REPLACE_ME",
SITE_URL: "https://mavenorysystems.pages.dev"
```

## Cloudflare environment variables

Add these in Cloudflare:

```text
SITE_URL=https://mavenorysystems.pages.dev
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_REPLACE_ME
SUPABASE_SECRET_KEY=sb_secret_OR_SERVICE_ROLE_REPLACE_ME
LEMONSQUEEZY_API_KEY=YOUR_LEMON_API_KEY
LEMONSQUEEZY_STORE_ID=YOUR_STORE_ID
LEMONSQUEEZY_VARIANT_ID=YOUR_FULL_PLANNER_MONTHLY_VARIANT_ID
LEMONSQUEEZY_WEBHOOK_SECRET=YOUR_RANDOM_WEBHOOK_SECRET
```

Public values must match `config.js`. Secret values must only be added to Cloudflare environment variables.

## Lemon Squeezy setup

Create one subscription product:

```text
Product: Mavenory Systems Profit Planner
Variant: Full Planner Monthly
Price: $9/month
```

Webhook URL:

```text
https://mavenorysystems.pages.dev/api/lemonsqueezy-webhook
```

Use the same signing secret you set as `LEMONSQUEEZY_WEBHOOK_SECRET` in Cloudflare.

Recommended webhook events:

```text
subscription_created
subscription_updated
subscription_cancelled
subscription_resumed
subscription_expired
subscription_paused
subscription_unpaused
subscription_payment_success
subscription_payment_failed
```

## Test flow

1. Open `/app.html`.
2. Create a free workspace.
3. Click "Reset sample data".
4. Confirm Free Starter shows 3/3 products.
5. Click Upgrade.
6. Lemon Squeezy checkout should open.
7. Complete test payment.
8. Lemon Squeezy should call `/api/lemonsqueezy-webhook`.
9. Refresh app; plan should show Full Planner.

## Routes

```text
/          Landing page
/app      App alias
/app.html App
/upgrade  Upgrade alias
/success  Payment success
/cancel   Payment cancel
/api/create-checkout
/api/lemonsqueezy-webhook
```
