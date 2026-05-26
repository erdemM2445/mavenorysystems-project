-- Mavenory Systems Profit Planner SaaS Backend Schema
-- Final model:
-- Free Starter: forever free, no card required, full feature access, 3 product/SKU limit
-- Full Planner: paid subscription, unlimited products
-- Domain/slug: mavenorysystems
-- Display brand: Mavenory Systems

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  plan text not null default 'free',
  access_status text not null default 'active',
  product_limit integer default 3,
  subscription_status text not null default 'free_starter',
  lemon_customer_id text,
  lemon_subscription_id text,
  lemon_variant_id text,
  lemon_order_id text,
  renews_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_name text not null default 'Mavenory Systems Workspace',
  currency text not null default 'USD',
  listing_fee numeric(12,4) not null default 0.20,
  transaction_fee numeric(12,4) not null default 0.065,
  payment_rate numeric(12,4) not null default 0.030,
  payment_fixed_fee numeric(12,4) not null default 0.25,
  min_profit_hour numeric(12,2) not null default 15,
  min_net_margin numeric(12,4) not null default 0.20,
  default_service_z numeric(12,4) not null default 1.65,
  low_sales_threshold integer not null default 3,
  high_return_threshold numeric(12,4) not null default 0.15,
  product_capacity integer not null default 100,
  default_price_increase numeric(12,4) not null default 0.10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, plan, access_status, product_limit, subscription_status
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    'free',
    'active',
    3,
    'free_starter'
  )
  on conflict (id) do nothing;

  insert into public.workspace_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sku text not null,
  name text not null,
  category text,
  variant text,
  selling_price numeric(12,2) not null default 0,
  material_cost numeric(12,2) not null default 0,
  packaging_cost numeric(12,2) not null default 0,
  shipping_cost numeric(12,2) not null default 0,
  labor_minutes numeric(12,2) not null default 0,
  current_stock numeric(12,2) not null default 0,
  lead_time_days numeric(12,2) not null default 0,
  service_level_z numeric(12,4) not null default 1.65,
  demand_std_dev_day numeric(12,4) not null default 1,
  return_rate numeric(12,4) not null default 0.03,
  ad_spend_unit numeric(12,2) not null default 0,
  target_hourly_wage numeric(12,2) not null default 15,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, sku)
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku text not null,
  sale_date date not null default current_date,
  units_sold numeric(12,2) not null default 1,
  revenue numeric(12,2) not null default 0,
  refunds numeric(12,2) not null default 0,
  ad_spend numeric(12,2) not null default 0,
  channel text default 'Etsy',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sku text not null,
  price_change_rate numeric(12,4) not null default 0.10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, sku)
);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  total_revenue numeric(12,2) not null default 0,
  total_profit numeric(12,2) not null default 0,
  avg_margin numeric(12,4) not null default 0,
  avg_profit_hour numeric(12,2) not null default 0,
  action_notes text,
  snapshot jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, week_start)
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists set_workspace_settings_updated_at on public.workspace_settings;
create trigger set_workspace_settings_updated_at before update on public.workspace_settings
for each row execute procedure public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at before update on public.products
for each row execute procedure public.set_updated_at();

drop trigger if exists set_sales_updated_at on public.sales;
create trigger set_sales_updated_at before update on public.sales
for each row execute procedure public.set_updated_at();

drop trigger if exists set_price_changes_updated_at on public.price_changes;
create trigger set_price_changes_updated_at before update on public.price_changes
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.price_changes enable row level security;
alter table public.weekly_reports enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select
to authenticated using ((select auth.uid()) = id);

drop policy if exists "Users can read own workspace settings" on public.workspace_settings;
create policy "Users can read own workspace settings" on public.workspace_settings for select
to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can update own workspace settings" on public.workspace_settings;
create policy "Users can update own workspace settings" on public.workspace_settings for update
to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own workspace settings" on public.workspace_settings;
create policy "Users can insert own workspace settings" on public.workspace_settings for insert
to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can CRUD own products" on public.products;
create policy "Users can CRUD own products" on public.products for all
to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can CRUD own sales" on public.sales;
create policy "Users can CRUD own sales" on public.sales for all
to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can CRUD own price changes" on public.price_changes;
create policy "Users can CRUD own price changes" on public.price_changes for all
to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can CRUD own weekly reports" on public.weekly_reports;
create policy "Users can CRUD own weekly reports" on public.weekly_reports for all
to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists products_user_id_idx on public.products(user_id);
create index if not exists products_user_sku_idx on public.products(user_id, sku);
create index if not exists sales_user_id_idx on public.sales(user_id);
create index if not exists sales_user_sku_idx on public.sales(user_id, sku);
create index if not exists sales_user_date_idx on public.sales(user_id, sale_date desc);
