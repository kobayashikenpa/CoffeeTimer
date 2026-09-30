// 使う AI のモデル（仕様 6.2）
// 動画を読める Gemini のうち、速くて無料枠のあるもの（暫定）。差し替えはここだけで済む
export const GEMINI_MODEL = 'gemini-2.5-flash'

/** Gemini API の住所（キーは URL に入れず、ヘッダー x-goog-api-key で渡す） */
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
