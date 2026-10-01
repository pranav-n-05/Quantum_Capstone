import { describe, expect, it } from 'vitest'

import { msUntilNextSwitch, timeOfDayTheme } from './timeOfDay'

const at = (h, m = 0) => new Date(2026, 9, 1, h, m, 0, 0)

describe('system theme by time of day', () => {
  it('is light in the morning and afternoon', () => {
    expect(timeOfDayTheme(at(9))).toBe('light')
    expect(timeOfDayTheme(at(6))).toBe('light')
    expect(timeOfDayTheme(at(17, 59))).toBe('light')
  })

  it('is dark in the evening and at night', () => {
    expect(timeOfDayTheme(at(18))).toBe('dark')
    expect(timeOfDayTheme(at(23, 30))).toBe('dark')
    expect(timeOfDayTheme(at(0))).toBe('dark')
    expect(timeOfDayTheme(at(5, 59))).toBe('dark')
  })

  it('schedules the next check at the next boundary', () => {
    expect(msUntilNextSwitch(at(9))).toBe(9 * 3600e3)
    expect(msUntilNextSwitch(at(17, 30))).toBe(30 * 60e3)
    expect(msUntilNextSwitch(at(20))).toBe(10 * 3600e3)
    expect(msUntilNextSwitch(at(3))).toBe(3 * 3600e3)
  })
})
