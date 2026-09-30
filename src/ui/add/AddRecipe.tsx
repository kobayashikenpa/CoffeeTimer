// レシピの追加画面（仕様 6.1〜6.3）：YouTube の URL・文章を貼り付ける・ファイルから受け取る・手で入れる
// AI の返答は engine で確かめた下書きだけを受け取り、確認・編集画面へ渡す（ここでは HTML として出さない）
import { useEffect, useRef, useState } from 'react'
import { readRecipe } from '../../ai/gemini'
import type { ReadErrorKind } from '../../ai/gemini'
import type { ReadInput } from '../../ai/prompt'
import { formatTime } from '../../engine/time'
import type { RecipeDraft } from '../../engine/types'
import { parseYouTubeUrl } from '../../engine/youtube'
import { apiKeyStore } from '../../store/apiKey'
import { resolveTextVideoUrl } from './addForm'
import type { AddForm, AddMode } from './addForm'
import { READ_ERROR_MESSAGES, READING_MESSAGE } from './messages'
import './add.css'

export interface AddRecipeProps {
  form: AddForm
  onFormChange: (form: AddForm) => void
  /** 読み取れたとき（確認・編集画面へ） */
  onRead: (draft: RecipeDraft) => void
  /** 「手で入れる」 */
  onManual: () => void
  onBack: () => void
  /** 設定（APIキー）を開く */
  onOpenSettings: () => void
}

const URL_FORMAT_ERROR =
  'YouTube の動画の URL を入れてください（例 https://www.youtube.com/watch?v=… 、https://youtu.be/…）'
const TEXT_URL_FORMAT_ERROR = 'URL の形が違います。https:// で始まる URL を入れるか、空にしてください'

type ShownError = Exclude<ReadErrorKind, 'cancelled'>

