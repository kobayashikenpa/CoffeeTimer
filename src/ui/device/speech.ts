// 読み上げ（端末の日本語の読み上げ機能 speechSynthesis）（仕様 8.3・8.5）
// iPhone では、利用者がボタンを押した操作の中で一度話させて（prepareSpeech）おくと、その後も読み上げられる

function synth(): SpeechSynthesis | null {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  } catch {
    return null
  }
}

function japaneseVoice(s: SpeechSynthesis): SpeechSynthesisVoice | null {
  try {
    return s.getVoices().find((v) => v.lang.replace('_', '-').toLowerCase().startsWith('ja')) ?? null
  } catch {
    return null
  }
}

function utter(text: string, volume = 1): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.volume = volume
  u.rate = 1
  const s = synth()
  const voice = s && japaneseVoice(s)
  if (voice) u.voice = voice
  return u
}

/** ボタンを押した操作の中で呼ぶ。読み上げを使える状態にする（音量 0 で短く話す） */
export function prepareSpeech(): void {
  const s = synth()
  if (!s) return
  try {
    s.getVoices()
    if (!s.speaking) s.speak(utter(' ', 0))
  } catch {
    // 読み上げが使えない端末では何もしない
  }
}

/** 読み上げる（読み上げ中のものは止めて、新しいほうを読む） */
export function speak(text: string): void {
  const s = synth()
  if (!s || text.trim() === '') return
  try {
    s.cancel()
    s.speak(utter(text))
  } catch {
    // 読み上げが使えない端末では何もしない
  }
}

/** 読み上げを止める */
export function stopSpeech(): void {
  try {
    synth()?.cancel()
  } catch {
    // 何もしない
  }
}
