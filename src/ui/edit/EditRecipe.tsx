// 確認・編集画面（仕様 7）
import { useMemo, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { ratio } from '../../engine/recipe'
import { GRINDS } from '../../engine/types'
import type { Grind, RecipeDraft, ValidationIssue } from '../../engine/types'
import { openableUrl } from '../../engine/url'
import { Field } from '../common/Field'
import { draftToForm, formToDraft } from './form'
import type { RecipeForm } from './form'
import './edit.css'

export interface EditRecipeProps {
  /** 開いたときの下書き（新しいレシピ・既存のレシピ・AI の読み取り結果） */
  initial: RecipeDraft
  /** AI で読み取った直後なら true（注意の文を出す） */
  fromAi?: boolean
  onCancel: () => void
}

export function EditRecipe({ initial, fromAi = false, onCancel }: EditRecipeProps) {
  const [form, setForm] = useState<RecipeForm>(() => draftToForm(initial))
  const { draft } = useMemo(() => formToDraft(form), [form])
  const errors: ValidationIssue[] = []
  const errorOf = (field: string) => errors.find((e) => e.field === field)?.message

  const set = <K extends keyof RecipeForm>(key: K, value: RecipeForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const videoHref = openableUrl(form.videoUrl)
  const ratioText = ratio(draft.beansG, draft.waterG)
  const isNew = initial.id === null

  const input = (field: string, key: 'name' | 'author' | 'videoUrl' | 'equipment' | 'beans' | 'water' | 'temp' | 'total', extra: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      id={`f-${field}`}
      className="input"
      value={form[key]}
      onChange={(e) => set(key, e.target.value)}
      aria-invalid={errorOf(field) ? true : undefined}
      aria-describedby={errorOf(field) ? `f-${field}-error` : undefined}
      {...extra}
    />
  )

  return (
    <div className="stack edit">
      <div className="edit-head">
        <button type="button" className="btn" onClick={onCancel}>
          やめる
        </button>
        <h1 className="page-title" style={{ margin: 0 }}>
          {isNew ? 'レシピを作る' : 'レシピを直す'}
        </h1>
      </div>

      {fromAi && (
        <div className="notice notice-warn" role="note">
          <p>AI の読み取りは間違えることがあります。動画と見比べて確かめてください</p>
        </div>
      )}

      {videoHref && (
        <a className="btn btn-block" href={videoHref} target="_blank" rel="noopener noreferrer">
          動画を開く ↗
        </a>
      )}

      <section className="card stack" aria-labelledby="basic-title">
        <h2 id="basic-title" className="section-title">
          基本の情報
        </h2>
        <Field id="f-name" label="レシピ名" required error={errorOf('name')}>
          {input('name', 'name', { placeholder: '例 4:6メソッド', autoComplete: 'off' })}
        </Field>
        <div className="grid-2">
          <Field id="f-beansG" label="豆の量" required error={errorOf('beansG')}>
            <div className="input-with-unit">
              {input('beansG', 'beans', { inputMode: 'decimal', placeholder: '15' })}
              <span className="unit">g</span>
            </div>
          </Field>
          <Field id="f-waterG" label="湯量" required error={errorOf('waterG')}>
            <div className="input-with-unit">
              {input('waterG', 'water', { inputMode: 'numeric', placeholder: '250' })}
              <span className="unit">g</span>
            </div>
          </Field>
        </div>
        <p className="ratio" aria-live="polite">
          比率（豆:湯）<strong>{ratioText ?? '—'}</strong>
          {!ratioText && <span className="muted small">　豆の量と湯量を入れると出ます</span>}
        </p>
        <div className="grid-2">
          <Field id="f-tempC" label="湯温" error={errorOf('tempC')}>
            <div className="input-with-unit">
              {input('tempC', 'temp', { inputMode: 'numeric', placeholder: '92' })}
              <span className="unit">℃</span>
            </div>
          </Field>
          <Field id="f-grind" label="挽き目">
            <select
              id="f-grind"
              className="input"
              value={form.grind ?? ''}
              onChange={(e) => set('grind', e.target.value === '' ? null : (e.target.value as Grind))}
            >
              <option value="">未設定</option>
              {GRINDS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id="f-totalSec" label="完成時刻" required error={errorOf('totalSec')} hint="抽出が終わる時刻。「分:秒」（例 3:00）か秒（例 180）で入れます">
          {input('totalSec', 'total', { placeholder: '3:00', autoComplete: 'off' })}
        </Field>
        <Field id="f-equipment" label="器具">
          {input('equipment', 'equipment', { placeholder: '例 V60、エアロプレス' })}
        </Field>
        <Field id="f-author" label="作者">
          {input('author', 'author', { placeholder: '例 動画のチャンネル名' })}
        </Field>
        <Field id="f-videoUrl" label="動画の URL">
          {input('videoUrl', 'videoUrl', { type: 'url', inputMode: 'url', placeholder: 'https://www.youtube.com/watch?v=…', autoComplete: 'off' })}
        </Field>
        <Field id="f-description" label="説明">
          <textarea
            id="f-description"
            className="input"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="例 すっきりした味になる淹れ方"
          />
        </Field>
      </section>
    </div>
  )
}
