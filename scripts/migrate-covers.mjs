/**
 * Migre les coverUrl Cloudinary du catalogue vers leurs équivalents ImageKit.
 *
 * - Ne touche que les URLs `/Covers/` : les `artists[].coverUrl` sont des
 *   ProfilePic (avatars) — le miroir ImageKit des ProfilePic est un fichier
 *   générique partagé par tous les artistes, on les laisse donc en Cloudinary
 *   (le composant les gère avec skipImageKitFallback).
 * - Chaque URL convertie est vérifiée (HTTP 200) avant écriture : si
 *   l'équivalent ImageKit n'existe pas, on laisse l'URL Cloudinary en place
 *   (la chaîne de fallback runtime s'en chargera).
 * - Même logique que cloudinaryToImageKitUrl de lib/imageUtils.ts.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import https from 'node:https'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT_DIR = path.join(ROOT, 'content')
const IMAGEKIT_BASE = 'https://ik.imagekit.io/a6ywpqgqor'

function cloudinaryToImageKitUrl(url) {
  if (!url || !url.includes('res.cloudinary.com')) return null
  const parts = url.split('/')
  const filename = parts[parts.length - 1].split('?')[0]
  if (!filename) return null
  for (const folder of ['Covers', 'ProfilePic', 'merch']) {
    if (url.includes(`/${folder}/`)) return `${IMAGEKIT_BASE}/${folder}/${filename}`
  }
  const versionMatch = url.match(/\/v\d+\/([^/]+)\//)
  if (versionMatch) return `${IMAGEKIT_BASE}/${versionMatch[1]}/${filename}`
  return null
}

/** Migrable uniquement si cover Covers Cloudinary. */
function migrateUrl(url) {
  if (!url || !url.includes('res.cloudinary.com')) return null
  if (!url.includes('/Covers/')) return null
  return cloudinaryToImageKitUrl(url)
}

function httpStatus(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', timeout: 15000 }, (r) => {
      resolve(r.statusCode)
      r.resume()
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => {
      req.destroy()
      resolve(null)
    })
    req.end()
  })
}

async function exists(p) {
  return fs.access(p).then(() => true).catch(() => false)
}

async function main() {
  const changed = []
  const failed = []

  // ── meta.json de chaque titre ──────────────────────────────────────────
  const artistDirs = (await fs.readdir(CONTENT_DIR)).filter((d) => !d.startsWith('.'))
  const metaFiles = []
  for (const artist of artistDirs) {
    const adir = path.join(CONTENT_DIR, artist)
    if (!(await fs.stat(adir)).isDirectory()) continue
    for (const song of await fs.readdir(adir)) {
      const mf = path.join(adir, song, 'meta.json')
      if (await exists(mf)) metaFiles.push(mf)
    }
  }

  for (const mf of metaFiles) {
    const json = JSON.parse(await fs.readFile(mf, 'utf8'))
    const target = migrateUrl(json.coverUrl)
    if (!target) continue
    const code = await httpStatus(target)
    if (code !== 200) {
      failed.push({ file: path.relative(ROOT, mf), code, url: target })
      continue
    }
    json.coverUrl = target
    await fs.writeFile(mf, JSON.stringify(json, null, 2) + '\n')
    changed.push(path.relative(ROOT, mf))
  }

  // ── index.json — songs uniquement (artists = ProfilePic, intouchés) ────
  const indexPath = path.join(CONTENT_DIR, 'index.json')
  const idx = JSON.parse(await fs.readFile(indexPath, 'utf8'))
  let idxChanged = 0
  for (const song of idx.songs) {
    const target = migrateUrl(song.coverUrl)
    if (!target) continue
    const code = await httpStatus(target)
    if (code !== 200) {
      failed.push({ file: 'index.json', code, url: target })
      continue
    }
    song.coverUrl = target
    idxChanged++
  }
  if (idxChanged > 0) {
    idx.generatedAt = new Date().toISOString()
    await fs.writeFile(indexPath, JSON.stringify(idx, null, 2) + '\n')
  }

  console.log(`meta.json migrés : ${changed.length}`)
  for (const f of changed) console.log('  +', f)
  console.log(`index.json songs migrés : ${idxChanged}`)
  console.log(`ÉCHECS (ImageKit non 200, laissés Cloudinary) : ${failed.length}`)
  for (const f of failed) console.log('  ✗', f.file, f.code, f.url)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
