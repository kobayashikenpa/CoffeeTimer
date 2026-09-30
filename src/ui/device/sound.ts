// タイマーの音（Web Audio で作る。音声ファイルは使わない）（仕様 8.3・8.5）
// iPhone では、利用者がボタンを押した操作の中で音の準備（prepareSound）をしないと鳴らない

export type SoundKind = 'step' | 'caution' | 'done'

/** 普通の手順：高めの短い音。注意の手順：低めの長めの音。完成：普通の音を3回 */
export const TONES = {
  step: { freq: 880, sec: 0.15 },
  caution: { freq: 440, sec: 0.3 },
  /** 完成の音の間隔（秒） */
  doneGapSec: 0.25,
  doneCount: 3,
} as const

let ctx: AudioContext | null = null

function createContext(): AudioContext | null {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) return null
  try {
    return new Ctor()
  } catch {
    return null
  }
}

/** ボタンを押した操作の中で呼ぶ。音を鳴らせる状態にする（無音を一瞬鳴らす） */
export function prepareSound(): void {
  try {
    ctx ??= createContext()
    if (!ctx) return
    if (ctx.state !== 'running') void ctx.resume().catch(() => {})
    const buffer = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.start(0)
  } catch {
    // 音が使えない端末では何もしない
  }
}

function beep(c: AudioContext, freq: number, sec: number, at: number): void {
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  // 立ち上がり・立ち下がりをなめらかにして「プツッ」という音を防ぐ
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.5, at + 0.01)
  gain.gain.setValueAtTime(0.5, at + sec - 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + sec)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(at)
  osc.stop(at + sec + 0.02)
}

/** 合図の音を鳴らす */
export function playSound(kind: SoundKind): void {
  try {
    ctx ??= createContext()
    const c = ctx
    if (!c) return
    if (c.state !== 'running') void c.resume().catch(() => {})
    const t = c.currentTime + 0.02
    if (kind === 'caution') {
      beep(c, TONES.caution.freq, TONES.caution.sec, t)
    } else if (kind === 'step') {
      beep(c, TONES.step.freq, TONES.step.sec, t)
    } else {
      for (let i = 0; i < TONES.doneCount; i++) beep(c, TONES.step.freq, TONES.step.sec, t + i * TONES.doneGapSec)
    }
  } catch {
    // 音が使えない端末では何もしない
  }
}
