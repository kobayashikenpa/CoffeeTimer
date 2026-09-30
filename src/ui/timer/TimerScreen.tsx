// タイマー画面（仕様 8）
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detectCue } from '../../engine/cue'
import { createRecordDraft } from '../../engine/record'
import type { RecordDraft } from '../../engine/record'
import type { Cue, CueMark } from '../../engine/cue'
import { parseDecimal } from '../../engine/number'
import { pourAmounts, ratio } from '../../engine/recipe'
import { normalizeBeans, scaleRecipe, stepBeans } from '../../engine/scale'
import { formatTime } from '../../engine/time'
import { initial, pause, reset, resume, seek, start, tick, view } from '../../engine/timer'
import type { TimerState } from '../../engine/timer'
import type { Recipe } from '../../engine/types'
import { openableUrl } from '../../engine/url'
import { Switch } from '../common/Switch'
import { prepareSound, playSound } from '../device/sound'
import { prepareSpeech, speak, stopSpeech } from '../device/speech'
import { useWakeLock } from '../device/wakeLock'
import { useSettings } from '../hooks'
import { RecordEditor } from '../records/RecordEditor'
import { Ring } from './Ring'
import './timer.css'

export interface TimerScreenProps {
  recipe: Recipe
  onBack: () => void
  onEdit: () => void
  /** 「記録をつける」で入れた記録を保存する */
  onSaveRecord: (draft: RecordDraft) => void
}

/** 今の時刻（ミリ秒） */
const nowMs = () => Date.now()

const PHASE_LABEL: Record<TimerState['phase'], string> = {
  ready: '準備',
  running: '抽出中',
  paused: '一時停止',
  done: '完成',
}

