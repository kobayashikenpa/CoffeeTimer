// 比率・注ぐ量・読み上げ文・手順の並べ替え・一覧の並び（仕様 5.1・5.2・5.4）
import type { Recipe, Step } from './types'

/**
 * 比率の表示用の文字（例 豆 15g・湯量 250g → '1:16.7'）。小数第1位まで。
 * 豆の量・湯量が空か 0 以下なら出せないので null
 */
export function ratio(beansG: number | null, waterG: number | null): string | null {
  if (beansG === null || waterG === null) return null
  if (!(beansG > 0) || !(waterG > 0)) return null
  // toFixed は 16.65 を 16.6 にしてしまうため、10倍して整数で四捨五入する
  const tenths = Math.round(Number(((waterG / beansG) * 10).toPrecision(12)))
  return `1:${(tenths / 10).toFixed(1)}`
}

/**
 * 各手順の注ぐ量。
 * 注ぐ量 ＝ その手順の目標量 − それより前で最後に目標量がある手順の目標量（無ければ 0）。
 * 目標量が空の手順は null
 */
export function pourAmounts(steps: readonly Pick<Step, 'targetG'>[]): (number | null)[] {
  let prev = 0
  return steps.map((s) => {
    if (s.targetG === null) return null
    const pour = s.targetG - prev
    prev = s.targetG
    return pour
  })
}

/**
 * 読み上げる文：「手順名。目標量グラムまで注いでください。注意の文」。
 * 目標量・注意の文が無ければその部分を省く（注意の文は注意の手順のときだけ読む）
 */
export function speechText(step: Pick<Step, 'name' | 'targetG' | 'caution' | 'cautionText'>): string {
  const parts = [step.name.trim()]
  if (step.targetG !== null) parts.push(`${step.targetG}グラムまで注いでください`)
  const caution = step.caution ? step.cautionText.trim() : ''
  if (caution !== '') parts.push(caution)
  return parts.filter((p) => p !== '').join('。')
}

/** 手順の終わりの時刻（秒）：次の手順の開始。最後の手順は完成時刻 */
export function stepEndSec(recipe: Pick<Recipe, 'steps' | 'totalSec'>, index: number): number {
  const next = recipe.steps[index + 1]
  return next ? next.startSec : recipe.totalSec
}

/**
 * 開始の時刻の順に並べた新しい並びを返す（元は変えない）。
 * 同じ時刻は元の順を保ち、時刻が空（null）のものは最後に置く
 */
export function sortSteps<T extends { startSec: number | null }>(steps: readonly T[]): T[] {
  return [...steps].sort((a, b) => {
    if (a.startSec === null || b.startSec === null) {
      if (a.startSec === b.startSec) return 0
      return a.startSec === null ? 1 : -1
    }
    return a.startSec - b.startSec
  })
}

/** 一覧の並び：お気に入りが上、その中は updatedAt の新しい順（元は変えない） */
export function sortForList<T extends Pick<Recipe, 'favorite' | 'updatedAt'>>(recipes: readonly T[]): T[] {
  return [...recipes].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
    if (a.updatedAt === b.updatedAt) return 0
    return a.updatedAt < b.updatedAt ? 1 : -1
  })
}
