// タイマー画面（仕様 8）
import { useMemo, useState } from 'react'
import { parseDecimal } from '../../engine/number'
import { pourAmounts, ratio } from '../../engine/recipe'
import { normalizeBeans, scaleRecipe, stepBeans } from '../../engine/scale'
import { formatTime } from '../../engine/time'
import { initial, view } from '../../engine/timer'
import type { TimerState } from '../../engine/timer'
import type { Recipe } from '../../engine/types'
import { openableUrl } from '../../engine/url'
import { Ring } from './Ring'
import './timer.css'

export interface TimerScreenProps {
  recipe: Recipe
  onBack: () => void
  onEdit: () => void
}

const PHASE_LABEL: Record<TimerState['phase'], string> = {
  ready: '準備',
  running: '抽出中',
  paused: '一時停止',
  done: '完成',
}

export function TimerScreen({ recipe, onBack, onEdit }: TimerScreenProps) {
  const [beans, setBeans] = useState(recipe.beansG)
  const [beansText, setBeansText] = useState(String(recipe.beansG))
  const [state] = useState<TimerState>(initial)
  const [now] = useState(() => Date.now())

  // 豆の量を変えたときは、湯量・目標量を計算し直したレシピを使う（時間は変わらない）
  const scaled = useMemo(() => scaleRecipe(recipe, beans), [recipe, beans])
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

      <section aria-labelledby="steps-title" className="stack" style={{ gap: 8 }}>
        <h2 id="steps-title" className="section-title" style={{ fontSize: '1.05rem' }}>
          手順の一覧
        </h2>
        <ol className="step-list">
          {scaled.steps.map((s, i) => {
            const past = v.done || (v.currentIndex !== null && i < v.currentIndex)
            const current = v.currentIndex === i
            const cls = ['step-row', past && 'is-past', current && 'is-current', s.caution && 'is-caution']
              .filter(Boolean)
              .join(' ')
            return (
              <li key={i}>
                <div className={cls} aria-current={current ? 'step' : undefined}>
                  <span className="st-mark" aria-label={past ? '終わった' : current ? '今' : 'これから'}>
                    {past ? '✓' : current ? '▶' : ''}
                  </span>
                  <span className="st-time">{formatTime(s.startSec)}</span>
                  <span className="st-name">{s.name}</span>
                  <span className="st-target">{s.targetG === null ? '' : `${s.targetG}g`}</span>
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
