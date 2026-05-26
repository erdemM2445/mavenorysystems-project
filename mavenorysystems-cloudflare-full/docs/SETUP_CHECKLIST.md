# Setup Checklist

## 1. Replace public browser config

Edit `config.js`:

```js
SITE_URL: "https://YOUR-PROJECT.pages.dev",
SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",
SUPABASE_PUBLISHABLE_KEY: "sb_publishable_..."
```

Do not paste `sb_secret_...` here.

## 2. Run Supabase schema

Supabase Dashboard -> SQL Editor -> paste and run `supabase/schema.sql`.

## 3. Supabase Auth URLs

Authentication -> URL Configuration:

```text
Site URL: https://YOUR-PROJECT.pages.dev
Redirect URLs:
https://YOUR-PROJECT.pages.dev/**
https://*.YOUR-PROJECT.pages.dev/**
```

## 4. Cloudflare Pages settings

```text
Framework preset: None
Build command: leave empty
Output directory: .
```

## 5. Cloudflare environment variables

```text
SITE_URL
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
LEMONSQUEEZY_API_KEY
LEMONSQUEEZY_STORE_ID
LEMONSQUEEZY_VARIANT_ID
LEMONSQUEEZY_WEBHOOK_SECRET
```

## 6. Lemon Squeezy webhook

Callback URL:

```text
https://YOUR-PROJECT.pages.dev/api/lemonsqueezy-webhook
```

Webhook signing secret must equal Cloudflare `LEMONSQUEEZY_WEBHOOK_SECRET`.

## 7. Final smoke test

- Landing opens.
- `/app.html` opens.
- Create account works.
- Sample data works.
- Product limit blocks 4th product on Free Starter.
- Upgrade opens Lemon Squeezy checkout.
- Webhook upgrades profile to Full.
