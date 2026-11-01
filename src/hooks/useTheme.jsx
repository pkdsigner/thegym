import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ theme: 'dark', toggle: () => {} })
const STORAGE_KEY = 'pulsefit-theme'

function readInitialTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'dark'
  } catch {
    return 'dark'
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#07090C' : '#F3F5EF')
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* storage unavailable — theme still works for this session */
    }
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)

// Chart colors can't read CSS variables (SVG attributes), so resolve them in JS.
export function useChartColors() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  return {
    lime: dark ? '#C6FF3D' : '#6BB300',
    cyan: dark ? '#22E4F2' : '#0A9FB5',
    ember: '#FF7A3D',
    violet: '#9B7BFF',
    grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,16,20,0.07)',
    tick: dark ? '#8C96A0' : '#5C6670',
    tooltipBg: dark ? 'rgba(17,21,27,0.92)' : 'rgba(255,255,255,0.96)',
    tooltipBorder: dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,16,20,0.08)',
    ink: dark ? '#F0F4EC' : '#0C1014',
  }
}
