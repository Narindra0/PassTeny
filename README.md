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
  - [x] Soumission d'annotation par sélection de texte (offsets validés serveur)
  - [x] Votes des contributeurs de confiance (seuil → pipeline PR)
  - [x] Ouverture automatique de PR sur `pass-teny-content` (Octokit) + auto-merge
  - [x] Webhook GitHub (merge → statut `merged` + réputation)
  - [x] Réputation et montée en grade (contributeur → contributeur de confiance)
  - [ ] Configurer le webhook GitHub (GITHUB_WEBHOOK_SECRET) — optionnel en dev
- **Phase 2 — Découverte** (recherche, glossaire, cartes de partage)
- **Phase 3 — Modération & V2** (file de modération, karaoké)

## Identité visuelle

**En attente de décision** — une identité éditoriale/culturelle propre sera
définie dans une étape dédiée (le template actuel est volontairement neutre).

## Points ouverts

- Seuils de montée en grade (valeurs par défaut dans `schema.sql` → `settings`)
- Recherche full-text : config Postgres `simple` + `unaccent` (V1), Algolia en upgrade
- Gouvernance de lancement : modération manuelle (défaut) puis communautaire
