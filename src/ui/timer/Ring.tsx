// 進み具合を示す輪（手順の切り替わりの目印つき）と、まん中の経過時間
import { formatTime } from '../../engine/time'

export interface RingProps {
  /** 0〜1 */
  progress: number
  /** 手順の切り替わりの位置（0〜1）。0 は描かない */
  marks: number[]
  elapsedSec: number
  label: string
}

const R = 88
const C = 2 * Math.PI * R

export function Ring({ progress, marks, elapsedSec, label }: RingProps) {
  const p = Math.min(1, Math.max(0, progress))
  return (
    <div className="ring">
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r={R} className="ring-track" />
        {p > 0 && (
          <circle
            cx="100"
            cy="100"
            r={R}
            className="ring-bar"
            strokeDasharray={`${C * p} ${C}`}
            transform="rotate(-90 100 100)"
          />
        )}
        {marks
          .filter((m) => m > 0 && m < 1)
          .map((m) => {
            const a = 2 * Math.PI * m - Math.PI / 2
            const x1 = 100 + (R - 11) * Math.cos(a)
            const y1 = 100 + (R - 11) * Math.sin(a)
            const x2 = 100 + (R + 11) * Math.cos(a)
            const y2 = 100 + (R + 11) * Math.sin(a)
            return <line key={m} x1={x1} y1={y1} x2={x2} y2={y2} className={`ring-mark${m <= p ? ' passed' : ''}`} />
          })}
      </svg>
      <div className="ring-center">
        <span className="ring-label">{label}</span>
        <span className="ring-time" aria-label={`経過時間 ${formatTime(elapsedSec)}`}>
          {formatTime(elapsedSec)}
        </span>
      </div>
    </div>
  )
}
