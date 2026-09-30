import { describe, expect, it } from 'vitest'
import { pourAmounts, ratio, sortForList, sortSteps, speechText, stepEndSec } from './recipe'
import type { Recipe, Step } from './types'

function step(startSec: number, name: string, targetG: number | null, extra: Partial<Step> = {}): Step {
  return { startSec, name, description: '', targetG, caution: false, cautionText: '', ...extra }
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
    steps: [step(0, '蒸らし', 50), step(45, '2投目', 120), step(90, '3投目', 250)],
    favorite: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('ratio（比率）', () => {
  it('豆 15g・湯量 250g は 1:16.7', () => {
    expect(ratio(15, 250)).toBe('1:16.7')
  })
  it('割り切れるときも小数第1位まで出す（豆 20g・湯量 320g は 1:16.0）', () => {
    expect(ratio(20, 320)).toBe('1:16.0')
  })
  it('豆 0.5g 刻みでも計算できる（豆 12.5g・湯量 200g は 1:16.0）', () => {
    expect(ratio(12.5, 200)).toBe('1:16.0')
  })
  it('豆の量・湯量が空・0 以下なら null（出せない）', () => {
    expect(ratio(0, 250)).toBeNull()
    expect(ratio(-1, 250)).toBeNull()
    expect(ratio(null, 250)).toBeNull()
    expect(ratio(15, null)).toBeNull()
    expect(ratio(15, 0)).toBeNull()
  })
})

describe('pourAmounts（注ぐ量）', () => {
  it('目標量 [50, null, 120, 250] の注ぐ量は [50, null, 70, 130]', () => {
    const steps = [step(0, 'a', 50), step(30, 'b', null), step(45, 'c', 120), step(90, 'd', 250)]
    expect(pourAmounts(steps)).toEqual([50, null, 70, 130])
  })
  it('最初に目標量が無い手順が続いても、前の目標量は 0 として数える', () => {
    const steps = [step(0, '待つ', null), step(10, '注ぐ', 60)]
    expect(pourAmounts(steps)).toEqual([null, 60])
  })
  it('目標量が前より小さいと、注ぐ量は負になる（そのまま出す）', () => {
    expect(pourAmounts([step(0, 'a', 100), step(30, 'b', 80)])).toEqual([100, -20])
  })
  it('手順が0個なら空の並び', () => {
    expect(pourAmounts([])).toEqual([])
  })
})

describe('speechText（読み上げ文）', () => {
  it('目標量と注意の文があるとき', () => {
    const s = step(0, '蒸らし', 50, { caution: true, cautionText: 'ゆっくり注ぐ' })
    expect(speechText(s)).toBe('蒸らし。50グラムまで注いでください。ゆっくり注ぐ')
  })
  it('目標量だけのとき', () => {
    expect(speechText(step(45, '2投目', 120))).toBe('2投目。120グラムまで注いでください')
  })
  it('目標量も注意の文も無いとき', () => {
    expect(speechText(step(120, '待つ', null))).toBe('待つ')
  })
  it('注意の文だけのとき', () => {
    const s = step(150, 'プレスする', null, { caution: true, cautionText: 'ゆっくり押す' })
    expect(speechText(s)).toBe('プレスする。ゆっくり押す')
  })
  it('注意の手順でないときは、注意の文が残っていても読まない', () => {
    const s = step(0, '蒸らし', 50, { caution: false, cautionText: 'ゆっくり注ぐ' })
    expect(speechText(s)).toBe('蒸らし。50グラムまで注いでください')
  })
  it('前後の空白は省く', () => {
    const s = step(0, ' 蒸らし ', null, { caution: true, cautionText: '  ' })
    expect(speechText(s)).toBe('蒸らし')
  })
})

describe('stepEndSec（手順の終わり）', () => {
  it('次の手順の開始が終わり', () => {
    expect(stepEndSec(recipe(), 0)).toBe(45)
    expect(stepEndSec(recipe(), 1)).toBe(90)
  })
  it('最後の手順は完成時刻', () => {
    expect(stepEndSec(recipe(), 2)).toBe(210)
  })
  it('手順が1つだけなら完成時刻', () => {
    expect(stepEndSec(recipe({ steps: [step(0, '蒸らし', 250)], totalSec: 120 }), 0)).toBe(120)
  })
})

describe('sortSteps（開始の時刻で並べる）', () => {
  it('開始の時刻の順に並べる。元の並びは変えない', () => {
    const steps = [step(90, 'c', 250), step(0, 'a', 50), step(45, 'b', 120)]
    const sorted = sortSteps(steps)
    expect(sorted.map((s) => s.name)).toEqual(['a', 'b', 'c'])
    expect(steps.map((s) => s.name)).toEqual(['c', 'a', 'b'])
  })
  it('同じ時刻は元の順を保つ。空の時刻は最後', () => {
    const steps = [
      { startSec: null, name: 'x' },
      { startSec: 30, name: 'b1' },
      { startSec: 0, name: 'a' },
      { startSec: 30, name: 'b2' },
    ]
    expect(sortSteps(steps).map((s) => s.name)).toEqual(['a', 'b1', 'b2', 'x'])
  })
})

describe('sortForList（一覧の並び）', () => {
  it('お気に入りが上、その中は updatedAt の新しい順', () => {
    const list = [
      recipe({ id: 'old', favorite: false, updatedAt: '2026-09-01T00:00:00.000Z' }),
      recipe({ id: 'favOld', favorite: true, updatedAt: '2026-09-02T00:00:00.000Z' }),
      recipe({ id: 'new', favorite: false, updatedAt: '2026-09-10T00:00:00.000Z' }),
      recipe({ id: 'favNew', favorite: true, updatedAt: '2026-09-05T00:00:00.000Z' }),
    ]
    expect(sortForList(list).map((r) => r.id)).toEqual(['favNew', 'favOld', 'new', 'old'])
    expect(list[0].id).toBe('old')
  })
  it('0件なら空', () => {
    expect(sortForList([])).toEqual([])
  })
})
