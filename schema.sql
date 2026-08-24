-- ============================================================================
-- Pass'Teny — Schéma Supabase
-- ----------------------------------------------------------------------------
-- Ce que vit dans Postgres (mutables, fréquemment mis à jour) :
--   profils/rôles/réputation, soumissions d'annotations, votes, révisions,
--   glossaire, seuils paramétrables, index de recherche du contenu Git.
-- Le contenu canon (lyrics + annotations validées) reste dans le repo Git.
--
-- Application : automatique via `npm run db:migrate` (scripts/db-migrate.mjs,
-- API Management Supabase — déclenché avant chaque `npm run dev`/`build`).
-- Le fichier est rejouable (idempotent) : on peut le relancer sans risque.
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
  id              uuid primary key references auth.users (id) on delete cascade,
  username        text unique not null check (char_length(username) between 3 and 24),
  display_name    text,
  github_handle   text,
  facebook_url    text,
  instagram_url   text,
  onboarding_done boolean not null default false,  -- premier login : pseudo + réseaux saisis
  role            public.user_role not null default 'contributor',
  reputation      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
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

-- ── Vues des titres (chart « les plus vus ») ─────────────────────────────────
-- Compteur par titre et par jour : agrégé pour le classement. Écriture
-- exclusive côté serveur (route /api/song-views, clé admin) — aucune policy
-- d'écriture, le comptage n'est pas modifiable par les clients.
create table if not exists public.song_views (
  song_id   text not null references public.songs (id) on delete cascade,
  view_date date not null default current_date,
  count     integer not null default 0,
  primary key (song_id, view_date)
);

create index if not exists song_views_song_idx on public.song_views (song_id);

-- Incrément atomique (évite la course lecture-modification-écriture).
create or replace function public.increment_song_view(p_song_id text)
returns void
language sql
as $$
  insert into public.song_views (song_id, view_date, count)
  values (p_song_id, current_date, 1)
  on conflict (song_id, view_date)
  do update set count = public.song_views.count + 1;
$$;

-- Agrégat vues par titre (une seule requête SQL au lieu de fetch + reduce en JS).
create or replace function public.get_song_views_total()
returns table(song_id text, total_views bigint)
language sql
stable
parallel safe
as $$
  select song_id, sum(count) as total_views
    from public.song_views
   group by song_id;
$$;

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

-- ── Suggestions de lyrics (ajout de titres au catalogue) ───────────────────
create table if not exists public.lyric_suggestions (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references public.profiles (id) on delete cascade,
  artist_name     text not null,
  artist_slug     text not null,
  track_title     text not null,
  song_slug       text not null,
  album_title     text,
  cover_url       text,
  passio_track_id text,
  passio_album_id text,
  lyrics_format   text not null check (lyrics_format in ('lrc', 'txt')),
  lyrics          text not null check (char_length(lyrics) >= 20),
  status          text not null default 'pending',  -- pending / merged / rejected
  pr_number       integer,
  created_at      timestamptz not null default now()
);

create index if not exists lyric_suggestions_author_idx
  on public.lyric_suggestions (author_id, created_at desc);
create index if not exists lyric_suggestions_status_idx
  on public.lyric_suggestions (status);

-- Anti-doublon : un même titre (artiste + slug) ne peut être proposé qu'une
-- fois — l'insert du second échoue atomiquement (race Sofie/Mark réglée).
drop index if exists lyric_suggestions_slug_idx;
create unique index if not exists lyric_suggestions_slug_idx
  on public.lyric_suggestions (artist_slug, song_slug);

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

-- ── Punchlines (paroles marquantes proposées par la communauté) ─────────────
create table if not exists public.punchlines (
  id          uuid primary key default gen_random_uuid(),
  song_id     text not null references public.songs (id) on delete cascade,
  quote       text not null check (char_length(quote) >= 4),
  context     text,                -- annotation / explication de la punchline
  author_id   uuid not null references public.profiles (id) on delete cascade,
  score       integer not null default 0,
  status      text not null default 'pending',  -- pending / approved / rejected
  created_at  timestamptz not null default now()
);

create index if not exists punchlines_song_idx on public.punchlines (song_id);
create index if not exists punchlines_author_idx on public.punchlines (author_id);
create index if not exists punchlines_status_idx on public.punchlines (status);
create index if not exists punchlines_score_idx on public.punchlines (score desc);

-- Votes punchlines (un vote par profil par punchline)
create table if not exists public.punchline_votes (
  punchline_id uuid not null references public.punchlines (id) on delete cascade,
  voter_id     uuid not null references public.profiles (id) on delete cascade,
  value        smallint not null check (value in (-1, 1)),
  created_at   timestamptz not null default now(),
  primary key (punchline_id, voter_id)
);

-- Trigger : recalc score punchline
create or replace function public.recalc_punchline_score()
returns trigger language plpgsql as $$
declare
  v_punchline_id uuid;
begin
  v_punchline_id := coalesce(new.punchline_id, old.punchline_id);
  update public.punchlines
     set score = (select coalesce(sum(value), 0) from public.punchline_votes where punchline_id = v_punchline_id)
   where id = v_punchline_id;
  return coalesce(new, old);
end $$;

drop trigger if exists punchline_votes_score on public.punchline_votes;
create trigger punchline_votes_score after insert or update or delete on public.punchline_votes
  for each row execute function public.recalc_punchline_score();

-- ── Articles communautaires (magazine) ──────────────────────────────────────
create table if not exists public.community_articles (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 5 and 200),
  subtitle    text,
  content     text not null check (char_length(content) >= 20),
  cover_url   text,              -- image de couverture (URL)
  category    text not null default 'journal' check (category in ('journal', 'analyse', 'portrait', 'réflexion', 'guide')),
  tags        text[] not null default '{}',
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  read_time   text,              -- ex. '5 min'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists community_articles_author_idx on public.community_articles (author_id);
create index if not exists community_articles_status_idx on public.community_articles (status);
create index if not exists community_articles_created_idx on public.community_articles (created_at desc);

