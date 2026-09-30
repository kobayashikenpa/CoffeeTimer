// 人に渡すファイル・バックアップの形の作成と読み取り（仕様 10、architecture.md 3.2・4.5）
// 読み込むファイルは信用しない。形を確かめ、違えば何も変えずにエラーにする
import { parseStoredSettings, toStoredRecipe, toStoredRecord } from './stored'
import type { BrewRecord, Recipe, RecipeDraft, Settings } from './types'

export const FILE_APP = 'CoffeeTimer'
export const FILE_VERSION = 1

/** 人に渡すファイルに入れるレシピの中身（ID・お気に入り・日時は入れない） */
export type SharedRecipe = Omit<Recipe, 'id' | 'favorite' | 'createdAt' | 'updatedAt'>

/** 人に渡すファイル（仕様 10.1）。記録・APIキー・お気に入りの印は入れない */
export interface SharedRecipeFile {
  app: typeof FILE_APP
  kind: 'recipe'
  version: typeof FILE_VERSION
  recipe: SharedRecipe
}

/** ファイルを読めなかったときに画面に出す文 */
export const FILE_MESSAGES = {
  notRecipe: 'CoffeeTimer のレシピのファイルではないため、読み込めませんでした',
  notBackup: 'CoffeeTimer のバックアップのファイルではないため、読み込めませんでした。何も変えていません',
  backupGiven: 'これはバックアップのファイルです。設定の「バックアップを読み込む」から読み込んでください',
  recipeGiven: 'これはレシピのファイルです。「＋ レシピを追加」→「ファイルから受け取る」から読み込んでください。何も変えていません',
  newerVersion: '新しい版の CoffeeTimer で作られたファイルのため、読み込めませんでした',
  broken: 'ファイルの中身が壊れているため、読み込めませんでした',
  brokenBackup: 'ファイルの中身が壊れているため、読み込めませんでした。何も変えていません',
} as const

export type FileParseResult<T> = { ok: true } & T | { ok: false; message: string }

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** JSON として読む。読めなければ undefined */
export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** レシピから、人に渡すファイルの中身を作る（項目を1つずつ選んで入れる。余分なものは入れない） */
export function toSharedRecipeFile(recipe: Recipe): SharedRecipeFile {
  return {
    app: FILE_APP,
    kind: 'recipe',
    version: FILE_VERSION,
    recipe: {
      name: recipe.name,
      author: recipe.author,
      videoUrl: recipe.videoUrl,
      equipment: recipe.equipment,
      beansG: recipe.beansG,
      waterG: recipe.waterG,
      tempC: recipe.tempC,
      grind: recipe.grind,
      description: recipe.description,
      totalSec: recipe.totalSec,
      steps: recipe.steps.map((s) => ({
        startSec: s.startSec,
        name: s.name,
        description: s.description,
        targetG: s.targetG,
        caution: s.caution,
        cautionText: s.cautionText,
      })),
    },
  }
}

/**
 * 人から受け取ったファイルの文字を読み、確認・編集画面の下書きにする。
 * いつも新しいレシピとして扱う（ID は null・お気に入りなし）
 */
export function parseSharedRecipeFile(text: string): FileParseResult<{ draft: RecipeDraft }> {
  const v = parseJsonText(text)
  if (!isObject(v) || v.app !== FILE_APP) return { ok: false, message: FILE_MESSAGES.notRecipe }
  if (v.kind === 'backup') return { ok: false, message: FILE_MESSAGES.backupGiven }
  if (v.kind !== 'recipe') return { ok: false, message: FILE_MESSAGES.notRecipe }
  if (v.version !== FILE_VERSION) return { ok: false, message: FILE_MESSAGES.newerVersion }
  if (!isObject(v.recipe)) return { ok: false, message: FILE_MESSAGES.broken }
  // 形の確かめは保存したレシピと同じもの（ID などは仮の値を入れて確かめ、下書きでは使わない）
  const r = toStoredRecipe({ ...v.recipe, id: 'received', favorite: false, createdAt: '', updatedAt: '' })
  if (!r) return { ok: false, message: FILE_MESSAGES.broken }
  return {
    ok: true,
    draft: {
      id: null,
      name: r.name,
      author: r.author,
      videoUrl: r.videoUrl,
      equipment: r.equipment,
      beansG: r.beansG,
      waterG: r.waterG,
      tempC: r.tempC,
      grind: r.grind,
      description: r.description,
      totalSec: r.totalSec,
      steps: r.steps.map((s) => ({ ...s })),
      favorite: false,
    },
  }
}

