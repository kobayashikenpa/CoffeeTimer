// データの型（architecture.md 3章）
// 重さは g、温度は ℃、時間は秒（整数）。日時は ISO 8601 の文字列

/** 挽き目。未設定は null */
export type Grind = '極細挽き' | '細挽き' | '中細挽き' | '中挽き' | '粗挽き'

/** 挽き目の選択肢（細かい順） */
export const GRINDS: readonly Grind[] = ['極細挽き', '細挽き', '中細挽き', '中挽き', '粗挽き']

/** 手順（仕様 5.2） */
export interface Step {
  /** 開始の時刻（秒）。最初の手順は 0 */
  startSec: number
  /** 手順名 */
  name: string
  /** 説明（空文字可） */
  description: string
  /** 目標量（g、整数）。注がない手順は null */
  targetG: number | null
  /** 注意の手順かどうか */
  caution: boolean
  /** 注意の文（空文字可） */
  cautionText: string
}

/** レシピ（仕様 5.1）。保存できる状態のもの */
export interface Recipe {
  /** レシピを見分ける ID */
  id: string
  name: string
  author: string
  videoUrl: string
  equipment: string
  /** 豆の量（g、小数第1位まで、0 より大きい） */
  beansG: number
  /** 湯量（g、0 より大きい整数） */
  waterG: number
  /** 湯温（℃、整数）。無ければ null */
  tempC: number | null
  grind: Grind | null
  description: string
  /** 完成時刻（秒） */
  totalSec: number
  /** 開始の時刻の順に並んだ手順（1つ以上） */
  steps: Step[]
  favorite: boolean
  createdAt: string
  /** 一覧の並び（新しく追加・編集した順）に使う */
  updatedAt: string
}

/** 確認・編集画面で使う手順の下書き。数値は「空」を null で表す */
export interface StepDraft {
  startSec: number | null
  name: string
  description: string
  targetG: number | null
  caution: boolean
  cautionText: string
}

/**
 * 確認・編集画面で使う下書き。AI の読み取り結果・ファイルから受け取ったもの・
 * 既存のレシピを、いったんこの形にしてから画面で直す。
 * 数値は「空」を表せるよう null を許す。
 */
export interface RecipeDraft {
  /** 新しいレシピなら null */
  id: string | null
  name: string
  author: string
  videoUrl: string
  equipment: string
  beansG: number | null
  waterG: number | null
  tempC: number | null
  grind: Grind | null
  description: string
  totalSec: number | null
  steps: StepDraft[]
  favorite: boolean
}

/** 保存するときの確かめの1件（仕様 5.3） */
export interface ValidationIssue {
  /** どの項目か。例 'name'、'steps.2.startSec' */
  field: string
  /** 画面に出す文 */
  message: string
}

/** 保存するときの確かめの結果 */
export interface ValidationResult {
  /** 1つでもあれば保存できない */
  errors: ValidationIssue[]
  /** 保存できるが目立つ注意を出す */
  warnings: ValidationIssue[]
}

/** 淹れた記録（仕様 9.1） */
export interface BrewRecord {
  id: string
  /** 記録の日時（直せる） */
  brewedAt: string
  /** レシピの ID（レシピを消した後も残す） */
  recipeId: string
  /** そのときのレシピ名（レシピを消しても名前が残る） */
  recipeName: string
  beansG: number
  waterG: number
  /** 豆の名前・お店（任意） */
  beanName: string
  rating: 1 | 2 | 3 | 4 | 5 | null
  memo: string
  updatedAt: string
}

/** 設定（仕様 11）。APIキーはここに入れず別に持つ */
export interface Settings {
  /** 音の初期値 */
  soundOn: boolean
  /** 読み上げの初期値 */
  speechOn: boolean
}

/** 設定の初期値（仕様 11：音 ON・読み上げ ON） */
export const DEFAULT_SETTINGS: Settings = { soundOn: true, speechOn: true }
