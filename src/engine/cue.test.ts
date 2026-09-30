import { describe, expect, it } from 'vitest'
import { DONE_SPEECH, detectCue } from './cue'
import type { CueMark } from './cue'
import { initial, seek, start, tick, view } from './timer'
import type { TimerState, TimerView } from './timer'
import type { Recipe, Step } from './types'

function step(startSec: number, name: string, targetG: number | null, extra: Partial<Step> = {}): Step {
  return { startSec, name, description: '', targetG, caution: false, cautionText: '', ...extra }
}

const recipe: Recipe = {
  id: 'r1',
  name: 'テスト',
  author: '',
  videoUrl: '',
  equipment: '',
  beansG: 15,
  waterG: 250,
  tempC: null,
  grind: null,
  description: '',
  totalSec: 180,
  steps: [
    step(0, '蒸らし', 50),
    step(40, '2投目', 150),
    step(80, '3投目', 250),
    step(120, 'プレスする', null, { caution: true, cautionText: 'ゆっくり押す' }),
  ],
  favorite: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

const T0 = 1_700_000_000_000

/** 画面の更新のように、時刻を進めながら合図を集める */
function run(state: TimerState, times: number[], last: CueMark = null) {
  const cues: string[] = []
  let mark = last
  let s = state
  for (const t of times) {
    s = tick(s, recipe, t)
    const cue = detectCue(mark, view(s, recipe, t), recipe)
    if (cue) {
      cues.push(`${cue.kind}:${cue.speech}`)
      mark = cue.mark
    }
  }
  return { cues, mark }
}

describe('detectCue（手順の切り替わりの合図）', () => {
  it('START 直後に、0 秒の手順の合図が出る', () => {
    const v = view(start(initial(), T0), recipe, T0)
    expect(detectCue(null, v, recipe)).toEqual({ kind: 'step', speech: '蒸らし。50グラムまで注いでください', mark: 0 })
  })

  it('準備中は合図を出さない', () => {
    expect(detectCue(null, view(initial(), recipe, T0), recipe)).toBeNull()
  })

  it('同じ手順の中で何度呼んでも合図は1回だけ', () => {
    const s = start(initial(), T0)
    const { cues } = run(s, [T0, T0 + 250, T0 + 500, T0 + 10_000, T0 + 39_999])
    expect(cues).toEqual(['step:蒸らし。50グラムまで注いでください'])
  })

  it('手順が切り替わるたびに1回ずつ合図が出る', () => {
    const s = start(initial(), T0)
    const times = [T0, T0 + 20_000, T0 + 40_000, T0 + 40_250, T0 + 80_100, T0 + 100_000]
    expect(run(s, times).cues).toEqual([
      'step:蒸らし。50グラムまで注いでください',
      'step:2投目。150グラムまで注いでください',
      'step:3投目。250グラムまで注いでください',
    ])
  })

  it('注意の手順は caution で、注意の文も読む', () => {
    const v = view(start(initial(), T0), recipe, T0 + 120_000)
    expect(detectCue(2, v, recipe)).toEqual({ kind: 'caution', speech: 'プレスする。ゆっくり押す', mark: 3 })
  })

  it('完成は done で、読み上げは「抽出完了です」', () => {
    expect(DONE_SPEECH).toBe('抽出完了です')
    const s = tick(start(initial(), T0), recipe, T0 + 180_000)
    const v = view(s, recipe, T0 + 180_000)
    expect(detectCue(3, v, recipe)).toEqual({ kind: 'done', speech: '抽出完了です', mark: 'done' })
  })

  it('完成の合図も1回だけ', () => {
    const s = start(initial(), T0)
    const { cues } = run(s, [T0 + 179_000, T0 + 180_000, T0 + 181_000, T0 + 200_000], 3)
    expect(cues).toEqual(['done:抽出完了です'])
  })

  it('手順を2つ以上飛び越えたとき（別のアプリから戻ったなど）は、今の手順の合図だけ出る', () => {
    const s = start(initial(), T0)
    const { cues } = run(s, [T0, T0 + 125_000])
    expect(cues).toEqual(['step:蒸らし。50グラムまで注いでください', 'caution:プレスする。ゆっくり押す'])
  })

  it('途中の手順を飛ばして完成まで行ったときは、完成の合図だけ出る', () => {
    const s = start(initial(), T0)
    const { cues } = run(s, [T0, T0 + 500_000])
    expect(cues).toEqual(['step:蒸らし。50グラムまで注いでください', 'done:抽出完了です'])
  })

  it('手順へ飛んだときは、飛んだ先の手順の合図を出す', () => {
    let s = start(initial(), T0)
    const first = run(s, [T0])
    s = seek(s, recipe, 2, T0 + 5_000)
    const { cues } = run(s, [T0 + 5_000, T0 + 6_000], first.mark)
    expect(cues).toEqual(['step:3投目。250グラムまで注いでください'])
  })

  it('準備中に手順をタップして始めたときも、その手順の合図を出す', () => {
    const s = seek(initial(), recipe, 1, T0)
    expect(run(s, [T0]).cues).toEqual(['step:2投目。150グラムまで注いでください'])
  })

  it('豆の量を変えたレシピを渡せば、その目標量で読み上げる', () => {
    const scaled: Recipe = { ...recipe, steps: recipe.steps.map((st, i) => (i === 0 ? { ...st, targetG: 67 } : st)) }
    const v: TimerView = view(start(initial(), T0), scaled, T0)
    expect(detectCue(null, v, scaled)?.speech).toBe('蒸らし。67グラムまで注いでください')
  })
})
