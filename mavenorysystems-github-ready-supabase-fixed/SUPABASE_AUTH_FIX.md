# Supabase Auth + Upgrade Fix

This version replaces the old placeholder upgrade button with real Supabase Auth + Lemon Squeezy checkout logic.

## Required edit before deploy

Open `app.html` and replace:

```js
SUPABASE_URL: "https://YOUR_PROJECT_ID.supabase.co",
SUPABASE_PUBLISHABLE_KEY: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY",
```

with your real Supabase project URL and publishable/anon key.

Do not paste Supabase secret/service_role key into `app.html`.

The secret key stays only in Netlify Environment Variables as `SUPABASE_SECRET_KEY`.

## Flow

1. User creates a free workspace with Supabase Auth.
2. Supabase creates the user.
3. Supabase trigger creates `profiles` row with `plan=free` and `product_limit=3`.
4. User clicks Upgrade.
5. App calls `/.netlify/functions/create-checkout` with Supabase `userId` and email.
6. Lemon Squeezy checkout opens.
7. Lemon Squeezy webhook updates `profiles.plan=full`.
