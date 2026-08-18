# Pass'Teny

> *« Ny hevitry ny teny »* — le sens des mots.

Plateforme communautaire d'explication et d'annotation des lyrics de la musique
malgache, dans l'esprit de Genius. **Produit indépendant** de l'écosystème
Pass'io (rattaché à la marque uniquement).

**Domaine cible :** `teny.passiio.shop`

---

## Architecture

| Brique | Outil | Rôle |
|---|---|---|
| Front + Back | **Next.js 16** (App Router, TypeScript) | Unifie front et back |
| Hébergement | **Vercel** (gratuit) | Déploiement auto, CDN, ISR |
| Base de données | **Supabase** (gratuit) | Auth, soumissions, votes, réputation, recherche |
| Contenu canon | **Repo GitHub public** `pass-teny-content` | Lyrics + annotations versionnées |
| Intégration GitHub | **Octokit** | Ouverture/merge automatique des PR (phase 1) |

### Principe

- **Le contenu canon vit dans Git** (`content/` → repo `pass-teny-content`) :
  versioning natif, modération par review de PR, réputation dérivable du log Git.
- **Les données mutables vivent dans Supabase** (`schema.sql`) : comptes, votes,
  soumissions en attente, réputation.
- **L'app ne clone jamais le repo content** : lecture via
  `raw.githubusercontent.com` (cache ISR), écriture via PR (Octokit, serveur).

## Structure

```
app/                    # Pages (accueil, artistes, titres) + API routes
components/             # LyricsView (rendu annoté)
lib/
  config.ts             # Configuration centralisée (.env)
  types.ts              # Modèle de contenu (meta, annotations, songs)
  content/              # Parser LRC, moteur d'annotations, source de contenu
  github.ts             # Client Octokit (PR — phase 1)
  supabase/             # Clients Supabase (navigateur / serveur)
content/                # Miroir local du repo pass-teny-content (généré)
scripts/                # seed-from-passio.mjs
schema.sql              # Schéma Supabase complet (tables, RLS, recherche)
```

## Système Git (stockage du contenu)

Pass'Teny repose sur **deux dépôts Git distincts** :

| Repo | Contenu | Remote |
|---|---|---|
| **pass-teny-content** (public) | Lyrics + annotations versionnés (source de vérité) | `PassTeny/content/` → `git@github.com:Narindra0/pass-teny-content.git` |
| **pass-teny** (app, à créer) | Code Next.js de la plateforme | `PassTeny/` → à décider (voir plus bas) |

### État actuel du repo content

- `PassTeny/content/` est un **repo git autonome** (branche `main`), déjà initialisé
  et commité (seed initial de 28 titres + `.gitattributes` LF).
- Il est ignoré par le repo de l'app (`.gitignore` → `/content/*`).

### Ce qu'il reste à faire (manuel, compte GitHub)

1. Créer sur GitHub le repo **`pass-teny-content`** (public, sans README/licence).
2. Pousser le contenu local :

```bash
cd PassTeny/content
git push -u origin main
```

3. **(Option app)** Décider du sort du code de la plateforme :
   - **Option A — repo dédié (recommandé)** : créer `pass-teny` sur GitHub, puis
     `git init`/`push` depuis `PassTeny/` — déploiement Vercel direct.
   - **Option B — monorepo** : garder `PassTeny/` dans le repo `pass-io` et
     déployer Vercel avec `rootDirectory: PassTeny`.

