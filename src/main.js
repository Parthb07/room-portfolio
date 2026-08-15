import './style.css'
import { initScene } from './scene.js'
import { initHotspots, clearActiveZone } from './hotspots.js'
import {
  initPanel,
  closePanel,
  openPanel,
  openExperiencePanel,
  openProjectsPanel,
  openEducationPanel,
  openHobbiesPanel,
} from './panel.js'
import { initToggle } from './toggle.js'
import { initZoomReset } from './zoomReset.js'
import { initNav, setActiveNavSection } from './nav.js'
import { initBuildNotice } from './buildNotice.js'
import { initGallery } from './gallery.js'
import { fetchObjects, fetchExperience, fetchProjects, fetchEducation, fetchHobbies } from './supabase.js'

const app = document.querySelector('#app')

// #stage holds everything except the panel — scene, gallery, nav, HUD — so
// it can shrink as one unit (via the "panel-open" class below) when the
// panel opens, and everything inside reflows off #stage's own real size
// rather than the full viewport. See the #stage rule in style.css.
const stage = document.createElement('div')
stage.id = 'stage'
app.append(stage)

const { scene: sceneEl, world, resetZoom } = initScene(stage)
const hotspotLayer = initHotspots(world, handleZoneClick)
const gallery = initGallery(stage, { onClose: hideGallery })
const panel = initPanel(app)
const navEl = initNav(stage, handleSectionClick)
const buildNotice = initBuildNotice(stage)

// Bottom-center HUD row: day/night toggle + reset-zoom button.
const hud = document.createElement('div')
hud.id = 'hud'
hud.className = 'absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3'
stage.append(hud)
initToggle(hud)
initZoomReset(hud, resetZoom)

// #stage's own resize (see its CSS transition) is what actually reflows
// the scene/nav/HUD — this just tells it when to animate open vs closed,
// and drops the dot's active/glow state and nav highlight once the panel
// is gone. The build notice hides too — its fixed bottom-left position
// doesn't shrink with #stage the way the HUD does, so at narrow panel
// widths the HUD's now-recentered toggle would otherwise overlap it.
panel.addEventListener('panel:open', () => {
  stage.classList.add('panel-open')
  buildNotice.classList.add('hidden')
})
panel.addEventListener('panel:close', () => {
  stage.classList.remove('panel-open')
  clearActiveZone(hotspotLayer)
  setActiveNavSection(navEl, null)
  buildNotice.classList.remove('hidden')
})

// The in-app gallery view — swapped in over the room scene (crossfade is
// pure CSS, see #scene.gallery-open / #gallery-view.visible in style.css)
// instead of a separate page. Opening it also closes the side panel, since
// the two don't make sense open together.
function showGallery() {
  closePanel()
  sceneEl.classList.add('gallery-open')
  gallery.show()
}

function hideGallery() {
  sceneEl.classList.remove('gallery-open')
  gallery.hide()
}

let objectsById = {}

fetchObjects()
  .then((data) => {
    objectsById = data
  })
  .catch((error) => {
    console.error('Failed to load objects from Supabase', error)
  })

// Fetches + opens the panel for a given nav section, and highlights the
// matching nav button — shared by nav clicks and the hotspots linked to a
// section below, so both trigger paths stay in sync. Also backs out of the
// gallery view if it's open, since clicking any nav item should always
// land back on a section panel over the room scene, per how the hotspots
// already behave (they're only clickable when the scene is visible).
const SECTION_LOADERS = {
  Education: () => fetchEducation().then(openEducationPanel),
  Experience: () => fetchExperience().then(openExperiencePanel),
  Projects: () => fetchProjects().then((entries) => openProjectsPanel(entries, showGallery)),
  Hobbies: () => fetchHobbies().then(openHobbiesPanel),
}

function openSection(label) {
  const load = SECTION_LOADERS[label]
  if (!load) return
  hideGallery()
  setActiveNavSection(navEl, label)
  load().catch((error) => console.error(`Failed to load ${label} from Supabase`, error))
}

// Hotspots that open a nav section instead of their own Supabase `objects`
// row — the room object doubles as a shortcut into that part of the CV.
const ZONE_SECTIONS = {
  degree: 'Education',
  computer: 'Projects',
  keyboard: 'Experience',
  printer: 'Hobbies',
}

function handleZoneClick(zone) {
  const section = ZONE_SECTIONS[zone.id]
  if (section) {
    openSection(section)
    return
  }

  const row = objectsById[zone.id]
  if (!row) {
    console.warn(`No Supabase row found for zone "${zone.id}"`)
    return
  }
  setActiveNavSection(navEl, null)
  openPanel(row)
}

function handleSectionClick(label) {
  openSection(label)
}
