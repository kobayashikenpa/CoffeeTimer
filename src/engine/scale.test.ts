import { describe, expect, it } from 'vitest'
import { MAX_BEANS_G, MIN_BEANS_G, normalizeBeans, scaleRecipe, stepBeans } from './scale'
import { pourAmounts } from './recipe'
import type { Recipe, Step } from './types'

function step(startSec: number, name: string, targetG: number | null): Step {
  return { startSec, name, description: '', targetG, caution: false, cautionText: '' }
}

function recipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 'r1',
    name: '4:6メソッド',
    author: '',
    videoUrl: '',
    equipment: 'V60',
    beansG: 15,
    waterG: 250,
    tempC: 92,
    grind: '中細挽き',
    description: '',
    totalSec: 210,
    steps: [step(0, '蒸らし', 50), step(30, '待つ', null), step(45, '2投目', 120), step(90, '3投目', 250)],
    favorite: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('scaleRecipe（豆の量による換算）', () => {
  it('豆 15g・湯量 250g のレシピを豆 20g にすると湯量 333g', () => {
    const r = scaleRecipe(recipe(), 20)
    expect(r.beansG).toBe(20)
    expect(r.waterG).toBe(333)
  })
  it('目標量 45g・豆 10g → 15g で 68g（67.5 を四捨五入）', () => {
    const r = scaleRecipe(recipe({ beansG: 10, waterG: 150, steps: [step(0, '注ぐ', 45)] }), 15)
    expect(r.steps[0].targetG).toBe(68)
  })
  it('各手順の目標量を比例で計算し直す（1g 単位に四捨五入）', () => {
    const r = scaleRecipe(recipe(), 20)
    // 50×20÷15=66.7→67、120×20÷15=160、250×20÷15=333.3→333
    expect(r.steps.map((s) => s.targetG)).toEqual([67, null, 160, 333])
  })
  it('換算後の注ぐ量は、丸めた後の目標量どうしの差になる', () => {
    const r = scaleRecipe(recipe(), 20)
    expect(pourAmounts(r.steps)).toEqual([67, null, 93, 173])
  })
  it('開始の時刻・完成時刻は変わらない', () => {
    const r = scaleRecipe(recipe(), 20)
    expect(r.steps.map((s) => s.startSec)).toEqual([0, 30, 45, 90])
    expect(r.totalSec).toBe(210)
  })
  it('目標量が空の手順は空のまま', () => {
    expect(scaleRecipe(recipe(), 20).steps[1].targetG).toBeNull()
  })
  it('元のレシピは書き換わらない', () => {
    const original = recipe()
    const snapshot = structuredClone(original)
    scaleRecipe(original, 20)
    expect(original).toEqual(snapshot)
  })
  it('同じ豆の量なら値は変わらない', () => {
    expect(scaleRecipe(recipe(), 15)).toEqual(recipe())
  })
  it('減らす方向にも換算できる（豆 15g → 7.5g で湯量 125g）', () => {
    const r = scaleRecipe(recipe(), 7.5)
    expect(r.waterG).toBe(125)
    expect(r.steps.map((s) => s.targetG)).toEqual([25, null, 60, 125])
  })
  it('湯温・名前など、ほかの値はそのまま', () => {
    const r = scaleRecipe(recipe(), 20)
    expect(r.tempC).toBe(92)
    expect(r.name).toBe('4:6メソッド')
    expect(r.id).toBe('r1')
  })
  it('新しい豆の量は範囲に収め、小数第1位に丸めてから使う', () => {
    expect(scaleRecipe(recipe(), 20.04).beansG).toBe(20)
    expect(scaleRecipe(recipe(), 0).beansG).toBe(MIN_BEANS_G)
  })
})

describe('normalizeBeans（豆の量の直接入力を整える）', () => {
  it('小数第1位に丸める', () => {
    expect(normalizeBeans(15.26)).toBe(15.3)
    expect(normalizeBeans(15.24)).toBe(15.2)
  })
  it('下限 0.5g・上限 200g に収める', () => {
    expect(MIN_BEANS_G).toBe(0.5)
    expect(MAX_BEANS_G).toBe(200)
    expect(normalizeBeans(0)).toBe(0.5)
    expect(normalizeBeans(-3)).toBe(0.5)
    expect(normalizeBeans(0.2)).toBe(0.5)
    expect(normalizeBeans(250)).toBe(200)
  })
  it('数でないときは下限にする', () => {
    expect(normalizeBeans(Number.NaN)).toBe(0.5)
  })
})

describe('stepBeans（− ＋ ボタンで 0.5g ずつ）', () => {
  it('＋ で 0.5g 増え、− で 0.5g 減る', () => {
    expect(stepBeans(15, 1)).toBe(15.5)
    expect(stepBeans(15, -1)).toBe(14.5)
  })
  it('0.5g 刻みでない値からは、となりの 0.5g 刻みの値に動く', () => {
    expect(stepBeans(15.3, 1)).toBe(15.5)
    expect(stepBeans(15.3, -1)).toBe(15)
  })
  it('下限・上限より先には動かない', () => {
    expect(stepBeans(0.5, -1)).toBe(0.5)
    expect(stepBeans(200, 1)).toBe(200)
  })
})
