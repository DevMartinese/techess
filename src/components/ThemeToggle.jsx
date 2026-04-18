export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="theme-toggle"
      onClick={() => onToggle(isDark ? 'light' : 'dark')}
    >
      <span className="theme-toggle__icon" aria-hidden>
        {isDark ? '☾' : '☀'}
      </span>
      <span className="theme-toggle__label">
        {isDark ? 'NEGRAS' : 'BLANCAS'}
      </span>
    </button>
  )
}
