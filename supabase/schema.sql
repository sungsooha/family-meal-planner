-- Supabase schema for Ha Family Table

create table if not exists recipes (
  recipe_id text primary key,
  name text not null,
  name_original text,
  meal_types jsonb,
  servings integer,
  source_url text,
  thumbnail_url text,
  notes text,
  family_feedback_score numeric,
  family_feedback jsonb,
  ingredients jsonb,
  ingredients_original jsonb,
  instructions jsonb,
  instructions_original jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists recipe_sources (
  recipe_id text primary key,
  source text not null,
  source_url text,
  thumbnail_url text,
  title text,
  top_comment text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


create table if not exists daily_plans (
  date date primary key,
  meals jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists shopping_state (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

create table if not exists buy_lists (
  id text primary key,
  week_start date not null,
  week_end date not null,
  saved_at timestamptz not null,
  status text not null,
  lang text not null,
  items jsonb not null,
  created_at timestamptz default now()
);

create table if not exists config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

create index if not exists buy_lists_week_start_idx on buy_lists (week_start);
create index if not exists buy_lists_week_end_idx on buy_lists (week_end);

-- Seed default config if missing
insert into config (key, value)
values ('default', '{"family_size":4, "max_repeat_per_week":2}')
on conflict (key) do nothing;
