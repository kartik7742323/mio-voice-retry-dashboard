import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => sessionStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  function toggle() {
    setDark(v => {
      const next = !v
      sessionStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
