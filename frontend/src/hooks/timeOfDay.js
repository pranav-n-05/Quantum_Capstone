/**
 * "System" theme = the time of day on this machine's clock.
 *
 * Light from 06:00 up to (not including) 18:00, dark otherwise. Kept free of
 * React so the pre-paint script in index.html and the tests can share the
 * exact same rule.
 */

export const DAY_START_HOUR = 6
export const DAY_END_HOUR = 18

export function timeOfDayTheme(date = new Date()) {
  const h = date.getHours()
  return h >= DAY_START_HOUR && h < DAY_END_HOUR ? 'light' : 'dark'
}

/** Milliseconds from `date` until the next 06:00 or 18:00 boundary. */
export function msUntilNextSwitch(date = new Date()) {
  const next = new Date(date)
  next.setSeconds(0, 0)
  next.setMinutes(0)
  const h = date.getHours()
  if (h < DAY_START_HOUR) next.setHours(DAY_START_HOUR)
  else if (h < DAY_END_HOUR) next.setHours(DAY_END_HOUR)
  else {
    next.setDate(next.getDate() + 1)
    next.setHours(DAY_START_HOUR)
  }
  return Math.max(1000, next.getTime() - date.getTime())
}

export const SYSTEM_THEME_HINT = `Auto by time of day — light ${DAY_START_HOUR} am–${DAY_END_HOUR - 12} pm, dark otherwise`
