// ファイルの書き出し（共有／保存）と読み込み、バックアップの反映（仕様 10、architecture.md 4.5）
import { applyMerge, planMerge, toBackupFile } from '../engine/files'
import type { AppData, BackupFile, MergePlan } from '../engine/files'
import { recipeStore } from './recipes'
import type { RecipeStore } from './recipes'
import { recordStore } from './records'
import type { RecordStore } from './records'
import { settingsStore } from './settings'
import type { SettingsStore } from './settings'

/** 書き出しの結果。shared：共有の画面で送った／downloaded：ファイルとして保存した／cancelled：共有をやめた */
export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'failed'

/** 共有・保存に使う、ブラウザの機能（テストでは差し替える） */
export interface ShareEnv {
  canShare?: (data: { files: File[] }) => boolean
  share?: (data: { files: File[]; title?: string }) => Promise<void>
  /** ファイルとして保存する（<a download>） */
  download: (name: string, blob: Blob) => void
}

/** ブラウザの <a download> でファイルとして保存する */
function browserDownload(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // すぐ消すと保存が始まらない端末があるため、少し待ってから放す
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function browserEnv(): ShareEnv {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  return {
    canShare: nav && typeof nav.canShare === 'function' ? (d) => nav.canShare(d) : undefined,
    share: nav && typeof nav.share === 'function' ? (d) => nav.share(d) : undefined,
    download: browserDownload,
  }
}

/**
 * JSON のファイルを、スマホの共有機能（LINE・メールなど）で送る。
 * ファイルの共有が使えない端末では、ファイルとして保存する。
 * 共有の画面を利用者が閉じたときは cancelled（保存もしない）
 * ※ iPhone で共有の画面が開くよう、ボタンを押した操作の中で（先に await せずに）呼ぶこと
 */
export async function shareFile(name: string, json: string, env: ShareEnv = browserEnv()): Promise<ShareResult> {
  const blob = new Blob([json], { type: 'application/json' })
  let canShareFiles = false
  let file: File | null = null
  try {
    file = new File([blob], name, { type: 'application/json' })
    canShareFiles = !!env.share && !!env.canShare && env.canShare({ files: [file] })
  } catch {
    canShareFiles = false
  }
  if (canShareFiles && file && env.share) {
    try {
      await env.share({ files: [file], title: name })
      return 'shared'
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
      // 共有できなかった（許可されない など）ときは、ファイルとして保存する
    }
  }
  try {
    env.download(name, blob)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}

/** 読み込むファイルの大きさの上限（壊れた・違うファイルで画面が止まらないように。暫定） */
export const MAX_FILE_BYTES = 5 * 1024 * 1024

export type ReadFileResult = { ok: true; text: string } | { ok: false; reason: 'tooLarge' | 'unreadable' }

/** 選んだファイルを文字として読む */
export async function readFile(file: Blob, maxBytes = MAX_FILE_BYTES): Promise<ReadFileResult> {
  if (file.size > maxBytes) return { ok: false, reason: 'tooLarge' }
  try {
    return { ok: true, text: await file.text() }
  } catch {
    return { ok: false, reason: 'unreadable' }
  }
}

/** バックアップに使う保存先 */
export interface Stores {
  recipes: RecipeStore
  records: RecordStore
  settings: SettingsStore
}

function appStores(): Stores {
  return { recipes: recipeStore(), records: recordStore(), settings: settingsStore() }
}

/** 今のデータ */
export function currentData(stores: Stores = appStores()): AppData {
  return { recipes: stores.recipes.list(), records: stores.records.list(), settings: stores.settings.get() }
}

/** バックアップの JSON の文字を作る（APIキーは入れない。APIキーの保存先は読まない） */
export function backupJson(stores: Stores = appStores(), now: Date = new Date()): string {
  const d = currentData(stores)
  return JSON.stringify(toBackupFile(d.recipes, d.records, d.settings, now.toISOString()), null, 2)
}

/** 読み込む前に示す件数 */
export function planImport(backup: BackupFile, stores: Stores = appStores()): MergePlan {
  return planMerge(currentData(stores), backup)
}

/**
 * バックアップを今のデータに足して、レシピ・記録・設定をまとめて書き込む。
 * 途中で書き込めなかったときは、すべて元に戻して false を返す
 */
export function importBackup(backup: BackupFile, stores: Stores = appStores()): boolean {
  const before = {
    recipes: [...stores.recipes.list()],
    records: [...stores.records.list()],
    settings: { ...stores.settings.get() },
  }
  const merged = applyMerge(before, backup)
  const ok =
    stores.recipes.replaceAll(merged.recipes) &&
    stores.records.replaceAll(merged.records) &&
    stores.settings.replace(merged.settings)
  if (ok) return true
  stores.recipes.replaceAll(before.recipes)
  stores.records.replaceAll(before.records)
  stores.settings.replace(before.settings)
  return false
}
