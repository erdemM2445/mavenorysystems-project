# Mavenory Systems Profit Planner — Final SaaS Roadmap

## Final model

Display brand:
Mavenory Systems

Domain / technical slug:
mavenorysystems

Product:
Mavenory Systems Profit Planner

Free model:
Free Starter, forever free, no card required, all modules open, 3 product/SKU limit.

Paid model:
Full Planner, subscription, unlimited products/SKUs.

## Core architecture

mavenorysystems.com
- marketing website
- positioning
- pricing
- CTA to app

mavenorysystems.com/app
- authenticated SaaS app
- full product dashboard

Supabase
- Auth
- database
- user-based data
- RLS

Lemon Squeezy
- paid subscription
- checkout
- webhook

Netlify
- hosting
- serverless functions

## App modules

All modules are open in Free Starter and Full Planner.

1. Dashboard
2. Products
3. Sales Input
4. CSV Import
5. Product Analysis
6. Reorder Planner
7. Pricing Simulator
8. Variant Comparison
9. Weekly Report
10. Settings
11. Billing

Free Starter capacity:
- max 3 products/SKUs
- CSV import allowed, but max 3 unique SKUs
- all analytics visible
- upgrade CTA when user tries to add/import more than 3 products

Full Planner capacity:
- unlimited products
- unlimited sales rows
- full CSV workflows
- full export
- full shop analysis

## Database access model

Free Starter:
- plan = free
- access_status = active
- product_limit = 3

Full Planner:
- plan = full
- access_status = active
- product_limit = null

## Launch checklist

1. Prepare project folder.
2. Put landing page as index.html.
3. Put SaaS app as app.html.
4. Add netlify.toml.
5. Add package.json.
6. Add Netlify functions.
7. Create Supabase project: Mavenory Systems.
8. Run supabase/schema.sql.
9. Enable Supabase Email Auth.
10. Add Supabase redirect URLs.
11. Add Supabase keys to Netlify environment variables.
12. Create Lemon Squeezy product: Mavenory Systems Profit Planner.
13. Create subscription variant: Full Planner.
14. Add Lemon Squeezy environment variables to Netlify.
15. Deploy to Netlify.
16. Register a test user.
17. Confirm profile auto-created as free.
18. Add 3 products.
19. Confirm all modules work with 3 products.
20. Confirm 4th product is blocked with upgrade CTA.
21. Test CSV import with 3 SKUs.
22. Test CSV import with 4+ SKUs and block/upgrade CTA.
23. Test checkout.
24. Test webhook.
25. Confirm plan becomes full.
26. Confirm unlimited products unlock.
27. Connect mavenorysystems.com.
28. Go live.

## Success criteria

A user can:
- register without card
- use every module with up to 3 products
- see real value before paying
- upgrade when they need more products
- continue with unlimited products after payment