> ⚠ Le contenu est versionné en **LF** (`.gitattributes`) : les annotations
> référencent `lyrics.txt` par offsets caractères, des fins de ligne instables
> casseraient les citations.

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis remplir
npm run dev                  # http://localhost:3000
```

### Contenu local

En développement, le site lit le dossier `content/`. Pour le générer depuis le
catalogue Pass'io :

```bash
node scripts/seed-from-passio.mjs            # 28 titres avec lyrics (API Pass'io)
node scripts/seed-from-passio.mjs --dry-run  # aperçu sans écrire
```

### Migrations automatiques

`schema.sql` est appliqué au projet Supabase **automatiquement** par
`scripts/db-migrate.mjs` (API Management Supabase — le même canal que le SQL
Editor), déclenché avant chaque `npm run dev` et `npm run build`. Le schéma est
rejouable (`if not exists`, `drop policy if exists`, `on conflict do nothing`).

```bash
npm run db:migrate            # appliquer maintenant
npm run db:migrate -- --strict  # exit 1 si échec (CI)
```

Prérequis unique : un jeton `SUPABASE_ACCESS_TOKEN` dans `.env.local`
(Supabase → Account → Access Tokens, permission database write). Sans jeton,
la migration est ignorée sans bloquer le démarrage — le code retombe alors sur
l'ancien comportement.

## État d'avancement

- **Phase 0 — Fondations ✅**
  - [x] Scaffold Next.js (TypeScript, Tailwind, ESLint)
  - [x] Lecture du contenu local + pages accueil / artiste / titre
  - [x] Rendu des lyrics avec annotations cliquables (LyricsView)
  - [x] Script de seed depuis le catalogue Pass'io (métadonnées + lyrics .lrc/.txt)
  - [x] Schéma Supabase complet (tables, RLS, recherche full-text)
  - [x] Spécification du repo content (`content/README.md`)
  - [ ] Création du projet Supabase + application du `schema.sql` *(compte à créer)*
  - [ ] Création/push du repo `pass-teny-content` *(compte GitHub)*
  - [ ] Déploiement Vercel + domaine `teny.passiio.shop` *(compte Vercel)*
- **Phase 1 — Contribution ✅ (en cours de finalisation)**
  - [x] Auth Supabase : magic link, création auto du profil, déconnexion
  - [x] Onboarding au premier login : choix du pseudo + liens Facebook/Instagram optionnels
    (colonnes `facebook_url`, `instagram_url`, `onboarding_done` — migration auto via `npm run db:migrate`)
  - [x] Soumission d'annotation par sélection de texte (offsets validés serveur)
  - [x] Votes des contributeurs de confiance (seuil → pipeline PR)
  - [x] Ouverture automatique de PR sur `pass-teny-content` (Octokit) + auto-merge
  - [x] Webhook GitHub (merge → statut `merged` + réputation)
  - [x] Réputation et montée en grade (contributeur → contributeur de confiance)
  - [ ] Configurer le webhook GitHub (GITHUB_WEBHOOK_SECRET) — optionnel en dev
- **Phase 2 — Découverte ✅**
  - [x] Recherche full-text (index `songs` : titre, artiste, paroles) — page `/search`
  - [x] Glossaire des ohabolana (`/glossary`) + proposition de termes en attente d'approbation
  - [x] Tags thématiques : vue `/tags` + page par tag (`/tags/[tag]`)
  - [x] Cartes de partage statiques : `/api/og` (satori) + og:image sur les pages titres + bouton « Carte partageable »
  - [x] Script d'indexation `scripts/index-content.mjs` (content → songs) + seed glossaire
  - [x] Recherche fluide : insensible aux accents (normalisation app), extraits de paroles, classement par pertinence — la RPC `search_songs` (ts_rank, schema.sql) est utilisée automatiquement dès qu'appliquée au projet Supabase
  - [x] **Ajout de lyrics (« Proposer un titre »)** : recherche du titre dans le catalogue Pass'io
    (`/api/passio/*`, proxy serveur), ajout des paroles en **LRC ou TXT** (pré-remplissage si
    Pass'io les possède), **quota journalier** par utilisateur (`settings.lyrics_quota`, défaut 5),
    anti-doublon atomique (index unique `artist_slug, song_slug`)
  - [x] **Publication « tout automatique »** (`settings.moderation.launch_mode` = `auto` par défaut) :
    la soumission publie directement sur le repo content (commit sur `main`, pas de PR) — la limite
    journalière (quota) est le seul frein. Mode `manual` : la suggestion reste en attente et
    l'approbation d'un modérateur (`/moderation`) déclenche la publication. Les publications sont
    sérialisées (chaque commit relit `index.json` fraîchement → zéro conflit même si deux
    utilisateurs soumettent en même temps). En dev, le miroir local `content/` est synchronisé
    automatiquement (`git pull`) après chaque publication.
  - [x] Bootstrap des modérateurs : `MODERATOR_EMAILS` au login, sinon le premier inscrit (fondateur)
    est promu tant qu'aucun modérateur n'existe
  - [x] Interface compte dans le header : menu profil (pseudo, rôle, « Ajouter une parole », déconnexion)
- **Identité visuelle ✅** — « Ny lamban'ny teny » : palette lamba (ivoire/latérite/vert/or),
  typographies Fraunces + Spline Sans/Mono, bande tissée signature, paroles en serif
  recueil, carte OG refondue, mode sombre neutralisé
- **Images ✅** — fallback Cloudinary → ImageKit (`a6ywpqgqor`) → placeholder SVG,
  avatars artistes avec cover de release en repli (système Frontend4Fan)
- **Phase 3 — Modération & V2** (file de modération, karaoké)

## Identité visuelle

**Direction : « Ny lamban'ny teny » — le tissage des mots.**
Identité éditoriale claire (pas de dark premium façon Pass'io), inspirée du
lamba akotofahana, le tissu de soie traditionnel malgache.

| Axe | Choix |
|---|---|
| Palette | Ivoire papier `#f7f1e4`, encre `#211b12`, rouge latérite `#a63a2b`, vert `#43633f`, or `#c4912e` |
| Signature | Bande tissée `.lamba-band` (frise de segments latérite/ivoire/vert/or/encre) sous le header et au-dessus du footer + losange tissé `.lamba-mark` (marque du logo) |
| Display | **Fraunces** (serif éditoriale, italiques pour « teny ») |
| Corps | **Spline Sans** |
| Données | **Spline Sans Mono** (compteurs, libellés, breadcrumbs) |
| Paroles | Serif Fraunces (lecture façon recueil) — `.lyric-line` |
| Mode sombre | Neutralisé (`@custom-variant dark` inactif) — thème clair par nature |
| Carte OG | Ivoire + bande tissée en segments flex (satori) + Fraunces via `next/font` |

Le remap des tokens Tailwind (`zinc` → palette ivoire, `amber` → rouge
latérite) fait hériter toutes les pages de l'identité sans réécriture massive.

**Pass premium « chart éditorial »** — composition inspirée de Genius (le
« déjà-vu » du leader des annotations) réexprimée dans les couleurs lamba :
bandeaux encre (header/footer), classement numéroté du catalogue (`.rank-num`),
top annotateurs communautaire, et surligneur or (`.bg-hl`) sur les passages
annotés — le jaune Genius tissé en or lamba.

## Points ouverts

- Seuils de montée en grade (valeurs par défaut dans `schema.sql` → `settings`)
- Recherche full-text : config Postgres `simple` + `unaccent` (V1), Algolia en upgrade
- Gouvernance de lancement : modération manuelle (défaut) puis communautaire
