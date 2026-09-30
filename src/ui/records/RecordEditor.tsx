// 記録をつける画面・記録を直す画面（仕様 9）
// 日時・レシピ名・豆の量・湯量は自動で入る。豆の名前・お店、評価（★1〜5）、メモを入れる
import { useState } from 'react'
import { fromLocalInput, RATINGS, toLocalInput, validateRecord } from '../../engine/record'
import type { RecordDraft } from '../../engine/record'
import { ratio } from '../../engine/recipe'
import type { BrewRecord } from '../../engine/types'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { Field } from '../common/Field'
import './records.css'

export interface RecordEditorProps {
  initial: RecordDraft
  /** 確かめを通った下書きで保存する */
  onSave: (draft: RecordDraft) => void
  onCancel: () => void
  /** 直すときだけ渡す（削除のボタンを出す） */
  onDelete?: () => void
}

interface RecordForm {
  brewedAt: string
  beanName: string
  rating: BrewRecord['rating']
  memo: string
}

export function RecordEditor({ initial, onSave, onCancel, onDelete }: RecordEditorProps) {
  const [form, setForm] = useState<RecordForm>(() => ({
    brewedAt: toLocalInput(initial.brewedAt),
    beanName: initial.beanName,
    rating: initial.rating,
    memo: initial.memo,
  }))
  const [initialForm] = useState(form)
  const [attempted, setAttempted] = useState(false)
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null)
  const isNew = initial.id === null

  const toDraft = (f: RecordForm): RecordDraft => ({
    ...initial,
    brewedAt: fromLocalInput(f.brewedAt) ?? '',
    beanName: f.beanName,
    rating: f.rating,
    memo: f.memo,
  })
  const issues = attempted ? validateRecord(toDraft(form)) : []
  const errorOf = (field: string) => issues.find((i) => i.field === field)?.message
  const set = <K extends keyof RecordForm>(key: K, value: RecordForm[K]) => setForm((f) => ({ ...f, [key]: value }))

  const save = () => {
    setAttempted(true)
    const draft = toDraft(form)
    if (validateRecord(draft).length === 0) onSave(draft)
    else requestAnimationFrame(() => document.getElementById('f-rec-brewedAt')?.focus())
  }
  const cancel = () => {
    if (JSON.stringify(form) !== JSON.stringify(initialForm)) setConfirm('cancel')
    else onCancel()
  }

  return (
    <div className="stack record-editor">
      <div className="edit-head">
        <button type="button" className="btn" onClick={cancel}>
          やめる
        </button>
        <h1 className="page-title" style={{ margin: 0 }}>
          {isNew ? '淹れた記録をつける' : '記録を直す'}
        </h1>
      </div>

      <section className="card stack" aria-label="淹れたレシピ">
        <div>
          <div className="field-label">レシピ</div>
          <div className="record-recipe">{initial.recipeName}</div>
        </div>
        <dl className="record-amounts">
          <div>
            <dt>豆の量</dt>
            <dd>{initial.beansG}g</dd>
          </div>
          <div>
            <dt>湯量</dt>
            <dd>{initial.waterG}g</dd>
          </div>
          <div>
            <dt>比率</dt>
            <dd>{ratio(initial.beansG, initial.waterG) ?? '—'}</dd>
          </div>
        </dl>
        <Field id="f-rec-brewedAt" label="日時" required error={errorOf('brewedAt')}>
          <input
            id="f-rec-brewedAt"
            className="input"
            type="datetime-local"
            value={form.brewedAt}
            onChange={(e) => set('brewedAt', e.target.value)}
            aria-invalid={errorOf('brewedAt') ? true : undefined}
            aria-describedby={errorOf('brewedAt') ? 'f-rec-brewedAt-error' : undefined}
          />
        </Field>
      </section>

      <section className="card stack" aria-label="味の記録">
        <Field id="f-rec-beanName" label="豆の名前・お店">
          <input
            id="f-rec-beanName"
            className="input"
            value={form.beanName}
            placeholder="例 エチオピア（○○珈琲）"
            autoComplete="off"
            onChange={(e) => set('beanName', e.target.value)}
          />
        </Field>

        <div className="field">
          <span className="field-label" id="f-rec-rating-label">
            評価
          </span>
          <div className="stars" role="group" aria-labelledby="f-rec-rating-label">
            {RATINGS.map((n) => (
              <button
                key={n}
                type="button"
                className={`btn btn-ghost star${form.rating !== null && n <= form.rating ? ' star-on' : ''}`}
                aria-pressed={form.rating === n}
                aria-label={`★${n}`}
                onClick={() => set('rating', form.rating === n ? null : n)}
              >
                {form.rating !== null && n <= form.rating ? '★' : '☆'}
              </button>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted small">{form.rating === null ? '評価なし' : `★${form.rating}`}</span>
            {form.rating !== null && (
              <button type="button" className="btn btn-ghost small" onClick={() => set('rating', null)}>
                評価を消す
              </button>
            )}
          </div>
          {errorOf('rating') && <p className="field-error">{errorOf('rating')}</p>}
        </div>

        <Field id="f-rec-memo" label="メモ">
          <textarea
            id="f-rec-memo"
            className="input record-memo"
            value={form.memo}
            placeholder="例 酸味がやわらか。次は湯温を少し上げる"
            onChange={(e) => set('memo', e.target.value)}
          />
        </Field>
      </section>

      <div className="stack save-area">
        {issues.length > 0 && (
          <div className="notice notice-danger" role="alert">
            <p>保存できません。赤い字のところを直してください。</p>
          </div>
        )}
        <button type="button" className="btn btn-primary btn-block btn-lg" onClick={save}>
          保存
        </button>
        <button type="button" className="btn btn-block" onClick={cancel}>
          やめる
        </button>
        {onDelete && (
          <button type="button" className="btn btn-block btn-danger" onClick={() => setConfirm('delete')}>
            この記録を削除
          </button>
        )}
      </div>

      {confirm === 'cancel' && (
        <ConfirmDialog
          title="入れた内容を保存せずに戻りますか？"
          message="入れたところは消えます。"
          confirmLabel="保存せずに戻る"
          cancelLabel="入力を続ける"
          danger
          onConfirm={onCancel}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === 'delete' && onDelete && (
        <ConfirmDialog
          title="この記録を削除しますか？"
          message="削除した記録は元に戻せません。"
          confirmLabel="削除する"
          danger
          onConfirm={onDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
