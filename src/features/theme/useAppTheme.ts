import { useEffect, useMemo, useState } from 'react'

export type AppThemeId =
  | 'system'
  | 'light'
  | 'dark'
  | 'midnight'
  | 'forest'
  | 'solarized'

export const APP_THEMES: Array<{ id: AppThemeId; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'forest', label: 'Forest' },
  { id: 'solarized', label: 'Solarized' },
]

const STORAGE_KEY = 'autohtml.theme'

export function useAppTheme() {
  const [themeId, setThemeId] = useState<AppThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && APP_THEMES.some((t) => t.id === stored)) return stored as AppThemeId
    return 'system'
  })

  const prefersDark = usePrefersDark()

  const effective = useMemo(() => {
    if (themeId === 'system') return prefersDark ? 'dark' : 'light'
    if (themeId === 'midnight' || themeId === 'forest') return 'dark'
    if (themeId === 'solarized') return 'light'
    return themeId
  }, [prefersDark, themeId])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, themeId)
  }, [themeId])

  useEffect(() => {
    applyTheme({ themeId, prefersDark })
  }, [themeId, prefersDark])

  return { themeId, setThemeId, effective }
}

function usePrefersDark() {
  const [prefersDark, setPrefersDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return prefersDark
}

function applyTheme(input: { themeId: AppThemeId; prefersDark: boolean }) {
  const root = document.documentElement

  const bsTheme = resolveBootstrapTheme(input.themeId, input.prefersDark)
  root.setAttribute('data-bs-theme', bsTheme)

  const tokens = resolveTokens(input.themeId, input.prefersDark)
  for (const [k, v] of Object.entries(tokens)) {
    root.style.setProperty(k, v)
  }
}

function resolveBootstrapTheme(themeId: AppThemeId, prefersDark: boolean): 'light' | 'dark' {
  if (themeId === 'system') return prefersDark ? 'dark' : 'light'
  if (themeId === 'light' || themeId === 'solarized') return 'light'
  return 'dark'
}

function resolveTokens(themeId: AppThemeId, prefersDark: boolean): Record<string, string> {
  const lightBase = {
    '--app-bg': '#f4f6f8',
    '--app-surface': 'rgba(255, 255, 255, 0.85)',
    '--app-border': 'rgba(0, 0, 0, 0.12)',
    '--app-text': 'rgba(0, 0, 0, 0.88)',
    '--app-muted': 'rgba(0, 0, 0, 0.62)',
    '--app-accent': '#0d6efd',
  }

  const darkBase = {
    '--app-bg': '#0b0f14',
    '--app-surface': 'rgba(255, 255, 255, 0.06)',
    '--app-border': 'rgba(255, 255, 255, 0.12)',
    '--app-text': 'rgba(255, 255, 255, 0.92)',
    '--app-muted': 'rgba(255, 255, 255, 0.65)',
    '--app-accent': '#6ea8fe',
  }

  const effectiveId = themeId === 'system' ? (prefersDark ? 'dark' : 'light') : themeId

  if (effectiveId === 'light') return lightBase
  if (effectiveId === 'dark') return darkBase

  if (effectiveId === 'midnight') {
    return {
      ...darkBase,
      '--app-bg': '#060814',
      '--app-surface': 'rgba(120, 140, 255, 0.08)',
      '--app-accent': '#9db3ff',
    }
  }

  if (effectiveId === 'forest') {
    return {
      ...darkBase,
      '--app-bg': '#07110b',
      '--app-surface': 'rgba(46, 204, 113, 0.08)',
      '--app-accent': '#2ecc71',
    }
  }

  if (effectiveId === 'solarized') {
    return {
      ...lightBase,
      '--app-bg': '#fdf6e3',
      '--app-surface': 'rgba(238, 232, 213, 0.7)',
      '--app-text': '#073642',
      '--app-muted': 'rgba(7, 54, 66, 0.7)',
      '--app-accent': '#268bd2',
    }
  }

  return prefersDark ? darkBase : lightBase
}
