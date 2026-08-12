-- ============================================================================
-- Pass'Teny — Schéma Supabase
-- ----------------------------------------------------------------------------
-- Ce que vit dans Postgres (mutables, fréquemment mis à jour) :
--   profils/rôles/réputation, soumissions d'annotations, votes, révisions,
--   glossaire, seuils paramétrables, index de recherche du contenu Git.
-- Le contenu canon (lyrics + annotations validées) reste dans le repo Git.
--
-- Application : dans le SQL Editor du projet Supabase.
-- ============================================================================

create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- ── Types ────────────────────────────────────────────────────────────────────
do $$ begin
  create type public.user_role as enum ('contributor', 'trusted', 'moderator');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.annotation_status as enum ('pending', 'approved', 'merged', 'rejected');
exception when duplicate_object then null; end $$;

-- ── Profils ──────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique not null check (char_length(username) between 3 and 24),
  display_name  text,
  github_handle text,
  role          public.user_role not null default 'contributor',
  reputation    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Index du contenu Git (pour recherche & navigation) ──────────────────────
-- NB : `unaccent` seul n'est pas IMMUTABLE (dépend du search_path) ; on passe
-- par un wrapper immutable pour pouvoir l'utiliser dans une colonne générée.
create or replace function public.unaccent_text(input text)
returns text
language sql
immutable
parallel safe
return public.unaccent(input);

create table if not exists public.songs (
  id            text primary key,            -- slug du titre (identique au repo content)
  artist_slug   text not null,
  artist_name   text not null,
  title         text not null,
  album         text,
  language      text[] not null default '{}',
  lyrics_txt    text not null default '',    -- miroir du lyrics.txt pour la recherche
  search        tsvector generated always as (
                   setweight(to_tsvector('simple', public.unaccent_text(coalesce(title, ''))), 'A') ||
                   setweight(to_tsvector('simple', public.unaccent_text(coalesce(artist_name, ''))), 'B') ||
                   setweight(to_tsvector('simple', public.unaccent_text(coalesce(lyrics_txt, ''))), 'C')
                 ) stored,
  content_sha   text,                        -- dernier commit/arborescence vu
  updated_at    timestamptz not null default now()
);

create index if not exists songs_search_idx on public.songs using gin (search);
create index if not exists songs_artist_idx on public.songs (artist_slug);

