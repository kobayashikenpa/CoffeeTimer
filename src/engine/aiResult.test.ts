import { describe, expect, it } from 'vitest'
import { AI_LIMITS, normalizeAiResult } from './aiResult'
import type { RecipeDraft } from './types'

/** 正しい返答（architecture.md 4.1 の形） */
function response(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    found: true,
    name: '4:6メソッド',
    author: 'Tetsu Kasuya',
    equipment: 'V60',
    description: '味の濃さと甘さを注ぎ方で変えるレシピ',
    beans: { value: 20, unit: 'g' },
    water: { value: 300, unit: 'g' },
    temperature: { value: 92, unit: 'C' },
    grind: 'coarse',
    totalSec: 210,
    steps: [
      { startSec: 0, name: '1投目', description: '中心から注ぐ', target: { value: 50, unit: 'g' }, caution: null },
      { startSec: 45, name: '2投目', description: null, target: { value: 120, unit: 'g' }, caution: null },
      { startSec: 90, name: '3投目', description: null, target: { value: 180, unit: 'g' }, caution: null },
      { startSec: 135, name: '4投目', description: null, target: { value: 240, unit: 'g' }, caution: null },
      { startSec: 165, name: '5投目', description: null, target: { value: 300, unit: 'g' }, caution: 'ゆっくり注ぐ' },
    ],
    ...overrides,
  }
}

function okDraft(input: unknown, videoUrl?: string): RecipeDraft {
  const r = normalizeAiResult(input, videoUrl === undefined ? undefined : { videoUrl })
  if (!r.ok) throw new Error(`下書きになりませんでした：${r.reason}`)
  return r.draft
}

