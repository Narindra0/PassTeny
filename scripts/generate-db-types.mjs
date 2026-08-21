#!/usr/bin/env node
/**
 * Génère lib/supabase/database.types.ts à partir du schéma PostgREST.
 *
 * Usage :
 *   node scripts/generate-db-types.mjs
 *
 * Lit les variables d'environnement depuis .env.local :
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY  (requis pour accéder au schéma REST)
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── Lecture des variables d'environnement ──────────────────────────────────
function loadEnv() {
  const envPath = resolve(ROOT, '.env.local')
  try {
    const content = readFileSync(envPath, 'utf-8')
    const vars = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      vars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
    }
    return vars
  } catch {
    return {}
  }
}

const env = { ...loadEnv(), ...process.env }
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL doit être défini.')
  process.exit(1)
}
if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY doit être défini (nécessaire pour lire le schéma REST).')
  process.exit(1)
}

// ── Récupération du schéma PostgREST ──────────────────────────────────────
async function fetchSchema() {
  const res = await fetch(SUPABASE_URL + '/rest/v1/', {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })

  if (!res.ok) {
    throw new Error(`Erreur HTTP ${res.status} en récupérant le schéma PostgREST`)
  }

  return res.json()
}

// ── Conversion PostgREST OpenAPI → types TypeScript ───────────────────────
function openApiToTsType(propSchema) {
  if (propSchema.enum) {
    return propSchema.enum.map((v) => `'${v}'`).join(' | ')
  }

  if (propSchema.type === 'array') {
    const itemType = openApiToTsType(propSchema.items || { type: 'string' })
    return `${itemType}[]`
  }

  switch (propSchema.type) {
    case 'string':
      return 'string'
    case 'integer':
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'string'
  }
}

// ── Relations FK (PostgREST ne les expose pas) ─────────────────────────
// Quand vous ajoutez une FK dans la base, ajoutez-la ici.
const FK_RELATIONS = [
  { table: 'annotations', fk: 'annotations_song_id_fkey', columns: ['song_id'], isOneToOne: false, refTable: 'songs', refColumns: ['id'] },
  { table: 'annotations', fk: 'annotations_author_id_fkey', columns: ['author_id'], isOneToOne: false, refTable: 'profiles', refColumns: ['id'] },
  { table: 'annotation_versions', fk: 'annotation_versions_annotation_id_fkey', columns: ['annotation_id'], isOneToOne: false, refTable: 'annotations', refColumns: ['id'] },
  { table: 'votes', fk: 'votes_annotation_id_fkey', columns: ['annotation_id'], isOneToOne: false, refTable: 'annotations', refColumns: ['id'] },
  { table: 'punchline_votes', fk: 'punchline_votes_punchline_id_fkey', columns: ['punchline_id'], isOneToOne: false, refTable: 'punchlines', refColumns: ['id'] },
]

// ── Corrections manuelles ───────────────────────────────────────────────
// Les valeurs exactes des DB ne sont pas toutes exposées par PostgREST
// (types enum alias, champ JSON, fonction RPC…). On les patche ici.
const EXTRA_TYPES = [
  "export type UserRole = 'contributor' | 'trusted' | 'moderator'",
  "export type AnnotationStatus = 'pending' | 'approved' | 'merged' | 'rejected'",
]
const COLUMN_OVERRIDES = {
  'settings.value': 'Record<string, unknown>',
}
const RPC_FUNCTIONS = {
  increment_song_view: { args: '{ p_song_id: string }', returns: 'undefined' },
}

function schemaToTypes(schema) {
  const definitions = schema.definitions || {}

  // Filtrer les tables (ignorer les types internes PostgREST)
  const tables = Object.entries(definitions)
    .filter(([name]) => !name.startsWith('_') && !name.startsWith('rpc'))
    .sort(([a], [b]) => a.localeCompare(b))

  const lines = []

  lines.push('/**')
  lines.push(" * Typage Supabase Pass'Teny — généré automatiquement par scripts/generate-db-types.mjs.")
  lines.push(' * Ne pas modifier manuellement. Pour régénérer :')
  lines.push(' *   node scripts/generate-db-types.mjs')
  lines.push(' */')
  lines.push('')

  // Appliquer les overrides de type sur les colonnes
  function getColumnType(tableName, prop, propSchema) {
    const overrideKey = `${tableName}.${prop}`
    if (COLUMN_OVERRIDES[overrideKey]) return COLUMN_OVERRIDES[overrideKey]
    return openApiToTsType(propSchema)
  }

  // Types d'export supplémentaires (enum alias, types non exposés par PostgREST)
  for (const t of EXTRA_TYPES) lines.push(t)
  lines.push('')

  lines.push('export interface Database {')
  lines.push('  public: {')
  lines.push('    Tables: {')

  for (const [tableName, def] of tables) {
    if (!def.properties) continue

    const required = def.required || []
    const props = Object.entries(def.properties)

    lines.push(`      ${tableName}: {`)

    // ── Row ──
    lines.push('        Row: {')
    for (const [prop, propSchema] of props) {
      const tsType = getColumnType(tableName, prop, propSchema)
      // Un champ n'est pas dans required → il est nullable en Row
      const nullable = !required.includes(prop)
      const type = nullable ? `${tsType} | null` : tsType
      lines.push(`          ${prop}: ${type}`)
    }
    lines.push('        }')

    // ── Insert ──
    // Tous les champs sont optionnels dans Insert (les contraintes DB gèrent
    // les champs obligatoires et les defaults). C'est le comportement standard
    // de `supabase gen types` car le schéma PostgREST ne fournit pas les
    // DEFAULT de la base (gen_random_uuid, now(), etc.).
    lines.push('        Insert: {')
    for (const [prop, propSchema] of props) {
      const tsType = getColumnType(tableName, prop, propSchema)
      const type = `${tsType} | null`
      lines.push(`          ${prop}?: ${type}`)
    }
    lines.push('        }')

    // ── Update ──
    lines.push(`        Update: Partial<Database['public']['Tables']['${tableName}']['Insert']>`)

    // ── Relationships ──
    const tableRels = FK_RELATIONS.filter((r) => r.table === tableName)
    if (tableRels.length > 0) {
      lines.push('        Relationships: [')
      tableRels.forEach((rel, idx) => {
        const comma = idx < tableRels.length - 1 ? ',' : ''
        lines.push('          {')
        lines.push(`            foreignKeyName: '${rel.fk}'`)
        lines.push(`            columns: [${rel.columns.map((c) => `'${c}'`).join(', ')}]`)
        lines.push(`            isOneToOne: ${rel.isOneToOne}`)
        lines.push(`            referencedRelation: '${rel.refTable}'`)
        lines.push(`            referencedColumns: [${rel.refColumns.map((c) => `'${c}'`).join(', ')}]`)
        lines.push(`          }${comma}`)
      })
      lines.push('        ]')
    } else {
      lines.push('        Relationships: []')
    }

    lines.push('      }')
  }

  lines.push('    }')

  // ── Views ──
  lines.push('    Views: Record<string, never>')

  // ── Functions ──
  lines.push('    Functions: {')
  for (const [fnName, fnDef] of Object.entries(RPC_FUNCTIONS)) {
    lines.push(`      ${fnName}: {`)
    lines.push(`        Args: ${fnDef.args}`)
    lines.push(`        Returns: ${fnDef.returns}`)
    lines.push('      }')
  }
  lines.push('    }')

  // ── Enums ──
  lines.push('    Enums: Record<string, never>')

  lines.push('    CompositeTypes: Record<string, never>')
  lines.push('  }')
  lines.push('}')

  return lines.join('\n') + '\n'
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('📡 Récupération du schéma PostgREST...')
  const schema = await fetchSchema()
  const tableCount = Object.keys(schema.definitions || {}).length
  console.log(`✅ Schéma récupéré — ${tableCount} tables/types trouvés`)

  const types = schemaToTypes(schema)
  const outputPath = resolve(ROOT, 'lib/supabase/database.types.ts')
  writeFileSync(outputPath, types, 'utf-8')
  console.log(`✅ Types générés → ${outputPath}`)
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
