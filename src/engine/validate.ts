// 保存するときの確かめ（仕様 5.1・5.3・7）と、下書き ⇄ レシピ の変換
import { sortSteps } from './recipe'
import type { Recipe, RecipeDraft, Step, ValidationIssue, ValidationResult } from './types'

/** 豆の量を小数第1位に丸める */
function roundBeans(g: number): number {
  return Math.round(g * 10) / 10
}

/**
 * 下書きを確かめる。
 * errors：1つでもあれば保存できない。warnings：保存はできるが目立つ注意を出す。
 * 手順の番号（'steps.2.startSec' の 2）は、下書きの並びのままの番号
 */
export function validateRecipe(draft: RecipeDraft): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const err = (field: string, message: string) => errors.push({ field, message })

  if (draft.name.trim() === '') err('name', 'レシピ名を入れてください')

  if (draft.beansG === null) err('beansG', '豆の量を入れてください')
  else if (!(roundBeans(draft.beansG) > 0)) err('beansG', '豆の量は 0 より大きくしてください')

  if (draft.waterG === null) err('waterG', '湯量を入れてください')
  else if (!(draft.waterG > 0)) err('waterG', '湯量は 0 より大きくしてください')
  else if (!Number.isInteger(draft.waterG)) err('waterG', '湯量は 1g 単位（整数）で入れてください')

  if (draft.tempC !== null && !Number.isInteger(draft.tempC)) err('tempC', '湯温は 1℃ 単位（整数）で入れてください')

  if (draft.totalSec === null) err('totalSec', '完成時刻を入れてください')

  if (draft.steps.length === 0) err('steps', '手順を1つ以上入れてください')

  let prevStart: number | null = null
  draft.steps.forEach((s, i) => {
    if (s.name.trim() === '') err(`steps.${i}.name`, '手順名を入れてください')

    if (s.startSec === null) {
      err(`steps.${i}.startSec`, '開始の時刻を入れてください')
    } else if (i === 0) {
      if (s.startSec !== 0) err(`steps.${i}.startSec`, '最初の手順の開始は 0:00 にしてください')
    } else if (prevStart !== null && s.startSec <= prevStart) {
      err(`steps.${i}.startSec`, '開始の時刻は、前の手順より後にしてください')
    }
    if (s.startSec !== null) prevStart = s.startSec

    if (s.targetG !== null && !(Number.isInteger(s.targetG) && s.targetG > 0)) {
      err(`steps.${i}.targetG`, '目標量は 1g 以上の整数で入れてください')
    }
  })

  const lastStart = draft.steps.at(-1)?.startSec ?? null
  if (draft.totalSec !== null && lastStart !== null && draft.totalSec <= lastStart) {
    err('totalSec', '完成時刻は、最後の手順の開始より後にしてください')
  }

  // 注意：目標量が前の目標量より小さい
  let prevTarget: number | null = null
  let lastTargetIndex: number | null = null
  draft.steps.forEach((s, i) => {
    if (s.targetG === null) return
    if (prevTarget !== null && s.targetG < prevTarget) {
      warnings.push({
        field: `steps.${i}.targetG`,
        message: `目標量が前の目標量（${prevTarget}g）より小さくなっています`,
      })
    }
    prevTarget = s.targetG
    lastTargetIndex = i
  })

  // 注意：最後の目標量が湯量と違う
  if (lastTargetIndex !== null && prevTarget !== null && draft.waterG !== null && draft.waterG > 0 && prevTarget !== draft.waterG) {
    warnings.push({
      field: `steps.${lastTargetIndex}.targetG`,
      message: `最後の目標量（${prevTarget}g）が湯量（${draft.waterG}g）と違います。あとから割り水をするレシピでなければ確かめてください`,
    })
  }

  return { errors, warnings }
}

/**
 * 確かめを通った下書きを、保存するレシピにする。
 * 手順を開始の時刻で並べ、豆の量を小数第1位に丸め、名前の前後の空白を省く。
 * createdAt を渡さなければ今（nowIso）にする。updatedAt はいつも今。
 * 手順を開始の時刻で並べた後の下書きにエラーがあれば例外を投げる（先に validateRecipe で確かめること）
 */
export function toRecipe(draft: RecipeDraft, opts: { id: string; nowIso: string; createdAt?: string }): Recipe {
  const sorted: RecipeDraft = { ...draft, steps: sortSteps(draft.steps) }
  const { errors } = validateRecipe(sorted)
  if (errors.length > 0 || draft.beansG === null || draft.waterG === null || draft.totalSec === null) {
    throw new Error(`保存できない下書きです：${errors.map((e) => e.field).join(', ')}`)
  }
  const steps: Step[] = sorted.steps.map((s) => ({
    startSec: s.startSec ?? 0,
    name: s.name.trim(),
    description: s.description,
    targetG: s.targetG,
    caution: s.caution,
    cautionText: s.cautionText,
  }))
  return {
    id: opts.id,
    name: draft.name.trim(),
    author: draft.author,
    videoUrl: draft.videoUrl,
    equipment: draft.equipment,
    beansG: roundBeans(draft.beansG),
    waterG: draft.waterG,
    tempC: draft.tempC,
    grind: draft.grind,
    description: draft.description,
    totalSec: draft.totalSec,
    steps,
    favorite: draft.favorite,
    createdAt: opts.createdAt ?? opts.nowIso,
    updatedAt: opts.nowIso,
  }
}

/** 保存したレシピを、編集で開くための下書きにする（手順は写しを作る） */
export function recipeToDraft(recipe: Recipe): RecipeDraft {
  return {
    id: recipe.id,
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
    steps: recipe.steps.map((s) => ({ ...s })),
    favorite: recipe.favorite,
  }
}