export function TimerScreen({ recipe, onBack, onEdit, onSaveRecord }: TimerScreenProps) {
  const [beans, setBeans] = useState(recipe.beansG)
  const [beansText, setBeansText] = useState(String(recipe.beansG))
  const [state, setState] = useState<TimerState>(initial)
  const [now, setNow] = useState(nowMs)
  const stateRef = useRef<TimerState>(state)
  // 「記録をつける」の入力中（タイマーの状態は残したまま、この画面の中で開く）
  const [recording, setRecording] = useState<RecordDraft | null>(null)
  const lastCueRef = useRef<CueMark>(null)

  // 豆の量を変えたときは、湯量・目標量を計算し直したレシピを使う（時間は変わらない）
  const scaled = useMemo(() => scaleRecipe(recipe, beans), [recipe, beans])

  // 音・読み上げの ON／OFF：初期値は設定から。ここでの切り替えはこの画面の中だけ（設定は変えない）
  const settings = useSettings()
  const [soundOn, setSoundOn] = useState(settings.soundOn)
  const [speechOn, setSpeechOn] = useState(settings.speechOn)
  const soundOnRef = useRef(soundOn)
  const speechOnRef = useRef(speechOn)
  useEffect(() => {
    soundOnRef.current = soundOn
    speechOnRef.current = speechOn
    if (!speechOn) stopSpeech()
  }, [soundOn, speechOn])
  // 画面を離れたら読み上げを止める
  useEffect(() => stopSpeech, [])

  /** 手順の切り替わりの合図：音と読み上げ（1回だけ） */
  const onCue = useCallback((cue: Cue) => {
    if (soundOnRef.current) playSound(cue.kind)
    if (speechOnRef.current) speak(cue.speech)
  }, [])

  /** iPhone で鳴るよう、ボタンを押した操作の中で音と読み上げを準備する */
  const prepareDevices = () => {
    if (soundOnRef.current) prepareSound()
    if (speechOnRef.current) prepareSpeech()
  }

  /**
   * 状態を進めて表示し直す。表示はいつも「今の時刻」から engine/timer で計算する（1秒ずつ足さない）。
   * 手順が切り替わっていれば合図を1回だけ出す
   */
  const advance = useCallback(
    (next: TimerState, t: number) => {
      const ticked = tick(next, scaled, t)
      const cue = detectCue(lastCueRef.current, view(ticked, scaled, t), scaled)
      if (cue) {
        lastCueRef.current = cue.mark
        onCue(cue)
      }
      stateRef.current = ticked
      setState(ticked)
      setNow(t)
    },
    [scaled, onCue],
  )

  // 抽出中は 0.25 秒ごとに表示し直す
  useEffect(() => {
    if (state.phase !== 'running') return
    const id = window.setInterval(() => advance(stateRef.current, nowMs()), 250)
    return () => window.clearInterval(id)
  }, [state.phase, advance])

  // 別のアプリから戻ったとき、すぐ実時間に合わせる
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') advance(stateRef.current, nowMs())
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onVisible)
    }
  }, [advance])

  const onPrimary = () => {
    prepareDevices()
    const t = nowMs()
    const cur = stateRef.current
    if (cur.phase === 'ready') advance(start(cur, t), t)
    else if (cur.phase === 'running') advance(pause(cur, t), t)
    else if (cur.phase === 'paused') advance(resume(cur, t), t)
  }
  const onReset = () => {
    lastCueRef.current = null
    advance(reset(), nowMs())
  }
  const onSeek = (index: number) => {
    prepareDevices()
    const cur = stateRef.current
    const t = nowMs()
    advance(seek(cur, scaled, index, t), t)
  }
  // 抽出中・一時停止中は画面を暗くしない。画面を離れたら（この部品が消えたら）放す
  const wakeLock = useWakeLock(state.phase === 'running' || state.phase === 'paused')

  const pours = useMemo(() => pourAmounts(scaled.steps), [scaled])
  const v = view(state, scaled, now)
  const canChangeBeans = state.phase === 'ready'
  const videoHref = openableUrl(recipe.videoUrl)

  const applyBeans = (value: number) => {
    const b = normalizeBeans(value)
    setBeans(b)
    setBeansText(String(b))
  }
  const commitBeansText = () => {
    const n = parseDecimal(beansText)
    if (n === null || n <= 0) setBeansText(String(beans))
    else applyBeans(n)
  }

  // 今の手順の場所に出す手順：準備中は START で始まる手順
  const shownIndex = state.phase === 'ready' ? v.nextIndex : v.currentIndex
  const shown = shownIndex === null ? null : scaled.steps[shownIndex]
  const shownPour = shownIndex === null ? null : pours[shownIndex]
  const nextIndex = state.phase === 'ready' ? (shownIndex === null ? null : shownIndex + 1) : v.nextIndex
  const next = nextIndex === null ? undefined : scaled.steps[nextIndex]

  if (recording) {
    return (
      <RecordEditor
        initial={recording}
        onSave={onSaveRecord}
        onCancel={() => {
          setRecording(null)
          window.scrollTo(0, 0)
        }}
      />
    )
  }

  return (
    <div className="timer">
      <div className="timer-head">
        <button type="button" className="btn" onClick={onBack} aria-label="レシピ一覧に戻る">
          ← 一覧
        </button>
        <h1 className="timer-title">{recipe.name}</h1>
      </div>
      <div className="timer-links">
        {videoHref && (
          <a className="btn" href={videoHref} target="_blank" rel="noopener noreferrer">
            動画を開く ↗
          </a>
        )}
        <button type="button" className="btn" onClick={onEdit}>
          編集
        </button>
      </div>

      {!canChangeBeans && (
        <p className="compact-info" aria-label="豆の量と湯量">
          <span className="nowrap">豆 {scaled.beansG}g</span>・<span className="nowrap">湯量 {scaled.waterG}g</span>・
          <span className="nowrap">比率 {ratio(scaled.beansG, scaled.waterG)}</span>
          {scaled.tempC !== null && (
            <>
              ・<span className="nowrap">{scaled.tempC}℃</span>
            </>
          )}
          {scaled.grind && (
            <>
              ・<span className="nowrap">{scaled.grind}</span>
            </>
          )}
          ・<span className="nowrap">抽出時間 {formatTime(scaled.totalSec)}</span>
        </p>
      )}
      {canChangeBeans && (
        <section className="card stack" aria-label="豆の量と湯量">
          <div className="beans">
            <label className="beans-label" htmlFor="beans-input">
              豆の量
            </label>
            <div className="beans-control">
              <button
                type="button"
                className="btn"
                aria-label="豆の量を 0.5g 減らす"
                disabled={!canChangeBeans}
                onClick={() => applyBeans(stepBeans(beans, -1))}
              >
                −
              </button>
              <input
                id="beans-input"
                className="input beans-input"
                inputMode="decimal"
                value={beansText}
                disabled={!canChangeBeans}
                onChange={(e) => setBeansText(e.target.value)}
                onBlur={commitBeansText}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
              />
              <span className="unit">g</span>
              <button
                type="button"
                className="btn"
                aria-label="豆の量を 0.5g 増やす"
                disabled={!canChangeBeans}
                onClick={() => applyBeans(stepBeans(beans, 1))}
              >
                ＋
              </button>
            </div>
          </div>
          {beans !== recipe.beansG && (
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small muted">レシピの豆の量は {recipe.beansG}g です</span>
              <button
                type="button"
                className="btn"
                disabled={!canChangeBeans}
                onClick={() => applyBeans(recipe.beansG)}
              >
                元に戻す
              </button>
            </div>
          )}
          <dl className="info-grid">
            <div>
              <dt>湯量</dt>
              <dd className={beans !== recipe.beansG ? 'changed' : undefined}>{scaled.waterG}g</dd>
            </div>
            <div>
              <dt>比率</dt>
              <dd>{ratio(scaled.beansG, scaled.waterG)}</dd>
            </div>
            <div>
              <dt>抽出時間</dt>
              <dd>{formatTime(scaled.totalSec)}</dd>
            </div>
            <div>
              <dt>湯温</dt>
              <dd>{scaled.tempC === null ? '—' : `${scaled.tempC}℃`}</dd>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <dt>挽き目</dt>
              <dd>{scaled.grind ?? '未設定'}</dd>
            </div>
          </dl>
        </section>
      )}

      <div className="toggles">
        <Switch
          label="音"
          checked={soundOn}
          onChange={(on) => {
            setSoundOn(on)
            if (on) prepareSound()
          }}
        />
        <Switch
          label="読み上げ"
          checked={speechOn}
          onChange={(on) => {
            setSpeechOn(on)
            if (on) prepareSpeech()
          }}
        />
      </div>

      <Ring
        progress={v.progress}
        marks={scaled.steps.map((s) => s.startSec / scaled.totalSec)}
        elapsedSec={v.elapsedSec}
        label={PHASE_LABEL[state.phase]}
      />

      <section className="card current" aria-live="polite" aria-label="今の手順">
        {v.done ? (
          <div className="stack" style={{ alignItems: 'center' }}>
            <span className="done-title">抽出完了</span>
            <button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              onClick={() => {
                // 豆の量を変えて淹れたときは、そのときの豆の量・湯量を入れる
                setRecording(createRecordDraft(recipe, scaled.beansG, scaled.waterG, new Date().toISOString()))
                window.scrollTo(0, 0)
              }}
            >
              記録をつける
            </button>
            <span className="small muted">豆の名前や味の感想を残せます。</span>
          </div>
        ) : shown ? (
          <>
            <div className="current-label">
              {state.phase === 'ready' ? '最初の手順（START で始まります）' : '今の手順'}
            </div>
            <div className="current-name">{shown.name}</div>
            {shown.targetG !== null && (
              <div className="current-target">
                {shown.targetG}g<small>まで</small>
              </div>
            )}
            {shownPour !== null && <div className="current-pour">+{shownPour}g</div>}
            {shown.description && <p className="current-desc">{shown.description}</p>}
            {shown.caution && <p className="current-caution">⚠ {shown.cautionText || '注意の手順です'}</p>}
          </>
        ) : null}
      </section>

      {!v.done && next && (
        <div className="card next">
          <span>
            次：<strong>{next.name}</strong>
          </span>
          <span className="next-sec">
            {state.phase === 'ready' ? `${formatTime(next.startSec)} から` : `あと ${v.secondsToNext ?? 0} 秒`}
          </span>
        </div>
      )}
      {!v.done && !next && state.phase !== 'ready' && (
        <div className="card next">
          <span>
            次：<strong>完成</strong>
          </span>
          <span className="next-sec">あと {Math.max(0, scaled.totalSec - v.elapsedSec)} 秒</span>
        </div>
      )}

      <section aria-labelledby="steps-title" className="stack" style={{ gap: 8 }}>
        <h2 id="steps-title" className="section-title" style={{ fontSize: '1.05rem' }}>
          手順の一覧
        </h2>
        <p className="small muted" style={{ margin: 0 }}>
          手順を押すと、その手順の開始の時刻に飛びます。
        </p>
        <ol className="step-list">
          {scaled.steps.map((s, i) => {
            const past = v.done || (v.currentIndex !== null && i < v.currentIndex)
            const current = v.currentIndex === i
            const cls = ['step-row', past && 'is-past', current && 'is-current', s.caution && 'is-caution']
              .filter(Boolean)
              .join(' ')
            return (
              <li key={i}>
                <button
                  type="button"
                  className={cls}
                  aria-current={current ? 'step' : undefined}
                  disabled={v.done}
                  onClick={() => onSeek(i)}
                  aria-label={`${formatTime(s.startSec)} ${s.name}${s.targetG === null ? '' : ` ${s.targetG}g まで`}。押すとこの手順に飛びます`}
                >
                  <span className="st-mark" aria-label={past ? '終わった' : current ? '今' : 'これから'}>
                    {past ? '✓' : current ? '▶' : ''}
                  </span>
                  <span className="st-time">{formatTime(s.startSec)}</span>
                  <span className="st-name">{s.name}</span>
                  <span className="st-target">{s.targetG === null ? '' : `${s.targetG}g`}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </section>

      {wakeLock.unavailable && (
        <p className="small muted" style={{ margin: 0 }}>
          この端末では、画面を暗くしない機能が使えません。抽出中に画面が暗くなったら、画面に触れてください。
        </p>
      )}

      <div className="controls">
        <button type="button" className="btn btn-primary" disabled={state.phase === 'done'} onClick={onPrimary}>
          {state.phase === 'running' ? '一時停止' : state.phase === 'paused' ? '再開' : 'START'}
        </button>
        <button type="button" className="btn" onClick={onReset}>
          RESET
        </button>
      </div>
    </div>
  )
}