-- RLS articles communautaires
alter table public.community_articles enable row level security;

drop policy if exists community_articles_read   on public.community_articles;
drop policy if exists community_articles_insert on public.community_articles;
drop policy if exists community_articles_update on public.community_articles;

-- Lecture : les articles approved sont publics, les pending sont visibles par l'auteur
create policy community_articles_read on public.community_articles
  for select using (
    status = 'approved'
    or author_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'trusted'))
  );

-- Écriture : tout connecté peut insérer ses propres articles
create policy community_articles_insert on public.community_articles
  for insert with check (author_id = auth.uid());

-- Modification : l'auteur ou un modérateur peut modifier
create policy community_articles_update on public.community_articles
  for update using (
    author_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and role in ('moderator', 'trusted'))
  );

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
  ('moderation',            '{"launch_mode": "auto"}'),     -- auto → publication directe ; manual → file de modération
  ('lyrics_quota',          '{"daily": 5}')                  -- ajouts de lyrics max / jour / utilisateur
on conflict (key) do nothing;

-- ── Onboarding — ajoute les colonnes de profil manquantes sur les projets
-- existants (l'onboarding au premier login devient actif dès leur présence).
alter table public.profiles
  add column if not exists facebook_url    text,
  add column if not exists instagram_url   text,
  add column if not exists onboarding_done boolean not null default false;

-- ── Recherche full-text (classement ts_rank, activée dès que la fonction existe) ──
-- La recherche V1 utilise ILIKE multi-champs via PostgREST (aucune migration).
-- Avec cette fonction, l'app interroge : POST /rest/v1/rpc/search_songs
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
alter table public.lyric_suggestions   enable row level security;
alter table public.song_views         enable row level security;
alter table public.punchlines          enable row level security;
alter table public.punchline_votes     enable row level security;

-- NB : chaque `create policy` est précédé d'un `drop policy if exists` pour
-- que schema.sql soit rejouable (migrations automatiques, `npm run db:migrate`).

-- Profils : lecture publique, écriture sur son propre profil.
drop policy if exists profiles_read  on public.profiles;
drop policy if exists profiles_self  on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_read  on public.profiles for select using (true);
create policy profiles_self  on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update on public.profiles for update using (auth.uid() = id);

-- Chansons (index du contenu Git) : lecture publique.
drop policy if exists songs_read on public.songs;
create policy songs_read on public.songs for select using (true);

-- Vues : lecture publique, écriture serveur uniquement (clé admin).
drop policy if exists song_views_read on public.song_views;
create policy song_views_read on public.song_views for select using (true);

-- Annotations : lecture publique, soumission pour tout utilisateur connecté,
-- mise à jour par l'auteur (pending), modération par les modérateurs.
drop policy if exists annotations_read on public.annotations;
drop policy if exists annotations_insert on public.annotations;
drop policy if exists annotations_update_author on public.annotations;
drop policy if exists annotations_moderate on public.annotations;
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
drop policy if exists versions_read on public.annotation_versions;
drop policy if exists versions_insert on public.annotation_versions;
create policy versions_read on public.annotation_versions for select using (true);
create policy versions_insert on public.annotation_versions for insert
  with check (auth.uid() = author_id);

-- Votes : lecture publique, un vote par profil.
drop policy if exists votes_read on public.votes;
drop policy if exists votes_insert on public.votes;
drop policy if exists votes_delete on public.votes;
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
drop policy if exists glossary_read on public.glossary_terms;
drop policy if exists glossary_insert on public.glossary_terms;
create policy glossary_read on public.glossary_terms for select using (true);
create policy glossary_insert on public.glossary_terms for insert
  with check (auth.uid() = author_id and approved = false);

-- Suggestions de lyrics : lecture publique (statut visible), proposition par
-- l'auteur, modération par l'équipe (statut + PR).
drop policy if exists lyric_suggestions_read on public.lyric_suggestions;
drop policy if exists lyric_suggestions_insert on public.lyric_suggestions;
create policy lyric_suggestions_read on public.lyric_suggestions for select using (true);
create policy lyric_suggestions_insert on public.lyric_suggestions for insert
  with check (auth.uid() = author_id and status = 'pending');

-- Settings : lecture publique, écriture modérateurs.
drop policy if exists settings_read on public.settings;
drop policy if exists settings_write on public.settings;
create policy settings_read on public.settings for select using (true);
create policy settings_write on public.settings for update
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'moderator'
  ));

-- Punchlines : lecture publique, soumission par tout connecté, modération.
drop policy if exists punchlines_read on public.punchlines;
drop policy if exists punchlines_insert on public.punchlines;
drop policy if exists punchlines_moderate on public.punchlines;
create policy punchlines_read on public.punchlines for select using (true);
create policy punchlines_insert on public.punchlines for insert
  with check (auth.uid() = author_id);
create policy punchlines_moderate on public.punchlines for update
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('trusted', 'moderator')
  ));

-- Votes punchlines : lecture publique, un vote par profil.
drop policy if exists punchline_votes_read on public.punchline_votes;
drop policy if exists punchline_votes_insert on public.punchline_votes;
drop policy if exists punchline_votes_delete on public.punchline_votes;
create policy punchline_votes_read on public.punchline_votes for select using (true);
create policy punchline_votes_insert on public.punchline_votes for insert
  with check (auth.uid() = voter_id);
create policy punchline_votes_delete on public.punchline_votes for delete
  using (auth.uid() = voter_id);