export function AddRecipe({ form, onFormChange, onRead, onManual, onBack, onOpenSettings }: AddRecipeProps) {
  const [urlError, setUrlError] = useState<string | null>(null)
  const [textError, setTextError] = useState<string | null>(null)
  const [textUrlError, setTextUrlError] = useState<string | null>(null)
  const [readError, setReadError] = useState<ShownError | null>(null)
  const [reading, setReading] = useState<{ mode: AddMode; startedAt: number } | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)

  // 画面を離れたら読み取りをやめる
  useEffect(() => () => ctrlRef.current?.abort(), [])

  const set = (patch: Partial<AddForm>) => onFormChange({ ...form, ...patch })
  const chooseMode = (mode: AddMode) => {
    set({ mode })
    setReadError(null)
  }

  const start = async (input: ReadInput, videoUrl: string | undefined) => {
    setReadError(null)
    const apiKey = apiKeyStore().get()
    if (apiKey === null) {
      setReadError('noKey')
      return
    }
    const ctrl = new AbortController()
    ctrlRef.current = ctrl
    setReading({ mode: input.kind, startedAt: Date.now() })
    const result = await readRecipe({ input, videoUrl, apiKey, signal: ctrl.signal })
    if (ctrlRef.current === ctrl) ctrlRef.current = null
    setReading(null)
    if (result.ok) {
      onRead(result.draft)
      return
    }
    if (result.error !== 'cancelled') setReadError(result.error)
  }

  const submitUrl = () => {
    const parsed = parseYouTubeUrl(form.url)
    if (!parsed) {
      // 形が違えば送らずに、その場で知らせる
      setUrlError(URL_FORMAT_ERROR)
      document.getElementById('f-add-url')?.focus()
      return
    }
    setUrlError(null)
    void start({ kind: 'url', url: parsed.url }, parsed.url)
  }

  const submitText = () => {
    const text = form.text.trim()
    const videoUrl = resolveTextVideoUrl(form.textUrl)
    setTextError(text === '' ? 'レシピの文章を貼り付けてください' : null)
    setTextUrlError(videoUrl === null ? TEXT_URL_FORMAT_ERROR : null)
    if (text === '' || videoUrl === null) return
    void start({ kind: 'text', text }, videoUrl)
  }

  /** 「動画を開けない」などから、文章の貼り付けへ切り替える（入れた URL は動画の URL として持っていく） */
  const switchToText = () => {
    const parsed = parseYouTubeUrl(form.url)
    onFormChange({ ...form, mode: 'text', textUrl: form.textUrl.trim() === '' && parsed ? parsed.url : form.textUrl })
    setReadError(null)
    requestAnimationFrame(() => document.getElementById('f-add-text')?.focus())
  }

  const errorBox = readError && (
    <div className="notice notice-danger stack" role="alert" style={{ gap: 10 }}>
      <p style={{ fontWeight: 700 }}>{READ_ERROR_MESSAGES[readError]}</p>
      {(readError === 'noKey' || readError === 'invalidKey') && (
        <button type="button" className="btn btn-primary btn-block" onClick={onOpenSettings}>
          設定を開く
        </button>
      )}
      {form.mode === 'url' && (readError === 'video' || readError === 'broken' || readError === 'timeout') && (
        <button type="button" className="btn btn-primary btn-block" onClick={switchToText}>
          文章を貼り付ける
        </button>
      )}
    </div>
  )

  return (
    <div className="stack add">
      <div className="add-head">
        <button type="button" className="btn" onClick={onBack}>
          戻る
        </button>
        <h1 className="page-title" style={{ margin: 0 }}>
          レシピを追加
        </h1>
      </div>

      <div className="add-choices" role="group" aria-label="入れ方を選ぶ">
        <button
          type="button"
          className="choice"
          aria-pressed={form.mode === 'url'}
          onClick={() => chooseMode('url')}
        >
          <span className="choice-title">YouTube の URL</span>
          <span className="choice-note">動画から AI が読み取ります</span>
        </button>
        <button
          type="button"
          className="choice"
          aria-pressed={form.mode === 'text'}
          onClick={() => chooseMode('text')}
        >
          <span className="choice-title">文章を貼り付ける</span>
          <span className="choice-note">説明欄やブログの文章から AI が読み取ります</span>
        </button>
        <button type="button" className="choice" disabled aria-describedby="file-soon">
          <span className="choice-title">ファイルから受け取る</span>
          <span className="choice-note" id="file-soon">
            今後の版で使えるようになります
          </span>
        </button>
        <button type="button" className="choice" onClick={onManual}>
          <span className="choice-title">手で入れる</span>
          <span className="choice-note">空の画面から自分で入れます</span>
        </button>
      </div>

      {form.mode === 'url' && (
        <form
          className="card stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            submitUrl()
          }}
        >
          <div className="field">
            <label className="field-label" htmlFor="f-add-url">
              YouTube の動画の URL
            </label>
            <input
              id="f-add-url"
              className="input"
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="https://www.youtube.com/watch?v=…"
              value={form.url}
              onChange={(e) => {
                set({ url: e.target.value })
                if (urlError && parseYouTubeUrl(e.target.value)) setUrlError(null)
              }}
              onBlur={() => {
                if (form.url.trim() !== '' && !parseYouTubeUrl(form.url)) setUrlError(URL_FORMAT_ERROR)
              }}
              aria-invalid={urlError ? true : undefined}
              aria-describedby={urlError ? 'f-add-url-error' : 'f-add-url-hint'}
            />
            {urlError ? (
              <p className="field-error" id="f-add-url-error">
                {urlError}
              </p>
            ) : (
              <p className="muted small" style={{ margin: 0 }} id="f-add-url-hint">
                YouTube のアプリの「共有」→「コピー」で URL をコピーして、ここに貼り付けます
              </p>
            )}
          </div>
          {errorBox}
          <button type="submit" className="btn btn-primary btn-block btn-lg">
            AI で読み取る
          </button>
        </form>
      )}

      {form.mode === 'text' && (
        <form
          className="card stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            submitText()
          }}
        >
          <div className="field">
            <label className="field-label" htmlFor="f-add-text">
              レシピの文章
            </label>
            <textarea
              id="f-add-text"
              className="input add-text"
              value={form.text}
              placeholder="動画の説明欄やブログの、豆の量・湯量・手順が書かれた文章を貼り付けます"
              onChange={(e) => {
                set({ text: e.target.value })
                if (textError && e.target.value.trim() !== '') setTextError(null)
              }}
              aria-invalid={textError ? true : undefined}
              aria-describedby={textError ? 'f-add-text-error' : undefined}
            />
            {textError && (
              <p className="field-error" id="f-add-text-error">
                {textError}
              </p>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="f-add-text-url">
              動画の URL（あれば）
            </label>
            <input
              id="f-add-text-url"
              className="input"
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="https://www.youtube.com/watch?v=…"
              value={form.textUrl}
              onChange={(e) => {
                set({ textUrl: e.target.value })
                if (textUrlError && resolveTextVideoUrl(e.target.value) !== null) setTextUrlError(null)
              }}
              aria-invalid={textUrlError ? true : undefined}
              aria-describedby={textUrlError ? 'f-add-text-url-error' : 'f-add-text-url-hint'}
            />
            {textUrlError ? (
              <p className="field-error" id="f-add-text-url-error">
                {textUrlError}
              </p>
            ) : (
              <p className="muted small" style={{ margin: 0 }} id="f-add-text-url-hint">
                入れると、レシピの「動画の URL」として保存します（AI には送りません）
              </p>
            )}
          </div>
          {errorBox}
          <button type="submit" className="btn btn-primary btn-block btn-lg">
            AI で読み取る
          </button>
        </form>
      )}

      {reading && (
        <ReadingDialog
          message={READING_MESSAGE[reading.mode]}
          startedAt={reading.startedAt}
          onCancel={() => ctrlRef.current?.abort()}
        />
      )}
    </div>
  )
}

/** 読み取り中の表示と「やめる」 */
function ReadingDialog({ message, startedAt, onCancel }: { message: string; startedAt: number; onCancel: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    cancelRef.current?.focus()
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="overlay overlay-center">
      <div className="dialog reading" role="dialog" aria-modal="true" aria-labelledby="reading-title" aria-busy="true">
        <div className="spinner" aria-hidden="true" />
        <p id="reading-title" className="dialog-title" role="status">
          {message}
        </p>
        <p className="muted" style={{ margin: 0 }}>
          経過 {formatTime(Math.max(0, (now - startedAt) / 1000))}
        </p>
        <button type="button" ref={cancelRef} className="btn btn-block" onClick={onCancel}>
          やめる
        </button>
      </div>
    </div>
  )
}
