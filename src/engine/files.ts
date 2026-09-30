// 人に渡すファイル・バックアップの形の作成と読み取り（仕様 10、architecture.md 3.2・4.5）
// 読み込むファイルは信用しない。形を確かめ、違えば何も変えずにエラーにする
import { toStoredRecipe } from './stored'
import type { Recipe, RecipeDraft } from './types'

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
