import './style.css'
import { initScene } from './scene.js'
import { initHotspots, clearActiveZone } from './hotspots.js'
import { initPanel, openPanel } from './panel.js'
import { initToggle } from './toggle.js'
import { initZoomReset } from './zoomReset.js'
import { initNav } from './nav.js'
import { fetchObjects } from './supabase.js'

const app = document.querySelector('#app')

// #stage holds everything except the panel — scene, nav, HUD — so it can
// shrink as one unit (via the "panel-open" class below) when the panel
// opens, and everything inside reflows off #stage's own real size rather
// than the full viewport. See the #stage rule in style.css.
const stage = document.createElement('div')
stage.id = 'stage'
app.append(stage)

const { world, resetZoom } = initScene(stage)
const hotspotLayer = initHotspots(world, handleZoneClick)
const panel = initPanel(app)
initNav(stage)

// Bottom-center HUD row: day/night toggle + reset-zoom button.
const hud = document.createElement('div')
hud.id = 'hud'
hud.className = 'absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3'
stage.append(hud)
initToggle(hud)
initZoomReset(hud, resetZoom)

// #stage's own resize (see its CSS transition) is what actually reflows
// the scene/nav/HUD — this just tells it when to animate open vs closed,
// and drops the dot's active/glow state once the panel is gone.
panel.addEventListener('panel:open', () => stage.classList.add('panel-open'))
panel.addEventListener('panel:close', () => {
  stage.classList.remove('panel-open')
  clearActiveZone(hotspotLayer)
})

let objectsById = {}

fetchObjects()
  .then((data) => {
    objectsById = data
  })
  .catch((error) => {
    console.error('Failed to load objects from Supabase', error)
  })

function handleZoneClick(zone) {
  const row = objectsById[zone.id]
  if (!row) {
    console.warn(`No Supabase row found for zone "${zone.id}"`)
    return
  }
  openPanel(row)
}