-- ── Annotations ──────────────────────────────────────────────────────────────
create table if not exists public.annotations (
  id            uuid primary key default gen_random_uuid(),
  song_id       text not null references public.songs (id) on delete cascade,
  start_offset  integer not null check (start_offset >= 0),
  end_offset    integer not null check (end_offset > start_offset),
  quote         text not null,
  body          text not null check (char_length(body) >= 4),
  tags          text[] not null default '{}',
  author_id     uuid not null references public.profiles (id) on delete cascade,
  status        public.annotation_status not null default 'pending',
  score         integer not null default 0,  -- somme des votes
  pr_number     integer,                     -- PR GitHub ouverte (merged → canon)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists annotations_song_idx on public.annotations (song_id);
create index if not exists annotations_status_idx on public.annotations (status);
create index if not exists annotations_author_idx on public.annotations (author_id);

-- ── Révisions (historique des contributions, exigence V1) ───────────────────
create table if not exists public.annotation_versions (
  id            uuid primary key default gen_random_uuid(),
  annotation_id uuid not null references public.annotations (id) on delete cascade,
  body          text not null,
  author_id     uuid not null references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index if not exists annotation_versions_ann_idx
  on public.annotation_versions (annotation_id, created_at desc);

-- ── Votes (±1, un vote par profil et par annotation) ────────────────────────
create table if not exists public.votes (
  annotation_id uuid not null references public.annotations (id) on delete cascade,
  voter_id      uuid not null references public.profiles (id) on delete cascade,
  value         smallint not null check (value in (-1, 1)),
  created_at    timestamptz not null default now(),
  primary key (annotation_id, voter_id)
);

-- ── Glossaire des expressions locales ───────────────────────────────────────
create table if not exists public.glossary_terms (
  id         uuid primary key default gen_random_uuid(),
  term       text not null,
  meaning    text not null,
  language   text not null default 'mg',
  example    text,
  author_id  uuid references public.profiles (id) on delete set null,
  approved   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists glossary_term_idx on public.glossary_terms (lower(term));

-- ── Réglages (seuils de montée en grade, modération) ────────────────────────
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value) values
  ('reputation',            '{"annotation": 3, "vote_received": 1, "annotation_voted": 1}'),
  ('roles',                 '{"trusted": {"merged": 5, "votes_received": 10}, "moderator": {"merged": 25, "age_days": 90}}'),
  ('auto_pr',               '{"min_net_votes": 3, "require_trusted_voter": true}'),
  ('auto_merge',            '{"enabled": true, "author_min_merged": 5}'),
  ('moderation',            '{"launch_mode": "manual"}')   -- manual → équipe ; community → vote
on conflict (key) do nothing;

-- ── Recherche full-text (upgrade — à appliquer pour le classement ts_rank) ──
-- La recherche V1 utilise ILIKE multi-champs via PostgREST (aucune migration).
-- Pour un classement par pertinence et la recherche de mots entiers, appliquer
-- cette fonction puis interroger : POST /rest/v1/rpc/search_songs
create or replace function public.search_songs(query text, max_results integer default 20)
returns setof public.songs
language sql
stable
as $$
  select *
    from public.songs
   where search @@ websearch_to_tsquery('simple', public.unaccent_text(coalesce(query, '')))
   order by ts_rank(search, websearch_to_tsquery('simple', public.unaccent_text(coalesce(query, '')))) desc
   limit max_results;
$$;

-- ── Fonctions utilitaires ────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.recalc_annotation_score()
returns trigger language plpgsql as $$
declare
  v_annotation_id uuid;
begin
  -- after delete => new est NULL : on remonte l'id depuis old.
  v_annotation_id := coalesce(new.annotation_id, old.annotation_id);
  update public.annotations
     set score = (select coalesce(sum(value), 0) from public.votes where annotation_id = v_annotation_id)
   where id = v_annotation_id;
  return coalesce(new, old);
end $$;

-- ── Triggers ─────────────────────────────────────────────────────────────────
drop trigger if exists profiles_updated_at  on public.profiles;
drop trigger if exists annotations_updated_at on public.annotations;
drop trigger if exists votes_score on public.votes;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger annotations_updated_at before update on public.annotations
  for each row execute function public.set_updated_at();

create trigger votes_score after insert or update or delete on public.votes
  for each row execute function public.recalc_annotation_score();

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.profiles            enable row level security;
alter table public.songs               enable row level security;
alter table public.annotations         enable row level security;
alter table public.annotation_versions enable row level security;
alter table public.votes               enable row level security;
alter table public.glossary_terms      enable row level security;
alter table public.settings            enable row level security;

-- Profils : lecture publique, écriture sur son propre profil.
create policy profiles_read  on public.profiles for select using (true);
create policy profiles_self  on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update on public.profiles for update using (auth.uid() = id);

-- Chansons (index du contenu Git) : lecture publique.
create policy songs_read on public.songs for select using (true);

-- Annotations : lecture publique, soumission pour tout utilisateur connecté,
-- mise à jour par l'auteur (pending), modération par les modérateurs.
create policy annotations_read on public.annotations for select using (true);
create policy annotations_insert on public.annotations for insert
  with check (auth.uid() = author_id);
create policy annotations_update_author on public.annotations for update
  using (auth.uid() = author_id and status = 'pending');
create policy annotations_moderate on public.annotations for update
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('trusted', 'moderator')
  ));

-- Révisions : lecture publique, insertion par l'auteur de la révision.
create policy versions_read on public.annotation_versions for select using (true);
create policy versions_insert on public.annotation_versions for insert
  with check (auth.uid() = author_id);

-- Votes : lecture publique, un vote par profil.
create policy votes_read on public.votes for select using (true);
create policy votes_insert on public.votes for insert
  with check (
    auth.uid() = voter_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('trusted', 'moderator')
    )
  );
create policy votes_delete on public.votes for delete
  using (auth.uid() = voter_id);

-- Glossaire : lecture publique, proposition par tout utilisateur connecté.
create policy glossary_read on public.glossary_terms for select using (true);
create policy glossary_insert on public.glossary_terms for insert
  with check (auth.uid() = author_id and approved = false);

-- Settings : lecture publique, écriture modérateurs.
create policy settings_read on public.settings for select using (true);
create policy settings_write on public.settings for update
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'moderator'
  ));
