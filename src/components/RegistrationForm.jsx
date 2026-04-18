import { useState } from 'react'

const INITIAL = {
  nombre: '',
  apellido: '',
  email: '',
  elo: '',
  categoria: '',
  federacion: '',
}

const CATEGORIAS = ['Abierto', 'Sub-2000', 'Sub-1800', 'Sub-1600', 'Femenino']

export default function RegistrationForm({ onSubmitted }) {
  const [form, setForm] = useState(INITIAL)
  const update = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = (e) => {
    e.preventDefault()
    console.log('registration payload:', form)
    onSubmitted?.(form)
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <span className="form__eyebrow">TORNEO 2026</span>
      <h1 className="form__title">Registro de Torneo</h1>
      <p className="form__lede">
        Completa el formulario para inscribirte en el torneo. Las plazas son
        limitadas.
      </p>

      <div className="form__row form__row--two">
        <label>
          Nombre
          <input
            required
            placeholder="Magnus"
            value={form.nombre}
            onChange={update('nombre')}
          />
        </label>
        <label>
          Apellido
          <input
            required
            placeholder="Carlsen"
            value={form.apellido}
            onChange={update('apellido')}
          />
        </label>
      </div>

      <label>
        Email
        <input
          required
          type="email"
          placeholder="magnus@chess.com"
          value={form.email}
          onChange={update('email')}
        />
      </label>

      <label>
        Rating ELO
        <input
          required
          type="number"
          min="0"
          max="3500"
          placeholder="2800"
          value={form.elo}
          onChange={update('elo')}
        />
      </label>

      <label>
        Categoría
        <select required value={form.categoria} onChange={update('categoria')}>
          <option value="" disabled>
            Selecciona categoría
          </option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label>
        Federación
        <input
          required
          placeholder="FIDE"
          value={form.federacion}
          onChange={update('federacion')}
        />
      </label>

      <button type="submit" className="form__submit">
        REGISTRARSE
      </button>
    </form>
  )
}
