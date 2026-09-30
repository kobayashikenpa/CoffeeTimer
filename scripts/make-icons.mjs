// アプリのアイコン（SVG と PNG）を作る。Node の標準機能（zlib）だけを使い、依存パッケージは増やさない
// 使い方：node scripts/make-icons.mjs （public/icons/ に書き出す）
// 絵柄は仮のもの：焦げ茶の地に、アンバーのタイマーの輪と針
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

// 512 マスの座標で形を決める
const BG = [0x1c, 0x13, 0x0d] // 焦げ茶
const AMBER = [0xe0, 0xa2, 0x4a] // アンバー
const CX = 256
const CY = 256
const RING_OUT = 176 // 輪の外側の半径
const RING_IN = 142 // 輪の内側の半径
const HAND_W = 26 // 針の太さ
const HAND_LEN = 112 // 針の長さ（中心から上へ）
const DOT_R = 26 // 中心の丸

function isAmber(x, y) {
  const d = Math.hypot(x - CX, y - CY)
  if (d >= RING_IN && d < RING_OUT) return true
  if (d < DOT_R) return true
  return Math.abs(x - CX) < HAND_W / 2 && y <= CY && y > CY - HAND_LEN
}

// 1ピクセルを 4×4 に分けて色を混ぜ、輪の縁をなめらかにする
const SS = 4
function colorAt(px, py, size) {
  let hit = 0
  for (let sy = 0; sy < SS; sy++) {
    for (let sx = 0; sx < SS; sx++) {
      const x = ((px + (sx + 0.5) / SS) * 512) / size
      const y = ((py + (sy + 0.5) / SS) * 512) / size
      if (isAmber(x, y)) hit++
    }
  }
  const t = hit / (SS * SS)
  return BG.map((b, i) => Math.round(b + (AMBER[i] - b) * t))
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  let o = 0
  for (let py = 0; py < size; py++) {
    raw[o++] = 0 // フィルタなし
    for (let px = 0; px < size; px++) {
      const [r, g, b] = colorAt(px, py, size)
      raw[o++] = r
      raw[o++] = g
      raw[o++] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // 8bit
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
const ringR = (RING_OUT + RING_IN) / 2
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${hex(BG)}"/>
  <circle cx="${CX}" cy="${CY}" r="${ringR}" fill="none" stroke="${hex(AMBER)}" stroke-width="${RING_OUT - RING_IN}"/>
  <rect x="${CX - HAND_W / 2}" y="${CY - HAND_LEN}" width="${HAND_W}" height="${HAND_LEN}" fill="${hex(AMBER)}"/>
  <circle cx="${CX}" cy="${CY}" r="${DOT_R}" fill="${hex(AMBER)}"/>
</svg>
`

const out = new URL('../public/icons/', import.meta.url)
mkdirSync(out, { recursive: true })
writeFileSync(new URL('icon.svg', out), svg)
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(new URL(name, out), png(size))
}
console.log('public/icons/ にアイコンを書き出しました')
