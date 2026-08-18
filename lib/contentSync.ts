/**
 * Synchronisation du miroir local `content/` (mode dev uniquement).
 *
 * En dev, l'app lit le contenu depuis le dossier `content/` (clone git du
 * repo canon). Après un merge de PR, ce miroir est en retard tant qu'un
 * `git pull` n'a pas été fait — les lyrics ne reflètent pas la publication.
 * Ce module déclenche ce pull automatiquement, de façon non bloquante et
 * silencieuse en cas d'échec (le merge GitHub reste la source de vérité).
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { config } from '@/lib/config'

const execFileAsync = promisify(execFile)
const CONTENT_DIR = path.join(process.cwd(), 'content')

/** Verrou simple : un seul pull à la fois, les suivants sont ignorés. */
let syncing = false

/**
 * Met à jour le miroir local (`git fetch` + `git pull --ff-only`).
 * - Ne fait rien hors mode dev (`useLocalContent`).
 * - `--ff-only` : jamais de merge commit ni de rebase automatique ; si le
 *   miroir a divergé (commits locaux), le pull échoue proprement.
 * - Ne lève jamais : les échecs sont loggés, la réponse de modération n'est
 *   pas impactée.
 */
export async function syncLocalContent(): Promise<boolean> {
  if (!config.useLocalContent) return false
  if (syncing) return false
  syncing = true
  try {
    const opts = { timeout: 30_000, windowsHide: true }
    await execFileAsync('git', ['-C', CONTENT_DIR, 'fetch', 'origin'], opts)
    await execFileAsync('git', ['-C', CONTENT_DIR, 'pull', '--ff-only', 'origin', config.contentBranch], opts)
    return true
  } catch (err) {
    console.error('[content-sync] échec de la synchro du miroir local :', (err as Error).message)
    return false
  } finally {
    syncing = false
  }
}
