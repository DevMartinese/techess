# CLAUDE.md

## Antes de cualquier output

Antes de proponer cambios, escribir código o responder preguntas no triviales sobre este proyecto, **consultá siempre**:

1. **`docs/knowledge/`** — knowledge base local con la documentación oficial de las librerías 3D que usa el proyecto:
   - `docs/knowledge/r3f/` — React Three Fiber (`llms.txt` índice, `llms-full.txt` completo)
   - `docs/knowledge/drei/` — `@react-three/drei` helpers
   - `docs/knowledge/three/` — three.js core
   - Empezá por el `llms.txt` correspondiente para ubicar el tema, después grepeá `llms-full.txt` por la API exacta (`useFrame`, `<Float>`, `MeshStandardMaterial`, etc.).
   - Preferí esta KB local antes que `context7` o `WebSearch` para r3f/drei/three.

2. **El codebase** — antes de tocar algo:
   - Revisá `src/App.jsx` para entender la máquina de etapas actual (`boot → intro → selecting → form → board`).
   - Mirá `src/components/StageScene.jsx`, `ChessPiece.jsx` y `RegistrationForm.jsx` para ver los patrones (un solo `<Canvas>`, lerp manual en `useFrame`, props `stage` / `centerIdx` / `selected`).
   - Mirá `src/App.css` y `src/index.css` para tokens y convenciones de estilo (fondo negro, `--glass-*`, fade-up/slide-in).

Recién después de leer la KB y los archivos relevantes, escribí la respuesta o el código.
