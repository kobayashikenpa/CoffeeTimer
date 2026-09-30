import { describe, expect, it } from 'vitest'
import { recipeToDraft, toRecipe, validateRecipe } from './validate'
import type { RecipeDraft, StepDraft } from './types'

function step(startSec: number | null, name: string, targetG: number | null, extra: Partial<StepDraft> = {}): StepDraft {
  return { startSec, name, description: '', targetG, caution: false, cautionText: '', ...extra }
}

/** 正しいレシピの下書き（豆 15g・湯量 250g・3手順） */
function draft(overrides: Partial<RecipeDraft> = {}): RecipeDraft {
  return {
    id: null,
    name: '4:6メソッド',
    author: 'だれか',
    videoUrl: 'https://youtu.be/abc',
    equipment: 'V60',
    beansG: 15,
    waterG: 250,
    tempC: 92,
    grind: '中細挽き',
    description: '',
    totalSec: 210,
    steps: [step(0, '蒸らし', 50), step(45, '2投目', 120), step(90, '3投目', 250)],
    favorite: false,
    ...overrides,
  }
}

function errorFields(d: RecipeDraft): string[] {
  return validateRecipe(d).errors.map((e) => e.field)
}
function warningFields(d: RecipeDraft): string[] {
  return validateRecipe(d).warnings.map((e) => e.field)
}

