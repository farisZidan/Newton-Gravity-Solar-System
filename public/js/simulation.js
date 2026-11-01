import { PLANET_DEFS } from "./constants.js"

const ICON_RESET = '<svg class="ic ic-xs"><use href="#i-rotate-ccw"/></svg>'
const fmtMult = (v) => v.toFixed(2).replace(/0$/, "") + "×"

export function setupUI(mult, onMassChange, onTrackClick) {
  const controls = document.getElementById("massControls")
  const legend = document.getElementById("legend")

  if (!controls) return
  controls.innerHTML = ""

  // Reset all mass button
  const resetAllMass = document.getElementById("resetAllMass")
  resetAllMass.addEventListener("click", () => {
    PLANET_DEFS.forEach((d, i) => {
      const rangeInput = document.getElementById(`mass${i}`)
      const readout = document.getElementById(`massOut${i}`)
      if (rangeInput) {
        rangeInput.value = 1
        readout.textContent = "1.0×"
        mult[d.name] = 1
      }
    })
    onMassChange()
  })

  // Search Filter
  const searchInput = document.getElementById("planetFilter")
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const val = e.target.value.toLowerCase()
      document.querySelectorAll(".planet-row").forEach((row) => {
        row.hidden = !row.dataset.name.includes(val)
      })
    })
  }

  // Planet Mass Controls
  PLANET_DEFS.forEach((d, i) => {
    mult[d.name] = 1
    const div = document.createElement("div")
    div.className = "planet-row"
    div.dataset.name = d.name.toLowerCase()
    div.innerHTML = `
      <div class="planet-row-head">
        <div class="planet-id">
          <span class="planet-swatch" style="--c:${d.color}"></span>
          <span class="planet-name">${d.name}</span>
          ${d.isMoon ? '<span class="planet-tag">Satelit</span>' : ""}
        </div>
        <div class="planet-actions">
          <button class="track-btn" type="button" data-planet="${d.name}" title="Kunci kamera ke ${d.name}">Track</button>
          <button id="resetMassBtn${i}" class="reset-single-btn" type="button" title="Reset massa ke 1.0x" aria-label="Reset massa ${d.name}">${ICON_RESET}</button>
        </div>
      </div>
      <div class="mass-slider-row">
        <input id="mass${i}" type="range" min="0.01" max="50" step="0.01" value="1" aria-label="Pengali massa ${d.name}">
        <div class="mass-readout" id="massOut${i}">1.0×</div>
      </div>
    `
    controls.appendChild(div)

    const rangeInput = div.querySelector(`#mass${i}`)
    const readout = div.querySelector(`#massOut${i}`)
    const resetBtn = div.querySelector(`#resetMassBtn${i}`)
    const trackBtn = div.querySelector(".track-btn")

    trackBtn.addEventListener("click", () => {
      if (onTrackClick) onTrackClick(d.name)
    })

    rangeInput.addEventListener("input", (e) => {
      const val = Number(e.target.value)
      mult[d.name] = val
      readout.textContent = fmtMult(val)
      onMassChange()
    })

    resetBtn.addEventListener("click", () => {
      rangeInput.value = 1
      readout.textContent = "1.0×"
      mult[d.name] = 1
      onMassChange()
    })

    if (legend) {
      const l = document.createElement("button")
      l.type = "button"
      l.className = "legend-item"
      l.dataset.planet = d.name
      l.title = `Kunci kamera ke ${d.name}`
      l.innerHTML = `<span class="legend-dot" style="--c:${d.color}"></span>${d.name}`
      l.addEventListener("click", () => {
        if (onTrackClick) onTrackClick(d.name)
      })
      legend.appendChild(l)
    }
  })
}

export function setupLayout() {
  const dock = document.getElementById("inspectorDock")
  const toggle = document.getElementById("dockToggle")
  const sheetClose = document.getElementById("sheetClose")
  const toolbar = document.getElementById("massToolbar")
  const tabs = document.querySelectorAll(".dock-tab")

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.toggle("is-active", t === tab)
        t.setAttribute("aria-selected", String(t === tab))
      })
      document.querySelectorAll(".tab-panel").forEach((panel) => {
        panel.hidden = panel.id !== `tab-${tab.dataset.tab}`
      })
      if (toolbar) toolbar.hidden = tab.dataset.tab !== "mass"
    })
  })

  if (!dock || !toggle) return

  const setOpen = (open) => {
    dock.classList.toggle("is-closed", !open)
    toggle.classList.toggle("is-closed", !open)
    toggle.setAttribute("aria-expanded", String(open))
  }

  setOpen(!window.matchMedia("(max-width: 767px)").matches)

  toggle.addEventListener("click", () => {
    setOpen(dock.classList.contains("is-closed"))
  })
  if (sheetClose) sheetClose.addEventListener("click", () => setOpen(false))
}
