import { describe, expect, it } from 'vitest'
import { elapsedMs, initial, pause, reset, resume, seek, start, tick, view } from './timer'
import type { TimerState } from './timer'
import type { Recipe, Step } from './types'

function step(startSec: number, name: string, targetG: number | null): Step {
  return { startSec, name, description: '', targetG, caution: false, cautionText: '' }
}

/** 手順の開始 0・45・90 秒、完成 210 秒 */
const recipe: Recipe = {
  id: 'r1',
  name: '4:6メソッド',
  author: '',
  videoUrl: '',
  equipment: 'V60',
  beansG: 15,
  waterG: 250,
  tempC: 92,
  grind: null,
  description: '',
  totalSec: 210,
  steps: [step(0, '蒸らし', 50), step(45, '2投目', 120), step(90, '3投目', 250)],
  favorite: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

/** START を押した時刻（Date.now() のつもりの大きな値） */
const T0 = 1_700_000_000_000

describe('準備（ready）', () => {
  it('最初は準備で、経過 0・今の手順なし・次は最初の手順', () => {
    const s = initial()
    expect(s).toEqual({ phase: 'ready', startAtMs: 0 })
    expect(view(s, recipe, T0)).toEqual({
      elapsedSec: 0,
      progress: 0,
      currentIndex: null,
      nextIndex: 0,
      secondsToNext: 0,
      done: false,
    })
  })
  it('準備のままなら時間がたっても経過は 0', () => {
    expect(elapsedMs(initial(), recipe, T0 + 99_000)).toBe(0)
  })
})

describe('抽出中（running）', () => {
  it('START から 45.2 秒後：経過 45 秒、今は 2投目、次は 3投目、あと 45 秒', () => {
    const s = start(initial(), T0)
    expect(s.phase).toBe('running')
    const v = view(s, recipe, T0 + 45_200)
    expect(v.elapsedSec).toBe(45)
    expect(v.currentIndex).toBe(1)
    expect(v.nextIndex).toBe(2)
    expect(v.secondsToNext).toBe(45)
    expect(v.done).toBe(false)
  })
  it('START 直後は最初の手順（0 秒）が今の手順', () => {
    const v = view(start(initial(), T0), recipe, T0)
    expect(v.currentIndex).toBe(0)
    expect(v.nextIndex).toBe(1)
    expect(v.secondsToNext).toBe(45)
  })
  it('手順の開始ちょうどで切り替わる', () => {
    const s = start(initial(), T0)
    expect(view(s, recipe, T0 + 44_999).currentIndex).toBe(0)
    expect(view(s, recipe, T0 + 45_000).currentIndex).toBe(1)
  })
  it('次までの残り秒数は切り上げ（0.3 秒残りなら 1）', () => {
    const s = start(initial(), T0)
    expect(view(s, recipe, T0 + 44_700).secondsToNext).toBe(1)
  })
  it('最後の手順では次の手順は無い', () => {
    const v = view(start(initial(), T0), recipe, T0 + 100_000)
    expect(v.currentIndex).toBe(2)
    expect(v.nextIndex).toBeNull()
    expect(v.secondsToNext).toBeNull()
  })
  it('進み具合は 経過 ÷ 完成時刻', () => {
    expect(view(start(initial(), T0), recipe, T0 + 105_000).progress).toBeCloseTo(0.5)
  })
  it('途中の時刻を飛ばして呼んでも（画面の更新が遅れても）経過は実時間どおり', () => {
    const s = start(initial(), T0)
    expect(view(s, recipe, T0 + 1_000).elapsedSec).toBe(1)
    // 間の呼び出しなしで 100 秒後
    const v = view(tick(s, recipe, T0 + 100_000), recipe, T0 + 100_000)
    expect(v.elapsedSec).toBe(100)
    expect(v.currentIndex).toBe(2)
  })
  it('時計が戻っても経過は負にならない', () => {
    expect(elapsedMs(start(initial(), T0), recipe, T0 - 5_000)).toBe(0)
  })
  it('抽出中に START を押しても変わらない', () => {
    const s = start(initial(), T0)
    expect(start(s, T0 + 10_000)).toBe(s)
  })
})

describe('一時停止（paused）', () => {
  it('30 秒で一時停止 → 100 秒後に再開 → さらに 10 秒後の経過は 40 秒', () => {
    let s: TimerState = start(initial(), T0)
    s = pause(s, T0 + 30_000)
    expect(s.phase).toBe('paused')
    expect(elapsedMs(s, recipe, T0 + 130_000)).toBe(30_000)
    s = resume(s, T0 + 130_000)
    expect(s.phase).toBe('running')
    expect(view(s, recipe, T0 + 140_000).elapsedSec).toBe(40)
  })
  it('一時停止中は経過が止まったまま', () => {
    const s = pause(start(initial(), T0), T0 + 30_000)
    expect(view(s, recipe, T0 + 999_000).elapsedSec).toBe(30)
    expect(view(s, recipe, T0 + 999_000).currentIndex).toBe(0)
  })
  it('準備中の一時停止・抽出中の再開は何もしない', () => {
    const ready = initial()
    expect(pause(ready, T0)).toBe(ready)
    const running = start(ready, T0)
    expect(resume(running, T0 + 1_000)).toBe(running)
  })
})

describe('完成（done）', () => {
  it('完成時刻で done になり、経過は完成時刻で止まる', () => {
    const s = start(initial(), T0)
    expect(tick(s, recipe, T0 + 209_999).phase).toBe('running')
    const done = tick(s, recipe, T0 + 210_000)
    expect(done).toEqual({ phase: 'done' })
    const v = view(done, recipe, T0 + 500_000)
    expect(v.done).toBe(true)
    expect(v.elapsedSec).toBe(210)
    expect(v.progress).toBe(1)
    expect(v.currentIndex).toBeNull()
    expect(v.nextIndex).toBeNull()
  })
  it('tick を呼ぶ前でも、経過は完成時刻を超えない', () => {
    const s = start(initial(), T0)
    expect(elapsedMs(s, recipe, T0 + 900_000)).toBe(210_000)
    expect(view(s, recipe, T0 + 900_000).done).toBe(true)
    expect(view(s, recipe, T0 + 900_000).progress).toBe(1)
  })
  it('完成時刻を過ぎてから一時停止されても、tick で done になる', () => {
    const s = pause(start(initial(), T0), T0 + 300_000)
    expect(tick(s, recipe, T0 + 300_000)).toEqual({ phase: 'done' })
  })
  it('完成時刻より前の tick では変わらない', () => {
    const s = start(initial(), T0)
    expect(tick(s, recipe, T0 + 10_000)).toBe(s)
  })
})

describe('手順へ飛ぶ（seek）', () => {
  it('抽出中：その手順の開始に飛んで、続けて進む', () => {
    const s = seek(start(initial(), T0), recipe, 2, T0 + 10_000)
    expect(s.phase).toBe('running')
    expect(view(s, recipe, T0 + 10_000).elapsedSec).toBe(90)
    expect(view(s, recipe, T0 + 15_000).elapsedSec).toBe(95)
  })
  it('抽出中：前の手順へ戻ることもできる', () => {
    const s = seek(start(initial(), T0), recipe, 0, T0 + 100_000)
    expect(view(s, recipe, T0 + 100_000).elapsedSec).toBe(0)
    expect(view(s, recipe, T0 + 100_000).currentIndex).toBe(0)
  })
  it('一時停止中：その手順の開始に飛び、止まったまま', () => {
    const s = seek(pause(start(initial(), T0), T0 + 10_000), recipe, 1, T0 + 20_000)
    expect(s).toEqual({ phase: 'paused', elapsedMs: 45_000 })
    expect(view(s, recipe, T0 + 90_000).elapsedSec).toBe(45)
    expect(view(s, recipe, T0 + 90_000).currentIndex).toBe(1)
  })
  it('準備中：その手順の開始から、すぐ進み始める', () => {
    const s = seek(initial(), recipe, 1, T0)
    expect(s.phase).toBe('running')
    expect(view(s, recipe, T0).elapsedSec).toBe(45)
    expect(view(s, recipe, T0).currentIndex).toBe(1)
    expect(view(s, recipe, T0 + 3_000).elapsedSec).toBe(48)
  })
  it('無い手順の番号なら何もしない', () => {
    const s = start(initial(), T0)
    expect(seek(s, recipe, 3, T0)).toBe(s)
    expect(seek(s, recipe, -1, T0)).toBe(s)
  })
  it('完成した後は何もしない（RESET で準備に戻す）', () => {
    const done: TimerState = { phase: 'done' }
    expect(seek(done, recipe, 0, T0)).toBe(done)
  })
})

describe('RESET', () => {
  it('どの状態からも準備に戻る', () => {
    expect(reset()).toEqual(initial())
    const s = reset()
    expect(view(s, recipe, T0).elapsedSec).toBe(0)
    expect(view(s, recipe, T0).currentIndex).toBeNull()
  })
  it('RESET の後に START すると 0 秒から数える', () => {
    const s = start(reset(), T0 + 500_000)
    expect(view(s, recipe, T0 + 505_000).elapsedSec).toBe(5)
  })
})

describe('手順が1つだけのレシピ', () => {
  const one: Recipe = { ...recipe, steps: [step(0, '注ぐ', 250)], totalSec: 120 }
  it('今の手順は 0、次は無い', () => {
    const v = view(start(initial(), T0), one, T0 + 60_000)
    expect(v.currentIndex).toBe(0)
    expect(v.nextIndex).toBeNull()
    expect(v.secondsToNext).toBeNull()
    expect(v.progress).toBeCloseTo(0.5)
  })
})