describe('normalizeAiResult（AI の返答の検証と変換）', () => {
  it('正しい返答が下書きになる', () => {
    const d = okDraft(response(), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(d).toEqual({
      id: null,
      name: '4:6メソッド',
      author: 'Tetsu Kasuya',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      equipment: 'V60',
      beansG: 20,
      waterG: 300,
      tempC: 92,
      grind: '粗挽き',
      description: '味の濃さと甘さを注ぎ方で変えるレシピ',
      totalSec: 210,
      steps: [
        { startSec: 0, name: '1投目', description: '中心から注ぐ', targetG: 50, caution: false, cautionText: '' },
        { startSec: 45, name: '2投目', description: '', targetG: 120, caution: false, cautionText: '' },
        { startSec: 90, name: '3投目', description: '', targetG: 180, caution: false, cautionText: '' },
        { startSec: 135, name: '4投目', description: '', targetG: 240, caution: false, cautionText: '' },
        { startSec: 165, name: '5投目', description: '', targetG: 300, caution: true, cautionText: 'ゆっくり注ぐ' },
      ],
      favorite: false,
    })
  })

  it('JSON の文字でも読める。動画の URL を渡さなければ空', () => {
    const d = okDraft(JSON.stringify(response()))
    expect(d.name).toBe('4:6メソッド')
    expect(d.videoUrl).toBe('')
  })

  it('found: false はレシピが見つからない（notFound）', () => {
    expect(normalizeAiResult({ found: false, name: null, steps: [] })).toEqual({ ok: false, reason: 'notFound' })
    expect(normalizeAiResult(JSON.stringify({ found: false }))).toEqual({ ok: false, reason: 'notFound' })
  })

  it('found: true でも中身が何も無ければ notFound', () => {
    expect(
      normalizeAiResult({ found: true, name: null, beans: null, water: null, steps: [] }),
    ).toEqual({ ok: false, reason: 'notFound' })
  })

  it('JSON でない・形が大きく違うものは broken', () => {
    expect(normalizeAiResult('これはJSONではありません')).toEqual({ ok: false, reason: 'broken' })
    expect(normalizeAiResult('{"found": true, "name": ')).toEqual({ ok: false, reason: 'broken' })
    expect(normalizeAiResult(null)).toEqual({ ok: false, reason: 'broken' })
    expect(normalizeAiResult(undefined)).toEqual({ ok: false, reason: 'broken' })
    expect(normalizeAiResult(42)).toEqual({ ok: false, reason: 'broken' })
    expect(normalizeAiResult([response()])).toEqual({ ok: false, reason: 'broken' })
    expect(normalizeAiResult({ recipe: response() })).toEqual({ ok: false, reason: 'broken' })
    expect(normalizeAiResult(response({ found: 'yes' }))).toEqual({ ok: false, reason: 'broken' })
    expect(normalizeAiResult(response({ steps: 'お湯を注ぐ' }))).toEqual({ ok: false, reason: 'broken' })
  })

  it('8 oz → 227g、200℉ → 93℃ に直す', () => {
    const d = okDraft(
      response({
        beans: { value: 0.75, unit: 'oz' },
        water: { value: 8, unit: 'oz' },
        temperature: { value: 200, unit: 'F' },
        steps: [
          { startSec: 0, name: '蒸らし', description: null, target: { value: 2, unit: 'oz' }, caution: null },
          { startSec: 30, name: '注ぐ', description: null, target: { value: 8, unit: 'oz' }, caution: null },
        ],
      }),
    )
    expect(d.waterG).toBe(227)
    expect(d.tempC).toBe(93)
    expect(d.beansG).toBe(21.3) // 0.75 × 28.35 = 21.2625 → 小数第1位
    expect(d.steps.map((s) => s.targetG)).toEqual([57, 227])
  })

  it('ml は 1ml = 1g として g にする', () => {
    const d = okDraft(
      response({
        water: { value: 250.4, unit: 'ml' },
        steps: [{ startSec: 0, name: '注ぐ', description: null, target: { value: 250, unit: 'ml' }, caution: null }],
      }),
    )
    expect(d.waterG).toBe(250)
    expect(d.steps[0].targetG).toBe(250)
  })

  it('単位の表記ゆれ（大文字・℃・℉・grams）も読む', () => {
    const d = okDraft(
      response({
        beans: { value: 15, unit: 'G' },
        water: { value: 250, unit: 'grams' },
        temperature: { value: 194, unit: '℉' },
      }),
    )
    expect(d.beansG).toBe(15)
    expect(d.waterG).toBe(250)
    expect(d.tempC).toBe(90)
    expect(okDraft(response({ temperature: { value: 90, unit: '℃' } })).tempC).toBe(90)
  })

  it('知らない単位は空にする', () => {
    const d = okDraft(response({ beans: { value: 2, unit: 'tbsp' }, water: { value: 1, unit: 'cup' } }))
    expect(d.beansG).toBeNull()
    expect(d.waterG).toBeNull()
  })

  it('負の値・文字の数値・範囲の外の値は空にする', () => {
    const d = okDraft(
      response({
        beans: { value: -15, unit: 'g' },
        water: { value: '300', unit: 'g' },
        temperature: { value: 250, unit: 'C' },
        totalSec: 'three minutes',
        steps: [
          { startSec: 0, name: '蒸らし', description: null, target: { value: -30, unit: 'g' }, caution: null },
          { startSec: 40, name: '注ぐ', description: null, target: { value: '250', unit: 'g' }, caution: null },
        ],
      }),
    )
    expect(d.beansG).toBeNull()
    expect(d.waterG).toBeNull()
    expect(d.tempC).toBeNull()
    expect(d.totalSec).toBeNull()
    expect(d.steps.map((s) => s.targetG)).toEqual([null, null])
  })

  it('値の範囲の境（豆 0.5〜200g、湯量 1〜5000g、湯温 0〜100℃、時間 3600 秒まで）', () => {
    expect(AI_LIMITS).toEqual({ beansG: [0.5, 200], waterG: [1, 5000], tempC: [0, 100], maxSec: 3600 })
    const at = (beans: number, water: number, temp: number, total: number) =>
      okDraft(
        response({
          beans: { value: beans, unit: 'g' },
          water: { value: water, unit: 'g' },
          temperature: { value: temp, unit: 'C' },
          totalSec: total,
        }),
      )
    const inside = at(0.5, 5000, 100, 3600)
    expect([inside.beansG, inside.waterG, inside.tempC, inside.totalSec]).toEqual([0.5, 5000, 100, 3600])
    const low = at(200, 1, 0, 1)
    expect([low.beansG, low.waterG, low.tempC, low.totalSec]).toEqual([200, 1, 0, 1])
    const outside = at(200.1, 5001, 101, 3601)
    expect([outside.beansG, outside.waterG, outside.tempC, outside.totalSec]).toEqual([null, null, null, null])
    const tooSmall = at(0.4, 0, -1, 0)
    expect([tooSmall.beansG, tooSmall.waterG, tooSmall.tempC, tooSmall.totalSec]).toEqual([null, null, null, null])
  })

  it('NaN・Infinity・値の無い単位つきの値は空にする', () => {
    const d = okDraft(
      response({ beans: { value: Number.NaN, unit: 'g' }, water: { unit: 'g' }, temperature: 92, totalSec: Infinity }),
    )
    expect([d.beansG, d.waterG, d.tempC, d.totalSec]).toEqual([null, null, null, null])
  })

  it('時刻は秒の整数にする', () => {
    const d = okDraft(
      response({
        totalSec: 209.6,
        steps: [
          { startSec: 0, name: '蒸らし', description: null, target: null, caution: null },
          { startSec: 44.6, name: '1投目', description: null, target: null, caution: null },
        ],
      }),
    )
    expect(d.totalSec).toBe(210)
    expect(d.steps.map((s) => s.startSec)).toEqual([0, 45])
  })

  it('順番がばらばらの手順を開始の時刻で並べ直す', () => {
    const d = okDraft(
      response({
        steps: [
          { startSec: 90, name: '3投目', description: null, target: { value: 250, unit: 'g' }, caution: null },
          { startSec: 0, name: '蒸らし', description: null, target: { value: 50, unit: 'g' }, caution: null },
          { startSec: 45, name: '2投目', description: null, target: { value: 150, unit: 'g' }, caution: null },
        ],
      }),
    )
    expect(d.steps.map((s) => s.name)).toEqual(['蒸らし', '2投目', '3投目'])
  })

  it('開始の時刻の無い・読めない手順は、空にして最後に置く', () => {
    const d = okDraft(
      response({
        steps: [
          { startSec: null, name: 'かき混ぜる', description: null, target: null, caution: null },
          { startSec: -5, name: '待つ', description: null, target: null, caution: null },
          { startSec: 0, name: '蒸らし', description: null, target: { value: 40, unit: 'g' }, caution: null },
        ],
      }),
    )
    expect(d.steps.map((s) => [s.startSec, s.name])).toEqual([
      [0, '蒸らし'],
      [null, 'かき混ぜる'],
      [null, '待つ'],
    ])
  })

  it('手順名の無い手順は、中身があれば名前を空にして残し、中身が無ければ除く', () => {
    const d = okDraft(
      response({
        steps: [
          { startSec: 0, name: '蒸らし', description: null, target: { value: 40, unit: 'g' }, caution: null },
          { startSec: 30, name: '', description: '円を描くように注ぐ', target: { value: 150, unit: 'g' }, caution: null },
          { startSec: 60, name: '   ', description: null, target: null, caution: null },
          { startSec: 70 },
          'お湯を注ぐ',
          null,
        ],
      }),
    )
    expect(d.steps.map((s) => [s.startSec, s.name, s.description])).toEqual([
      [0, '蒸らし', ''],
      [30, '', '円を描くように注ぐ'],
    ])
  })

  it('手順が1つも読めなければ、開始 0:00 の空の手順を1つ置く', () => {
    const d = okDraft(response({ steps: [] }))
    expect(d.steps).toEqual([
      { startSec: 0, name: '', description: '', targetG: null, caution: false, cautionText: '' },
    ])
  })

  it('手順が1つだけでも下書きになる', () => {
    const d = okDraft(
      response({
        steps: [{ startSec: 0, name: '注ぐ', description: null, target: { value: 300, unit: 'g' }, caution: null }],
      }),
    )
    expect(d.steps).toHaveLength(1)
  })

  it('知らない挽き目・形の違う文字の項目は空にする', () => {
    const d = okDraft(response({ grind: 'turkish', name: 123, author: { a: 1 }, equipment: null, description: true }))
    expect(d.grind).toBeNull()
    expect(d.name).toBe('')
    expect(d.author).toBe('')
    expect(d.equipment).toBe('')
    expect(d.description).toBe('')
  })

  it('挽き目の英語の値を日本語にする', () => {
    const g = (v: string) => okDraft(response({ grind: v })).grind
    expect(g('extra_fine')).toBe('極細挽き')
    expect(g('fine')).toBe('細挽き')
    expect(g('medium_fine')).toBe('中細挽き')
    expect(g('medium')).toBe('中挽き')
    expect(g('coarse')).toBe('粗挽き')
  })

  it('文字の前後の空白・改行・制御文字を整え、長すぎる文字は切る', () => {
    const d = okDraft(
      response({
        name: '  4:6\u0000メソッド\n ',
        description: 'あ'.repeat(1000),
        steps: [{ startSec: 0, name: '蒸らし\u0007', description: '1行目\n2行目', target: null, caution: '  ' }],
      }),
    )
    expect(d.name).toBe('4:6メソッド')
    expect(d.description).toHaveLength(300)
    expect(d.steps[0]).toEqual({
      startSec: 0,
      name: '蒸らし',
      description: '1行目\n2行目',
      targetG: null,
      caution: false,
      cautionText: '',
    })
  })

  it('HTML のような文字もそのまま文字として残す（画面では文字として出す）', () => {
    const d = okDraft(response({ name: '<img src=x onerror=alert(1)>' }))
    expect(d.name).toBe('<img src=x onerror=alert(1)>')
  })

  it('手順が多すぎるときは 30 までにする', () => {
    const steps = Array.from({ length: 50 }, (_, i) => ({
      startSec: i * 10,
      name: `${i + 1}投目`,
      description: null,
      target: null,
      caution: null,
    }))
    expect(okDraft(response({ steps })).steps).toHaveLength(30)
  })
})
