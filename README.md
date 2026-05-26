# Mavenory Systems Profit Planner

GitHub/Netlify-ready project structure for Mavenory Systems.

## Final product model

- **Free Starter**: forever free, no card required, all modules open, up to 3 products/SKUs.
- **Full Planner**: paid subscription via Lemon Squeezy, unlimited products/SKUs.

## Project structure

```text
mavenorysystems-project/
  index.html
  app.html
  netlify.toml
  package.json
  .env.example

  netlify/
    functions/
      create-checkout.js
      lemonsqueezy-webhook.js

  supabase/
    schema.sql

  frontend-snippets/
    browser-config.html
    free-starter-rules.md

  brand/
    MAVENORY_SYSTEMS_BRAND.md

  FINAL_ROADMAP.md
```

## Netlify build settings

Use these settings when importing from GitHub:

```text
Base directory: leave empty
Build command: leave empty
Publish directory: .
```

`netlify.toml` already points Netlify Functions to:

```text
netlify/functions
```

## Required Netlify environment variables

Add these in Netlify → Site configuration → Environment variables:

```text
SITE_URL=https://YOUR-NETLIFY-SITE.netlify.app
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SECRET_KEY=...
LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_STORE_ID=...
LEMONSQUEEZY_VARIANT_ID=...
LEMONSQUEEZY_WEBHOOK_SECRET=...
```

After adding environment variables, redeploy the site.

## Important implementation note

This repo is arranged for the final Netlify + Supabase + Lemon Squeezy architecture. The included `app.html` is the current frontend MVP and still keeps workspace data in browser storage until you connect its save/load functions to Supabase.

The backend pieces are included:

- `supabase/schema.sql` creates the database tables and RLS policies.
- `netlify/functions/create-checkout.js` creates Lemon Squeezy checkout sessions.
- `netlify/functions/lemonsqueezy-webhook.js` updates `profiles.plan` after subscription events.

## Test URLs after deploy

```text
https://YOUR-SITE.netlify.app
https://YOUR-SITE.netlify.app/app
https://YOUR-SITE.netlify.app/.netlify/functions/create-checkout
https://YOUR-SITE.netlify.app/.netlify/functions/lemonsqueezy-webhook
```

Opening `create-checkout` in the browser may show `Method not allowed`; this is normal because it expects a POST request from the app.

## Supabase setup

1. Create a Supabase project named `Mavenory Systems`.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Enable Email Auth.
4. Add the Netlify URL to Supabase Auth redirect URLs:

```text
https://YOUR-SITE.netlify.app/*
https://YOUR-SITE.netlify.app/app
https://YOUR-SITE.netlify.app/app/*
```

## Lemon Squeezy setup

Create one paid subscription product:

```text
Product: Mavenory Systems Profit Planner
Variant: Full Planner Monthly
Price: $9/month
Free trial: OFF
```

Webhook URL during Netlify test:

```text
https://YOUR-SITE.netlify.app/.netlify/functions/lemonsqueezy-webhook
```

Select subscription events:

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

## Going live with domain

After everything works on Netlify test URL:

1. Connect `mavenorysystems.com` in Netlify.
2. Set `SITE_URL=https://mavenorysystems.com` in Netlify env.
3. Update Supabase redirect URLs to include `https://mavenorysystems.com/*`.
4. Update Lemon Squeezy webhook URL to `https://mavenorysystems.com/.netlify/functions/lemonsqueezy-webhook`.
5. Redeploy.
