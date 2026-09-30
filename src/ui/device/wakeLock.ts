// 画面を暗くしない（Screen Wake Lock）（仕様 8.4）
import { useEffect, useState } from 'react'

function wakeLockApi(): WakeLock | null {
  try {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator ? navigator.wakeLock : null
  } catch {
    return null
  }
}

/**
 * active の間、画面が自動で暗くなったり消えたりしないようにする。
 * 別のアプリから戻ったときは取り直し、active でなくなったとき・画面を離れたときは放す。
 * 使えない端末・断られたときは unavailable が true（エラーで止めない）
 */
export function useWakeLock(active: boolean): { unavailable: boolean } {
  const [supported] = useState(() => wakeLockApi() !== null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const api = wakeLockApi()
    if (!active || !api) return
    let sentinel: WakeLockSentinel | null = null
    let disposed = false

    const acquire = () => {
      if (disposed || document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return
      api
        .request('screen')
        .then((s) => {
          if (disposed) {
            void s.release().catch(() => {})
            return
          }
          sentinel = s
          setFailed(false)
        })
        .catch(() => {
          if (!disposed) setFailed(true)
        })
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisible)
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {})
    }
  }, [active])

  return { unavailable: !supported || failed }
}
