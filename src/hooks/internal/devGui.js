// Dev-only lil-gui singleton. Each dev hook creates a folder inside one shared
// panel instead of spawning a new stacked GUI, so all controls render together
// in a single prolijo widget in the top-right corner.

let guiPromise = null
let guiInstance = null

async function getDevGui() {
  if (!guiPromise) {
    guiPromise = import('lil-gui').then(({ default: GUI }) => {
      guiInstance = new GUI({ title: 'Dev', width: 280 })
      return guiInstance
    })
  }
  return guiPromise
}

/**
 * Creates a folder in the shared dev GUI. The folder is opened by default and
 * returned to the caller so it can add controllers. Caller must call
 * `folder.destroy()` on cleanup.
 */
export async function addDevFolder(name) {
  const gui = await getDevGui()
  const folder = gui.addFolder(name)
  folder.open()
  return folder
}

// Vite HMR: drop the singleton when this module is replaced so a fresh import
// rebuilds the GUI instead of leaving the old panel orphaned in the DOM.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    guiInstance?.destroy()
    guiInstance = null
    guiPromise = null
  })
}