describe('validateRecipe（保存するときの確かめ）', () => {
  it('正しいレシピはエラーも注意も無い', () => {
    expect(validateRecipe(draft())).toEqual({ errors: [], warnings: [] })
  })

  it('手順が1つだけの正しいレシピはエラーも注意も無い', () => {
    const d = draft({ steps: [step(0, '注ぐ', 250)], totalSec: 120 })
    expect(validateRecipe(d)).toEqual({ errors: [], warnings: [] })
  })

  it('目標量が1つも無いレシピ（全部注がない手順）も注意は出ない', () => {
    const d = draft({ steps: [step(0, '浸す', null)], totalSec: 240 })
    expect(validateRecipe(d)).toEqual({ errors: [], warnings: [] })
  })

  it('どのエラーにも画面に出す文がある', () => {
    const d = draft({ name: '', beansG: null })
    for (const e of validateRecipe(d).errors) expect(e.message).not.toBe('')
  })

  describe('エラー（保存できない）', () => {
    it('レシピ名が空（空白だけも空）', () => {
      expect(errorFields(draft({ name: '' }))).toEqual(['name'])
      expect(errorFields(draft({ name: '   ' }))).toEqual(['name'])
    })
    it('豆の量が空', () => {
      expect(errorFields(draft({ beansG: null }))).toEqual(['beansG'])
    })
    it('豆の量が 0 以下', () => {
      expect(errorFields(draft({ beansG: 0 }))).toEqual(['beansG'])
      expect(errorFields(draft({ beansG: -3 }))).toEqual(['beansG'])
    })
    it('豆の量が小数第1位に丸めると 0 になる', () => {
      expect(errorFields(draft({ beansG: 0.04 }))).toEqual(['beansG'])
    })
    it('湯量が空', () => {
      expect(errorFields(draft({ waterG: null }))).toContain('waterG')
    })
    it('湯量が 0 以下', () => {
      expect(errorFields(draft({ waterG: 0 }))).toContain('waterG')
      expect(errorFields(draft({ waterG: -10 }))).toContain('waterG')
    })
    it('湯量が整数でない', () => {
      expect(errorFields(draft({ waterG: 250.5 }))).toEqual(['waterG'])
    })
    it('完成時刻が空', () => {
      expect(errorFields(draft({ totalSec: null }))).toEqual(['totalSec'])
    })
    it('手順名が空', () => {
      const d = draft({ steps: [step(0, '蒸らし', 50), step(45, ' ', 120), step(90, '3投目', 250)] })
      expect(errorFields(d)).toEqual(['steps.1.name'])
    })
    it('手順が0個', () => {
      expect(errorFields(draft({ steps: [] }))).toEqual(['steps'])
    })
    it('手順の開始が空', () => {
      const d = draft({ steps: [step(0, '蒸らし', 50), step(null, '2投目', 120), step(90, '3投目', 250)] })
      expect(errorFields(d)).toEqual(['steps.1.startSec'])
    })
    it('最初の手順の開始が 0 でない', () => {
      const d = draft({ steps: [step(5, '蒸らし', 50), step(45, '2投目', 120), step(90, '3投目', 250)] })
      expect(errorFields(d)).toEqual(['steps.0.startSec'])
    })
    it('手順の開始が前の手順より前', () => {
      const d = draft({ steps: [step(0, '蒸らし', 50), step(90, '2投目', 120), step(45, '3投目', 250)] })
      expect(errorFields(d)).toEqual(['steps.2.startSec'])
    })
    it('手順の開始が前の手順と同じ時刻', () => {
      const d = draft({ steps: [step(0, '蒸らし', 50), step(45, '2投目', 120), step(45, '3投目', 250)] })
      expect(errorFields(d)).toEqual(['steps.2.startSec'])
    })
    it('完成時刻が最後の手順の開始と同じ', () => {
      expect(errorFields(draft({ totalSec: 90 }))).toEqual(['totalSec'])
    })
    it('完成時刻が最後の手順の開始より前', () => {
      expect(errorFields(draft({ totalSec: 60 }))).toEqual(['totalSec'])
    })
    it('湯温が整数でない', () => {
      expect(errorFields(draft({ tempC: 92.5 }))).toEqual(['tempC'])
    })
    it('湯温は空でもよい', () => {
      expect(errorFields(draft({ tempC: null }))).toEqual([])
    })
    it('目標量が整数でない、または 0 以下', () => {
      const d = draft({ steps: [step(0, '蒸らし', 50.5), step(45, '2投目', 0), step(90, '3投目', 250)] })
      expect(errorFields(d)).toEqual(['steps.0.targetG', 'steps.1.targetG'])
    })
    it('いくつものエラーをまとめて返す', () => {
      const d = draft({ name: '', beansG: null, waterG: null, totalSec: null, steps: [step(3, '', null)] })
      expect(errorFields(d)).toEqual(['name', 'beansG', 'waterG', 'totalSec', 'steps.0.name', 'steps.0.startSec'])
    })
  })

  describe('注意（保存はできる）', () => {
    it('目標量が前の目標量より小さい', () => {
      const d = draft({ steps: [step(0, '蒸らし', 50), step(45, '2投目', 150), step(90, '3投目', 120)], waterG: 120 })
      const r = validateRecipe(d)
      expect(r.errors).toEqual([])
      expect(r.warnings.map((w) => w.field)).toEqual(['steps.2.targetG'])
    })
    it('目標量の比べ先は、それより前で最後に目標量がある手順', () => {
      const d = draft({
        steps: [step(0, '蒸らし', 100), step(30, '待つ', null), step(60, '注ぐ', 80)],
        waterG: 80,
      })
      expect(warningFields(d)).toEqual(['steps.2.targetG'])
    })
    it('最後の目標量が湯量と違う（割り水をするレシピなど）', () => {
      const d = draft({ waterG: 300 })
      const r = validateRecipe(d)
      expect(r.errors).toEqual([])
      expect(r.warnings.map((w) => w.field)).toEqual(['steps.2.targetG'])
    })
    it('最後の手順に目標量が無ければ、目標量のある最後の手順で比べる', () => {
      const d = draft({ steps: [step(0, '注ぐ', 200), step(60, 'プレスする', null)], waterG: 250, totalSec: 120 })
      expect(warningFields(d)).toEqual(['steps.0.targetG'])
    })
    it('湯量が空なら湯量との比べはしない（エラーだけ出す）', () => {
      expect(warningFields(draft({ waterG: null }))).toEqual([])
    })
  })
})

