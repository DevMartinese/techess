import { useState } from 'react'
import Scene from './components/Scene'
import ShaderScene from './components/ShaderScene'
import RegistrationForm from './components/RegistrationForm'
import ThemeToggle from './components/ThemeToggle'
import usePieceControls from './hooks/usePieceControls'
import './App.css'

function App() {
  const [theme, setTheme] = useState('light')
  const { variant, effect, layout, scattered } = usePieceControls({
    variant: 'bishop',
    effect: 'none',
    layout: 'single',
  })
  const inkColor = theme === 'dark' ? [1, 1, 1] : [0, 0, 0]
  return (
    <div className="page" data-theme={theme}>
      <ThemeToggle theme={theme} onToggle={setTheme} />
      <div className="page__scene">
        {effect === 'none' ? (
          <Scene
            variant={variant}
            layout={layout}
            scatteredConfig={scattered}
          />
        ) : (
          <ShaderScene
            variant={variant}
            layout={layout}
            effect={effect}
            inkColor={inkColor}
            scatteredConfig={scattered}
          />
        )}
      </div>
      <div className="page__form-col">
        <RegistrationForm />
      </div>
    </div>
  )
}

export default App
