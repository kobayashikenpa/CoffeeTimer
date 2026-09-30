// 設定画面の APIキー欄（仕様 6.4・11）
// キーの文字は画面に出さない（「設定済み」とだけ出す）。確かめの結果も、キーの文字を含めない
import { useEffect, useRef, useState } from 'react'
import { checkApiKey } from '../../ai/gemini'
import type { KeyCheckResult } from '../../ai/gemini'
import { apiKeyStore } from '../../store/apiKey'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { useHasApiKey } from '../hooks'

/** Google AI Studio の APIキーの画面 */
export const AI_STUDIO_URL = 'https://aistudio.google.com/apikey'

/** 「キーを確かめる」の結果の文（暫定） */
const CHECK_MESSAGES: Record<KeyCheckResult, { text: string; ok: boolean }> = {
  ok: { text: 'このキーは使えます', ok: true },
  invalidKey: { text: 'APIキーが正しくないようです。キーを入れ直してください', ok: false },
  quota: { text: 'AI の利用回数の上限に達しました。しばらく待ってから試してください', ok: false },
  network: { text: 'インターネットにつながっていないようです', ok: false },
  unknown: { text: 'いまは確かめられませんでした。しばらく待ってから試してください', ok: false },
}

type Status = { kind: 'saved' } | { kind: 'cleared' } | { kind: 'checking' } | { kind: 'checked'; result: KeyCheckResult }

export function ApiKeySection({ onSaveResult }: { onSaveResult: (ok: boolean) => void }) {
  const hasKey = useHasApiKey()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<Status | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const checkCtrl = useRef<AbortController | null>(null)
  const showForm = !hasKey || editing

  // 画面を離れたら、確かめの途中の通信をやめる
  useEffect(() => () => checkCtrl.current?.abort(), [])

  const save = () => {
    if (value.trim() === '') return
    onSaveResult(apiKeyStore().set(value))
    setValue('')
    setEditing(false)
    setStatus({ kind: 'saved' })
  }

  const check = async () => {
    const key = apiKeyStore().get()
    if (key === null) return
    checkCtrl.current?.abort()
    const ctrl = new AbortController()
    checkCtrl.current = ctrl
    setStatus({ kind: 'checking' })
    const result = await checkApiKey({ apiKey: key, signal: ctrl.signal })
    if (ctrl.signal.aborted) return
    setStatus({ kind: 'checked', result })
  }

  const statusView = (() => {
    if (!status) return null
    if (status.kind === 'saved') return <p className="key-result key-ok">保存しました。「キーを確かめる」で使えるかを試せます</p>
    if (status.kind === 'cleared') return <p className="key-result">APIキーを消しました</p>
    if (status.kind === 'checking') return <p className="key-result">確かめています…</p>
    const m = CHECK_MESSAGES[status.result]
    return <p className={`key-result ${m.ok ? 'key-ok' : 'key-ng'}`}>{m.ok ? '✓ ' : '⚠ '}{m.text}</p>
  })()

  return (
    <section className="card stack" aria-labelledby="apikey-title">
      <h2 id="apikey-title" className="section-title">
        APIキー（AI の読み取り）
      </h2>
      <p style={{ margin: 0 }}>
        YouTube の動画からレシピを読み取るには、Google の AI（Gemini）を使うための「APIキー」が必要です。APIキーは、あなた専用の鍵となる文字列で、無料で取れます。
      </p>

      <p className="key-state" aria-live="polite">
        今の状態：<strong>{hasKey ? '設定済み' : '未設定'}</strong>
      </p>

      {showForm && (
        <form
          className="stack"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <label className="field-label" htmlFor="f-apikey">
            {hasKey ? '新しい APIキー' : 'APIキー'}
          </label>
          <input
            id="f-apikey"
            className="input"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            placeholder="ここに貼り付けます"
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={value.trim() === ''}>
            保存
          </button>
          {editing && (
            <button
              type="button"
              className="btn btn-block"
              onClick={() => {
                setEditing(false)
                setValue('')
              }}
            >
              やめる
            </button>
          )}
        </form>
      )}

      {hasKey && !editing && (
        <div className="stack" style={{ gap: 8 }}>
          <button type="button" className="btn btn-primary btn-block" onClick={check} disabled={status?.kind === 'checking'}>
            キーを確かめる
          </button>
          <button
            type="button"
            className="btn btn-block"
            onClick={() => {
              setEditing(true)
              setStatus(null)
            }}
          >
            キーを入れ直す
          </button>
          <button type="button" className="btn btn-block btn-danger" onClick={() => setConfirmClear(true)}>
            キーを消す
          </button>
        </div>
      )}

      <div aria-live="polite">{statusView}</div>

      <details className="howto-box">
        <summary>APIキーの取り方</summary>
        <ol className="howto">
          <li>
            下のボタンで Google AI Studio を開きます（別の画面で開きます）
            <a className="btn btn-block howto-link" href={AI_STUDIO_URL} target="_blank" rel="noopener noreferrer">
              Google AI Studio（APIキーの画面）↗
            </a>
          </li>
          <li>Google のアカウントでログインします</li>
          <li>
            「APIキーを作成」「Create API key」などの名前のボタンを押します（見つからないときは、「API キー」「Get API key」などと書かれた場所を開いてから探します）
          </li>
          <li>出てきたキーをコピーし、上の欄に貼り付けて「保存」を押します</li>
        </ol>
        <p className="muted small" style={{ margin: 0 }}>
          Google の画面は、ボタンの名前や場所がときどき変わります。同じ言葉が見つからないときは、近い意味のボタンを探してください。
        </p>
      </details>
      <ul className="muted small key-notes">
        <li>APIキーは、ほかの人に教えないでください</li>
        <li>キーはこの端末のブラウザの中にだけ保存されます。バックアップや人に渡すファイルには入りません</li>
        <li>無料で使える回数には上限があります</li>
      </ul>

      {confirmClear && (
        <ConfirmDialog
          title="APIキーを消しますか？"
          message="消すと、AI でレシピを読み取れなくなります。もう一度使うには、キーを入れ直してください。"
          confirmLabel="消す"
          danger
          onConfirm={() => {
            checkCtrl.current?.abort()
            onSaveResult(apiKeyStore().clear())
            setConfirmClear(false)
            setEditing(false)
            setStatus({ kind: 'cleared' })
          }}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </section>
  )
}
