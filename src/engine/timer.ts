// タイマーの状態と進み具合（仕様 8.1・8.3、architecture.md 3.1・4.4）
// 経過は「抽出中になった時刻からの実時間」で出す（1秒ごとに足していく作りにしない）。
// どの関数も今の時刻 nowMs を引数で受け取る純粋な関数
import type { Recipe } from './types'

/** タイマーの状態（準備 → 抽出中 ⇄ 一時停止 → 完成） */
export type TimerState =
  /** 準備。startAtMs は START したときの開始位置（ふつう 0） */
  | { phase: 'ready'; startAtMs: number }
  /** 抽出中。経過 = nowMs − anchorMs */
  | { phase: 'running'; anchorMs: number }
  /** 一時停止。止めた時点の経過 */
  | { phase: 'paused'; elapsedMs: number }
  /** 完成 */
  | { phase: 'done' }

/** 画面に出す進み具合 */
export interface TimerView {
  /** 経過時間（秒、切り捨て） */
  elapsedSec: number
  /** 0〜1（輪の進み具合） */
  progress: number
  /** 今の手順（準備中・完成後は null） */
  currentIndex: number | null
  /** 次の手順（無ければ null） */
  nextIndex: number | null
  /** 次の手順が始まるまでの残り秒数（切り上げ。次が無ければ null） */
  secondsToNext: number | null
  done: boolean
}

type TimerRecipe = Pick<Recipe, 'steps' | 'totalSec'>

/** 最初の状態（準備） */
export function initial(): TimerState {
  return { phase: 'ready', startAtMs: 0 }
}

/** START：準備 → 抽出中。ほかの状態では何もしない */
export function start(state: TimerState, nowMs: number): TimerState {
  if (state.phase !== 'ready') return state
  return { phase: 'running', anchorMs: nowMs - state.startAtMs }
}

/** 一時停止：抽出中 → 一時停止。ほかの状態では何もしない */
export function pause(state: TimerState, nowMs: number): TimerState {
  if (state.phase !== 'running') return state
  return { phase: 'paused', elapsedMs: Math.max(0, nowMs - state.anchorMs) }
}

/** 再開：一時停止 → 抽出中（止めていた時間は数えない）。ほかの状態では何もしない */
export function resume(state: TimerState, nowMs: number): TimerState {
  if (state.phase !== 'paused') return state
  return { phase: 'running', anchorMs: nowMs - state.elapsedMs }
}

/** RESET：準備に戻る（確認は出さない） */
export function reset(): TimerState {
  return initial()
}

/**
 * 手順をタップしたとき、その手順の開始の時刻に飛ぶ。
 * 抽出中は続けて進む、一時停止中は止まったまま、準備中はそこからすぐ進み始める。
 * 完成後・無い手順の番号では何もしない
 */
export function seek(state: TimerState, recipe: TimerRecipe, index: number, nowMs: number): TimerState {
  const target = recipe.steps[index]
  if (!target || state.phase === 'done') return state
  const atMs = target.startSec * 1000
  switch (state.phase) {
    case 'running':
    case 'ready':
      return { phase: 'running', anchorMs: nowMs - atMs }
    case 'paused':
      return { phase: 'paused', elapsedMs: atMs }
  }
}

/** 経過（ミリ秒）。0 から完成時刻までに収める */
export function elapsedMs(state: TimerState, recipe: TimerRecipe, nowMs: number): number {
  const totalMs = recipe.totalSec * 1000
  let raw: number
  switch (state.phase) {
    case 'ready':
      raw = state.startAtMs
      break
    case 'running':
      raw = nowMs - state.anchorMs
      break
    case 'paused':
      raw = state.elapsedMs
      break
    case 'done':
      raw = totalMs
      break
  }
  return Math.min(totalMs, Math.max(0, raw))
}

/** 経過が完成時刻に達していれば完成にする。ほかは変えない */
export function tick(state: TimerState, recipe: TimerRecipe, nowMs: number): TimerState {
  if (state.phase !== 'running' && state.phase !== 'paused') return state
  if (elapsedMs(state, recipe, nowMs) >= recipe.totalSec * 1000) return { phase: 'done' }
  return state
}

/** 画面に出す進み具合を計算する */
export function view(state: TimerState, recipe: TimerRecipe, nowMs: number): TimerView {
  const totalMs = recipe.totalSec * 1000
  const ms = elapsedMs(state, recipe, nowMs)
  const done = state.phase === 'done' || (totalMs > 0 && ms >= totalMs && state.phase !== 'ready')
  const progress = totalMs > 0 ? ms / totalMs : 0
  const elapsedSec = Math.floor(ms / 1000)

  if (done) {
    return { elapsedSec, progress: 1, currentIndex: null, nextIndex: null, secondsToNext: null, done: true }
  }

  // 経過の時点で始まっている最後の手順（無ければ -1）
  const reached = recipe.steps.findLastIndex((s) => s.startSec * 1000 <= ms)
  const toNext = (i: number) => Math.max(0, Math.ceil((recipe.steps[i].startSec * 1000 - ms) / 1000))

  if (state.phase === 'ready') {
    // 準備中：今の手順は無く、次は START したとき始まる手順
    const nextIndex = recipe.steps.length === 0 ? null : Math.max(0, reached)
    return {
      elapsedSec,
      progress,
      currentIndex: null,
      nextIndex,
      secondsToNext: nextIndex === null ? null : toNext(nextIndex),
      done: false,
    }
  }

  const currentIndex = reached >= 0 ? reached : null
  const nextIndex = reached + 1 < recipe.steps.length ? reached + 1 : null
  return {
    elapsedSec,
    progress,
    currentIndex,
    nextIndex,
    secondsToNext: nextIndex === null ? null : toNext(nextIndex),
    done: false,
  }
}