describe('toRecipe（下書き → 保存するレシピ）', () => {
  it('手順を開始の時刻で並べ、豆の量を小数第1位に丸める', () => {
    const d = draft({
      beansG: 15.26,
      steps: [step(90, '3投目', 250), step(0, '蒸らし', 50), step(45, '2投目', 120)],
    })
    const r = toRecipe(d, { id: 'new-id', nowIso: '2026-09-30T00:00:00.000Z' })
    expect(r.beansG).toBe(15.3)
    expect(r.steps.map((s) => s.name)).toEqual(['蒸らし', '2投目', '3投目'])
  })
  it('ID と日時を入れる。作った日時を渡さなければ今にする', () => {
    const r = toRecipe(draft(), { id: 'new-id', nowIso: '2026-09-30T00:00:00.000Z' })
    expect(r.id).toBe('new-id')
    expect(r.createdAt).toBe('2026-09-30T00:00:00.000Z')
    expect(r.updatedAt).toBe('2026-09-30T00:00:00.000Z')
  })
  it('編集のときは作った日時をそのまま残し、updatedAt だけ今にする', () => {
    const r = toRecipe(draft({ id: 'r1' }), {
      id: 'r1',
      nowIso: '2026-09-30T00:00:00.000Z',
      createdAt: '2026-09-01T00:00:00.000Z',
    })
    expect(r.createdAt).toBe('2026-09-01T00:00:00.000Z')
    expect(r.updatedAt).toBe('2026-09-30T00:00:00.000Z')
  })
  it('レシピ名・手順名の前後の空白を省く。ほかの値はそのまま', () => {
    const d = draft({ name: ' 4:6メソッド ', steps: [step(0, ' 注ぐ ', 250, { caution: true, cautionText: 'ゆっくり' })] })
    const r = toRecipe(d, { id: 'x', nowIso: '2026-09-30T00:00:00.000Z' })
    expect(r.name).toBe('4:6メソッド')
    expect(r.steps[0]).toEqual({ startSec: 0, name: '注ぐ', description: '', targetG: 250, caution: true, cautionText: 'ゆっくり' })
    expect(r.waterG).toBe(250)
    expect(r.tempC).toBe(92)
    expect(r.grind).toBe('中細挽き')
    expect(r.totalSec).toBe(210)
    expect(r.videoUrl).toBe('https://youtu.be/abc')
  })
  it('エラーのある下書きは Recipe にできない（例外）', () => {
    expect(() => toRecipe(draft({ beansG: null }), { id: 'x', nowIso: '2026-09-30T00:00:00.000Z' })).toThrow()
  })
  it('元の下書きは書き換えない', () => {
    const d = draft({ steps: [step(90, '3投目', 250), step(0, '蒸らし', 50), step(45, '2投目', 120)] })
    toRecipe(d, { id: 'x', nowIso: '2026-09-30T00:00:00.000Z' })
    expect(d.steps[0].name).toBe('3投目')
  })
})

describe('recipeToDraft（レシピ → 編集の下書き）', () => {
  it('保存したレシピを下書きに戻すと、同じ値で開ける（往復で変わらない）', () => {
    const r = toRecipe(draft({ id: 'r1', favorite: true }), { id: 'r1', nowIso: '2026-09-30T00:00:00.000Z' })
    const d = recipeToDraft(r)
    expect(d).toEqual(draft({ id: 'r1', favorite: true }))
  })
  it('下書きの手順を直しても元のレシピは変わらない', () => {
    const r = toRecipe(draft(), { id: 'r1', nowIso: '2026-09-30T00:00:00.000Z' })
    const d = recipeToDraft(r)
    d.steps[0].name = '変えた'
    expect(r.steps[0].name).toBe('蒸らし')
  })
})
