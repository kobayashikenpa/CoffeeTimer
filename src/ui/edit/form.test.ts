import { describe, expect, it } from 'vitest'
import { draftToForm, emptyDraft, emptyStepForm, formToDraft, mergeIssues, sortStepForms } from './form'

describe('確認・編集画面の入力欄 ⇄ 下書き', () => {
  it('下書き → 入力欄 → 下書き で元に戻る（時刻は 分:秒 で出す）', () => {
    const draft = {
      ...emptyDraft(),
      name: 'テスト',
      beansG: 15,
      waterG: 250,
      totalSec: 180,
      steps: [
        { startSec: 0, name: '蒸らし', description: '', targetG: 50, caution: false, cautionText: '' },
        { startSec: 90, name: '1投目', description: '', targetG: 150, caution: true, cautionText: 'ゆっくり' },
      ],
    }
    const form = draftToForm(draft)
    expect(form.total).toBe('3:00')
    expect(form.steps[1].start).toBe('1:30')
    expect(formToDraft(form)).toEqual({ draft, formatErrors: [] })
  })

  it('時刻は 1:30 でも 90 でも入る。読めない文字はその項目の誤りになる', () => {
    const form = draftToForm(emptyDraft())
    expect(formToDraft({ ...form, total: '90' }).draft.totalSec).toBe(90)
    expect(formToDraft({ ...form, total: '1:30' }).draft.totalSec).toBe(90)
    const bad = formToDraft({ ...form, total: '1:75', beans: 'じゅうご' })
    expect(bad.draft.totalSec).toBeNull()
    expect(bad.formatErrors.map((e) => e.field).sort()).toEqual(['beansG', 'totalSec'])
  })

  it('注意しない手順は注意の文を残さない', () => {
    const form = draftToForm(emptyDraft())
    form.steps[0] = { ...form.steps[0], caution: false, cautionText: '残った文' }
    expect(formToDraft(form).draft.steps[0].cautionText).toBe('')
  })

  it('手順は開始の時刻で並び、空の時刻は最後', () => {
    const a = { ...emptyStepForm('1:00'), name: 'a' }
    const b = { ...emptyStepForm('0:00'), name: 'b' }
    const c = { ...emptyStepForm(''), name: 'c' }
    const d = { ...emptyStepForm('40'), name: 'd' }
    expect(sortStepForms([a, c, b, d]).map((s) => s.name)).toEqual(['b', 'd', 'a', 'c'])
  })

  it('同じ項目の誤りは形の誤りだけを出す', () => {
    const merged = mergeIssues(
      [{ field: 'beansG', message: '数字で' }],
      [
        { field: 'beansG', message: '入れて' },
        { field: 'name', message: '名前' },
      ],
    )
    expect(merged.map((e) => e.message)).toEqual(['数字で', '名前'])
  })
})
