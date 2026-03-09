-- ============================================================
-- Se Poupe — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension (already on by default in Supabase)
create extension if not exists "uuid-ossp";


-- ─── PROFILES ──────────────────────────────────────────────
-- Extends Supabase Auth users with app-specific data
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text,
  phone         text,
  city          text,
  birthdate     date,
  avatar_emoji  text,
  salary        numeric(12,2) default 0,
  plan          text not null default 'free' check (plan in ('free','pro')),
  notif_email   boolean default true,
  notif_tips    boolean default true,
  notif_alerts  boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Auto-create profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─── USAGE ────────────────────────────────────────────────
-- Tracks monthly AI usage per user (for free plan limits)
create table if not exists public.usage (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  month       text not null,  -- e.g. "2025-06"
  ai_imports  integer default 0,
  ai_analysis integer default 0,
  unique (user_id, month)
);


-- ─── EXPENSES ─────────────────────────────────────────────
-- Main expense list (the "Despesas" tab)
create table if not exists public.expenses (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  value       numeric(12,2) not null,
  type        text not null default 'fixa' check (type in ('fixa','variavel')),
  category    text not null default 'Outros',
  created_at  timestamptz default now()
);


-- ─── GOALS ────────────────────────────────────────────────
create table if not exists public.goals (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  cost        numeric(12,2),
  deadline    text,
  created_at  timestamptz default now()
);


-- ─── MONTHLY PLANNING ─────────────────────────────────────
-- Independent expense rows per month (the "Planejamento" tab)
create table if not exists public.monthly_planning (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  month       text not null,  -- e.g. "2025-06"
  name        text not null,
  value       numeric(12,2) not null,
  type        text not null default 'fixa' check (type in ('fixa','variavel')),
  category    text not null default 'Outros',
  created_at  timestamptz default now()
);


-- ─── ROW LEVEL SECURITY ───────────────────────────────────
-- Users can only see and edit their own data

alter table public.profiles        enable row level security;
alter table public.usage           enable row level security;
alter table public.expenses        enable row level security;
alter table public.goals           enable row level security;
alter table public.monthly_planning enable row level security;

-- Profiles
create policy "Users manage own profile"
  on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

-- Usage
create policy "Users manage own usage"
  on public.usage for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Expenses
create policy "Users manage own expenses"
  on public.expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Goals
create policy "Users manage own goals"
  on public.goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Monthly planning
create policy "Users manage own planning"
  on public.monthly_planning for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ─── INDEXES ──────────────────────────────────────────────
create index if not exists idx_expenses_user        on public.expenses(user_id);
create index if not exists idx_goals_user           on public.goals(user_id);
create index if not exists idx_monthly_user_month   on public.monthly_planning(user_id, month);
create index if not exists idx_usage_user_month     on public.usage(user_id, month);
