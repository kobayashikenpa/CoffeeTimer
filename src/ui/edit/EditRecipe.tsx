// 確認・編集画面（仕様 7）
import { useMemo, useRef, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { pourAmounts, ratio } from '../../engine/recipe'
import { GRINDS } from '../../engine/types'
import type { Grind, RecipeDraft } from '../../engine/types'
import { openableUrl } from '../../engine/url'
import { validateRecipe } from '../../engine/validate'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { Field } from '../common/Field'
import { Switch } from '../common/Switch'
import { draftToForm, emptyStepForm, formToDraft, mergeIssues, sortStepForms } from './form'
import type { RecipeForm, StepForm } from './form'
import './edit.css'

export interface EditRecipeProps {
  /** 開いたときの下書き（新しいレシピ・既存のレシピ・AI の読み取り結果） */
  initial: RecipeDraft
  /** AI で読み取った直後なら true（注意の文を出す） */
  fromAi?: boolean
  /** 保存を押し、確かめを通ったとき（エラーが無い下書き。手順は開始の時刻の順） */
  onSave: (draft: RecipeDraft) => void
  onCancel: () => void
}

/** 変更があったかを見るための写し（画面の中だけの印 key は除く） */
function snapshot(form: RecipeForm): string {
  return JSON.stringify({ ...form, steps: form.steps.map(({ key: _key, ...rest }) => rest) })
}

export function EditRecipe({ initial, fromAi = false, onSave, onCancel }: EditRecipeProps) {
  const [form, setForm] = useState<RecipeForm>(() => draftToForm(initial))
  const [initialSnapshot] = useState(() => snapshot(form))
  const [attempted, setAttempted] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const { draft, formatErrors } = useMemo(() => formToDraft(form), [form])
  const result = useMemo(() => validateRecipe(draft), [draft])
  // エラーは「保存」を一度押してから出す（入れ始めから赤い字だらけにしない）。注意はいつも出す
  const errors = attempted ? mergeIssues(formatErrors, result.errors) : []
  const warnings = result.warnings
  const errorOf = (field: string) => errors.find((e) => e.field === field)?.message
  const warnOf = (field: string) => warnings.find((e) => e.field === field)?.message
  const pours = pourAmounts(draft.steps)

  const set = <K extends keyof RecipeForm>(key: K, value: RecipeForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setStep = (key: string, patch: Partial<StepForm>) =>
    setForm((f) => ({ ...f, steps: f.steps.map((s) => (s.key === key ? { ...s, ...patch } : s)) }))
  const sortNow = () => setForm((f) => ({ ...f, steps: sortStepForms(f.steps) }))

  const addStep = () => {
    const step = emptyStepForm()
    setForm((f) => ({ ...f, steps: [...f.steps, step] }))
    requestAnimationFrame(() => document.getElementById(`f-${step.key}-start`)?.focus())
  }
  const removeStep = (key: string) => setForm((f) => ({ ...f, steps: f.steps.filter((s) => s.key !== key) }))

  const save = () => {
    const sorted: RecipeForm = { ...form, steps: sortStepForms(form.steps) }
    setForm(sorted)
    setAttempted(true)
    const converted = formToDraft(sorted)
    const all = mergeIssues(converted.formatErrors, validateRecipe(converted.draft).errors)
    if (all.length === 0) {
      onSave(converted.draft)
      return
    }
    // 最初のエラーの項目へ動かす
    requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], .field-error')
      el?.scrollIntoView({ block: 'center' })
      if (el instanceof HTMLInputElement) el.focus({ preventScroll: true })
    })
  }

  const cancel = () => {
    if (snapshot(form) !== initialSnapshot) setConfirmCancel(true)
    else onCancel()
  }
  const videoHref = openableUrl(form.videoUrl)
  const ratioText = ratio(draft.beansG, draft.waterG)
  const isNew = initial.id === null

  const input = (
    field: string,
    key: 'name' | 'author' | 'videoUrl' | 'equipment' | 'beans' | 'water' | 'temp' | 'total',
    extra: InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
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
    <div className="stack edit" ref={rootRef}>
      <div className="edit-head">
        <button type="button" className="btn" onClick={cancel}>
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
        <Field
          id="f-totalSec"
          label="完成時刻"
          required
          error={errorOf('totalSec')}
          hint="抽出が終わる時刻。「分:秒」（例 3:00）か秒（例 180）で入れます"
        >
          {input('totalSec', 'total', { placeholder: '3:00', autoComplete: 'off' })}
        </Field>
        <Field id="f-equipment" label="器具">
          {input('equipment', 'equipment', { placeholder: '例 V60、エアロプレス' })}
        </Field>
        <Field id="f-author" label="作者">
          {input('author', 'author', { placeholder: '例 動画のチャンネル名' })}
        </Field>
        <Field id="f-videoUrl" label="動画の URL">
          {input('videoUrl', 'videoUrl', {
            type: 'url',
            inputMode: 'url',
            placeholder: 'https://www.youtube.com/watch?v=…',
            autoComplete: 'off',
          })}
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

      <section className="stack" aria-labelledby="steps-title">
        <h2 id="steps-title" className="section-title">
          手順
        </h2>
        <p className="muted small" style={{ margin: 0 }}>
          開始の時刻の順に自動で並びます。目標量は、その手順の終わりにスケール（はかり）が示す重さ（注いだ合計）です。お湯を注がない手順は空にします。
        </p>
        {errorOf('steps') && <p className="field-error">{errorOf('steps')}</p>}
        <ol className="step-forms">
          {form.steps.map((s, i) => {
            const f = (name: string) => `steps.${i}.${name}`
            const id = (name: string) => `f-${s.key}-${name}`
            const pour = pours[i]
            return (
              <li key={s.key} className="card stack step-form">
                <div className="step-form-head">
                  <span className="step-no">手順 {i + 1}</span>
                  <button type="button" className="btn btn-ghost small" onClick={() => removeStep(s.key)}>
                    この手順を削除
                  </button>
                </div>
                <div className="grid-2">
                  <Field id={id('start')} label="開始" required error={errorOf(f('startSec'))}>
                    <input
                      id={id('start')}
                      className="input"
                      value={s.start}
                      placeholder={i === 0 ? '0:00' : '例 0:40'}
                      autoComplete="off"
                      onChange={(e) => setStep(s.key, { start: e.target.value })}
                      onBlur={sortNow}
                      aria-invalid={errorOf(f('startSec')) ? true : undefined}
                      aria-describedby={errorOf(f('startSec')) ? `${id('start')}-error` : undefined}
                    />
                  </Field>
                  <Field id={id('target')} label="目標量" error={errorOf(f('targetG'))}>
                    <div className="input-with-unit">
                      <input
                        id={id('target')}
                        className="input"
                        value={s.target}
                        inputMode="numeric"
                        placeholder="例 50"
                        onChange={(e) => setStep(s.key, { target: e.target.value })}
                        aria-invalid={errorOf(f('targetG')) ? true : undefined}
                        aria-describedby={errorOf(f('targetG')) ? `${id('target')}-error` : undefined}
                      />
                      <span className="unit">g</span>
                    </div>
                  </Field>
                </div>
                {pour !== null && pour !== undefined && (
                  <p className="muted small" style={{ margin: 0 }}>
                    この手順で注ぐ量 {pour >= 0 ? '+' : ''}
                    {pour}g
                  </p>
                )}
                {warnOf(f('targetG')) && <p className="field-warn">⚠ {warnOf(f('targetG'))}</p>}
                <Field id={id('name')} label="手順名" required error={errorOf(f('name'))}>
                  <input
                    id={id('name')}
                    className="input"
                    value={s.name}
                    placeholder={i === 0 ? '例 蒸らし' : `例 ${i}投目`}
                    autoComplete="off"
                    onChange={(e) => setStep(s.key, { name: e.target.value })}
                    aria-invalid={errorOf(f('name')) ? true : undefined}
                    aria-describedby={errorOf(f('name')) ? `${id('name')}-error` : undefined}
                  />
                </Field>
                <Field id={id('desc')} label="説明">
                  <textarea
                    id={id('desc')}
                    className="input"
                    value={s.description}
                    placeholder="例 中心から「の」の字を描くように注ぐ"
                    onChange={(e) => setStep(s.key, { description: e.target.value })}
                  />
                </Field>
                <Switch
                  label="注意の手順にする"
                  note="タイマーで赤く出し、低めの音で知らせます"
                  checked={s.caution}
                  onChange={(v) => setStep(s.key, { caution: v })}
                />
                {s.caution && (
                  <Field id={id('caution')} label="注意の文">
                    <input
                      id={id('caution')}
                      className="input"
                      value={s.cautionText}
                      placeholder="例 ゆっくり押す"
                      onChange={(e) => setStep(s.key, { cautionText: e.target.value })}
                    />
                  </Field>
                )}
              </li>
            )
          })}
        </ol>
        <button type="button" className="btn btn-block" onClick={addStep}>
          ＋ 手順を追加
        </button>
      </section>

      <div className="stack save-area">
        {warnings.length > 0 && (
          <div className="notice notice-warn" role="status">
            <p style={{ fontWeight: 700 }}>⚠ 確かめてください（このままでも保存できます）</p>
            <ul className="issue-list">
              {warnings.map((w) => (
                <li key={w.field + w.message}>{w.message}</li>
              ))}
            </ul>
          </div>
        )}
        {errors.length > 0 && (
          <div className="notice notice-danger" role="alert">
            <p>保存できません。赤い字のところ（{errors.length} か所）を直してください。</p>
          </div>
        )}
        <button type="button" className="btn btn-primary btn-block btn-lg" onClick={save}>
          保存
        </button>
        <button type="button" className="btn btn-block" onClick={cancel}>
          やめる
        </button>
      </div>

      {confirmCancel && (
        <ConfirmDialog
          title="入れた内容を保存せずに戻りますか？"
          message="直したところは消えます。"
          confirmLabel="保存せずに戻る"
          cancelLabel="編集を続ける"
          danger
          onConfirm={onCancel}
          onCancel={() => setConfirmCancel(false)}
        />
      )}
    </div>
  )
}