/** ファイル名に使えない文字（/ \ : * ? " < > | と制御文字） */
// oxlint-disable-next-line no-control-regex
const UNSAFE_FILENAME = /[/\\:*?"<>|\u0000-\u001F\u007F]/g

/** 人に渡すファイルの名前：coffeetimer-recipe-<レシピ名>.json（使えない文字は _ にし、40文字まで） */
export function sharedRecipeFileName(recipe: Pick<Recipe, 'name'>): string {
  const safe = [...recipe.name.replace(UNSAFE_FILENAME, '_').trim()].slice(0, 40).join('')
  return `coffeetimer-recipe-${safe === '' ? 'recipe' : safe}.json`
}

/** バックアップ（仕様 10.2）。APIキーは入れない */
export interface BackupFile {
  app: typeof FILE_APP
  kind: 'backup'
  version: typeof FILE_VERSION
  exportedAt: string
  recipes: Recipe[]
  records: BrewRecord[]
  settings: Settings
}

/** 今のデータ（バックアップを足す先） */
export interface AppData {
  recipes: readonly Recipe[]
  records: readonly BrewRecord[]
  settings: Settings
}

/** バックアップを足す前に、利用者に示す件数 */
export interface MergePlan {
  recipesAdded: number
  recipesOverwritten: number
  recordsAdded: number
  recordsOverwritten: number
}

/**
 * バックアップのファイルの中身を作る。
 * 設定は音・読み上げだけを選んで入れる（APIキーは別に保存していて、ここには入れない）
 */
export function toBackupFile(
  recipes: readonly Recipe[],
  records: readonly BrewRecord[],
  settings: Settings,
  nowIso: string,
): BackupFile {
  return {
    app: FILE_APP,
    kind: 'backup',
    version: FILE_VERSION,
    exportedAt: nowIso,
    recipes: recipes.map((r) => ({ ...r, steps: r.steps.map((s) => ({ ...s })) })),
    records: records.map((r) => ({ ...r })),
    settings: { soundOn: settings.soundOn, speechOn: settings.speechOn },
  }
}

/** 並びの中身を1件ずつ確かめる。1件でも形が違う・ID が重なっていれば null */
function parseItems<T extends { id: string }>(v: unknown, parse: (x: unknown) => T | null): T[] | null {
  if (!Array.isArray(v)) return null
  const items: T[] = []
  const ids = new Set<string>()
  for (const x of v) {
    const item = parse(x)
    if (!item || ids.has(item.id)) return null
    ids.add(item.id)
    items.push(item)
  }
  return items
}

/**
 * バックアップのファイルの文字を読む。
 * 形が違う・壊れている（中の1件だけ違う場合も）ときは、全体をエラーにする（何も変えないため）
 */
export function parseBackupFile(text: string): FileParseResult<{ backup: BackupFile }> {
  const v = parseJsonText(text)
  if (!isObject(v) || v.app !== FILE_APP) return { ok: false, message: FILE_MESSAGES.notBackup }
  if (v.kind === 'recipe') return { ok: false, message: FILE_MESSAGES.recipeGiven }
  if (v.kind !== 'backup') return { ok: false, message: FILE_MESSAGES.notBackup }
  if (v.version !== FILE_VERSION) return { ok: false, message: FILE_MESSAGES.newerVersion }
  const recipes = parseItems(v.recipes, toStoredRecipe)
  const records = parseItems(v.records, toStoredRecord)
  const settings = parseStoredSettings(v.settings)
  if (!recipes || !records || !settings || typeof v.exportedAt !== 'string') {
    return { ok: false, message: FILE_MESSAGES.brokenBackup }
  }
  return {
    ok: true,
    backup: { app: FILE_APP, kind: 'backup', version: FILE_VERSION, exportedAt: v.exportedAt, recipes, records, settings },
  }
}

function countMerge(current: readonly { id: string }[], incoming: readonly { id: string }[]) {
  const ids = new Set(current.map((x) => x.id))
  const overwritten = incoming.filter((x) => ids.has(x.id)).length
  return { added: incoming.length - overwritten, overwritten }
}

/** 足す件数・上書きする件数（ID が同じものを「同じ」とする） */
export function planMerge(current: AppData, incoming: BackupFile): MergePlan {
  const r = countMerge(current.recipes, incoming.recipes)
  const b = countMerge(current.records, incoming.records)
  return { recipesAdded: r.added, recipesOverwritten: r.overwritten, recordsAdded: b.added, recordsOverwritten: b.overwritten }
}

/** ID が同じものは読み込んだほうで置き換え、無いものは後ろに足す（元の並びは変えない） */
function mergeById<T extends { id: string }>(current: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map(incoming.map((x) => [x.id, x]))
  const merged = current.map((x) => byId.get(x.id) ?? x)
  const ids = new Set(current.map((x) => x.id))
  return [...merged, ...incoming.filter((x) => !ids.has(x.id))]
}

/** 今のデータにバックアップを足した結果を作る。設定（音・読み上げ）は読み込んだほうにする */
export function applyMerge(current: AppData, incoming: BackupFile): { recipes: Recipe[]; records: BrewRecord[]; settings: Settings } {
  return {
    recipes: mergeById(current.recipes, incoming.recipes),
    records: mergeById(current.records, incoming.records),
    settings: { ...incoming.settings },
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** バックアップのファイル名：coffeetimer-backup-YYYYMMDD.json（端末の日付） */
export function backupFileName(date: Date): string {
  return `coffeetimer-backup-${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}.json`
}
