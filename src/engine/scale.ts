// 豆の量による換算（仕様 8.2）
import type { Recipe } from './types'

/** 豆の量の下限（g） */
export const MIN_BEANS_G = 0.5
/** 豆の量の上限（g） */
export const MAX_BEANS_G = 200
/** − ＋ ボタンの刻み（g） */
export const BEANS_STEP_G = 0.5

/** 元の値 × 新しい豆の量 ÷ 元の豆の量 を 1g 単位に四捨五入（掛けてから割る。x.5 は切り上げ） */
function scaleValue(value: number, fromBeans: number, toBeans: number): number {
  // 小数の計算の誤差で 67.4999… のようになっても、ちょうど .5 は切り上げるよう少し足す
  return Math.round((value * toBeans) / fromBeans + 1e-9)
}

/**
 * 豆の量を変えたレシピを作る（元のレシピは変えない）。
 * 湯量と各手順の目標量を比例で計算し直し、1g 単位に四捨五入する。時間は変えない。
 * 新しい豆の量は normalizeBeans で整えてから使う
 */
export function scaleRecipe(recipe: Recipe, newBeansG: number): Recipe {
  const to = normalizeBeans(newBeansG)
  const from = recipe.beansG
  if (to === from) return { ...recipe, steps: recipe.steps.map((s) => ({ ...s })) }
  return {
    ...recipe,
    beansG: to,
    waterG: scaleValue(recipe.waterG, from, to),
    steps: recipe.steps.map((s) => ({
      ...s,
      targetG: s.targetG === null ? null : scaleValue(s.targetG, from, to),
    })),
  }
}

/** 豆の量の直接入力を整える：小数第1位に丸め、下限 0.5g・上限 200g に収める。数でなければ下限 */
export function normalizeBeans(value: number): number {
  if (!Number.isFinite(value)) return MIN_BEANS_G
  const rounded = Math.round(value * 10) / 10
  return Math.min(MAX_BEANS_G, Math.max(MIN_BEANS_G, rounded))
}

/**
 * − ＋ ボタンで豆の量を 0.5g ずつ動かす。
 * 0.5g 刻みでない値（例 15.3）からは、となりの 0.5g 刻みの値（＋ で 15.5、− で 15.0）に動く
 */
export function stepBeans(value: number, direction: 1 | -1): number {
  const units = value / BEANS_STEP_G
  const next =
    direction === 1
      ? (Math.floor(units + 1e-9) + 1) * BEANS_STEP_G
      : (Math.ceil(units - 1e-9) - 1) * BEANS_STEP_G
  return normalizeBeans(next)
}
