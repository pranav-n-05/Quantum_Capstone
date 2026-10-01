import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { msUntilNextSwitch, timeOfDayTheme } from './timeOfDay'

/**
 * Three-state colour theme: `light`, `dark`, or `system`.
 *
 * `system` follows the local time of day (see ./timeOfDay.js): light by day,
 * dark at night. It is a *live* subscription, not a one-off read -- a timer
 * fires at the next 06:00 / 18:00 boundary, and returning to the tab re-checks
 * in case the laptop slept through one. It is also the only state that stores
 * nothing: absence of a stored value *is* "system", which keeps this in
 * agreement with the pre-paint script in index.html.
 */

export const THEME_STORAGE_KEY = 'qtd-theme'

const ThemeContext = createContext(null)

/** localStorage throws in some privacy modes; a themeless dashboard beats none. */
function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}


export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme)
  const [systemTheme, setSystemTheme] = useState(() => timeOfDayTheme())

  // Track the clock at all times, not just while in `system` mode, so
  // switching back to `system` is instant and correct.
  useEffect(() => {
    let timer
    const sync = () => {
      setSystemTheme(timeOfDayTheme())
      window.clearTimeout(timer)
      timer = window.setTimeout(sync, msUntilNextSwitch())
    }
    sync()
    const onVisible = () => document.visibilityState === 'visible' && sync()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', sync)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', sync)
    }
  }, [])

  const resolvedTheme = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', resolvedTheme === 'light')
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const setTheme = useCallback((next) => {
    const root = document.documentElement
    root.classList.add('theme-switching')
    window.setTimeout(() => root.classList.remove('theme-switching'), 260)

    setThemeState(next)
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
      else localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* Preference simply will not survive a reload. */
    }
  }, [])

  // A dashboard tends to live in several tabs at once; keep them agreeing.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) setThemeState(readStoredTheme())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(
    () => ({ theme, resolvedTheme, systemTheme, setTheme }),
    [theme, resolvedTheme, systemTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within a <ThemeProvider>')
  return context
}
