/**
 * The smallest complex-number kit that the engine needs.
 *
 * Numbers are plain `{ re, im }` objects. They are never mutated, so a value
 * can be shared between a gate matrix and the UI without defensive copies.
 */

export const c = (re, im = 0) => ({ re, im })

export const ZERO = c(0)
export const ONE = c(1)
export const I = c(0, 1)

export const add = (a, b) => c(a.re + b.re, a.im + b.im)
export const sub = (a, b) => c(a.re - b.re, a.im - b.im)
export const mul = (a, b) => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re)
export const scale = (a, k) => c(a.re * k, a.im * k)
export const conj = (a) => c(a.re, -a.im)
export const abs2 = (a) => a.re * a.re + a.im * a.im
export const abs = (a) => Math.sqrt(abs2(a))
export const arg = (a) => Math.atan2(a.im, a.re)

/** e^{iθ} */
export const expi = (theta) => c(Math.cos(theta), Math.sin(theta))

/** Principal square root. */
export function sqrt(a) {
  const r = Math.sqrt(abs(a))
  const half = arg(a) / 2
  return c(r * Math.cos(half), r * Math.sin(half))
}

export const div = (a, b) => {
  const d = abs2(b)
  return c((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d)
}

/** Human formatting: `0.707`, `−0.5i`, `0.354 + 0.354i`. Tiny parts are dropped. */
export function format(a, digits = 3) {
  const eps = 10 ** -digits / 2
  const re = Math.abs(a.re) < eps ? 0 : a.re
  const im = Math.abs(a.im) < eps ? 0 : a.im
  const num = (x) => x.toFixed(digits).replace(/\.?0+$/, '').replace('-', '−')
  if (im === 0) return num(re)
  if (re === 0) return `${num(im)}i`
  return `${num(re)} ${im < 0 ? '−' : '+'} ${num(Math.abs(im))}i`
}
