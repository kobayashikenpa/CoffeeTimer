// 手順の切り替わりで鳴らす合図の判定（仕様 8.3、architecture.md 4.4）
import { speechText } from './recipe'
import type { TimerView } from './timer'
import type { Recipe } from './types'

/** 完成のときの読み上げ */
export const DONE_SPEECH = '抽出完了です'

/**
 * 前に合図を出したところの印。
 * 手順の番号、完成なら 'done'、まだ何も出していなければ null（START 前・RESET 後）
 */
export type CueMark = number | 'done' | null

/** 出す合図 */
export interface Cue {
  /** step：普通の手順（短い音1回）、caution：注意の手順（低めの音1回）、done：完成（音3回） */
  kind: 'step' | 'caution' | 'done'
  /** 読み上げる文 */
  speech: string
  /** 合図を出した後に覚えておく印（次の detectCue に lastCuedIndex として渡す） */
  mark: CueMark
}

/**
 * 今の進み具合を見て、合図を出すかを決める。前に合図した印から変わったときだけ合図を返す（1回だけ）。
 * 手順を2つ以上飛び越えたとき・手順へ飛んだときも、今の手順（または完成）の合図だけを返す。
 * 読み上げの目標量は渡したレシピの値を使う（豆の量を変えたときは換算後のレシピを渡す）
 */
export function detectCue(lastCuedIndex: CueMark, view: TimerView, recipe: Pick<Recipe, 'steps'>): Cue | null {
  if (view.done) {
    if (lastCuedIndex === 'done') return null
    return { kind: 'done', speech: DONE_SPEECH, mark: 'done' }
  }
  const index = view.currentIndex
  if (index === null || index === lastCuedIndex) return null
  const step = recipe.steps[index]
  if (!step) return null
  return { kind: step.caution ? 'caution' : 'step', speech: speechText(step), mark: index }
}
