import { PLANET_DEFS, G_SIM } from "./constants.js"
import { physicsStep, totalMechanicalEnergy, orbitalState } from "./physics.js"
import { loadJPLStates } from "./jplService.js"
import { drawScene } from "./renderer.js"
import { setupUI, setupLayout } from "./simulation.js"

const canvas = document.getElementById("simCanvas")
const ctx = canvas.getContext("2d")
let totalSimulationYears = 0

let width = 800,
  height = 520,
  dpr = 1,
  running = true,
  last = 0,
  timeScale = 1.0,
  accumulator = 0

let bodies = [],
  mult = {},
  jplStates = null,
  initialEnergy = null

export const camera = {
  zoom: 1,
  x: 0,
  y: 0,
  targetBody: null,
}

let isDragging = false
let startX = 0,
  startY = 0

let shownTarget
const targetPill = document.getElementById("targetPill")
const trackedName = document.getElementById("trackedName")

export function worldToScreen(wx, wy) {
  const cx = width / 2 + camera.x
  const cy = height / 2 + camera.y
  const baseScale = Math.min(width, height) * 0.04
  return {
    x: cx + wx * baseScale * camera.zoom,
    y: cy + wy * baseScale * camera.zoom,
  }
}

function resize() {
  const r = canvas.getBoundingClientRect()
  dpr = Math.min(devicePixelRatio || 1, 2)
  width = Math.max(320, r.width)
  height = Math.max(380, r.height)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function resetBodies() {
  let stateByName = {}

  // 1 & 3. Ambil nilai terbaru pada semua slider massa
  PLANET_DEFS.forEach((d, i) => {
    const rangeInput = document.getElementById(`mass${i}`)
    if (rangeInput) {
      mult[d.name] = Number(rangeInput.value)
    } else if (mult[d.name] === undefined) {
      mult[d.name] = 1
    }
  })

  // 1 & 2. Membaca data JPL awal atau fallback ke default
  if (jplStates) {
    // 4. Hitung nilai JPL dikombinasikan dengan pengali massa slider
    Object.entries(jplStates).forEach(([name, q]) => {
      // Kita bisa berikan penyesuaian proporsional kecepatan jika massa Matahari diubah
      const sunMult = mult["Matahari"] || 1
      const velocityScale = Math.sqrt(sunMult) // Pendekatan fisik kecepatan orbital v ~ sqrt(M)

      stateByName[name] = {
        x: q.x,
        y: q.y,
        z: q.z,
        vx: q.vx * 365.256 * (name === "Matahari" ? 1 : velocityScale),
        vy: q.vy * 365.256 * (name === "Matahari" ? 1 : velocityScale),
        vz: (q.vz || 0) * 365.256 * (name === "Matahari" ? 1 : velocityScale),
      }
    })
  } else {
    // 2 & 4. Jika tidak ada JPL, hitung menggunakan parameter default & rumus elips Kepler
    const sunDef = PLANET_DEFS[0]
    const planetStates = {}

    PLANET_DEFS.filter((d) => !d.isMoon && d.name !== "Matahari").forEach(
      (d) => {
        const mu =
          G_SIM * (1 * mult.Matahari + (d.mass / sunDef.mass) * mult[d.name])
        planetStates[d.name] = orbitalState(d.el, mu)
      },
    )

    const earthState = planetStates["Bumi"]
    const earthDef = PLANET_DEFS.find((d) => d.name === "Bumi")
    const moonDef = PLANET_DEFS.find((d) => d.isMoon)
    const moonMu =
      G_SIM *
      ((earthDef.mass / sunDef.mass) * mult.Bumi +
        (moonDef.mass / sunDef.mass) * mult.Bulan)
    const moonRel = orbitalState(moonDef.el, moonMu)

    stateByName = {
      ...planetStates,
      Matahari: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
      Bulan: {
        x: earthState.x + moonRel.x,
        y: earthState.y + moonRel.y,
        z: (earthState.z || 0) + (moonRel.z || 0),
        vx: earthState.vx + moonRel.vx,
        vy: earthState.vy + moonRel.vy,
        vz: (earthState.z || 0) + (moonRel.vz || 0),
      },
    }
  }

  // 5. Tampilkan hasil kalkulasi ke bodies simulasi
  bodies = PLANET_DEFS.map((d) => {
    const q = stateByName[d.name] || { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }
    const isOuterPlanet = [
      "Jupiter",
      "Saturnus",
      "Uranus",
      "Neptunus",
    ].includes(d.name)

    return {
      ...d,
      ...q,
      trail: [],
      maxTrail: isOuterPlanet ? 15000 : 1000,
      baseMass: d.mass / PLANET_DEFS[0].mass,
      multiplier: mult[d.name] || 1,
      drawR:
        d.name === "Matahari"
          ? 12
          : d.isMoon
            ? 2.2
            : Math.max(2.0, 4.0 - Math.log10(Math.max(d.orbit, 1)) * 0.4),
    }
  })

  initialEnergy = totalMechanicalEnergy(bodies)
}

function frame(t) {
  if (!last) last = t
  const elapsed = Math.min((t - last) / 1000, 0.05)
  last = t

  if (running) {
    const dt = elapsed * 0.02 * timeScale
    accumulator += dt
    totalSimulationYears += dt

    const FIXED_DT = 1 / 20000
    let count = 0
    while (accumulator >= FIXED_DT && count < 300) {
      physicsStep(bodies, FIXED_DT)
      accumulator -= FIXED_DT
      count++
    }
  }

  if (camera.targetBody) {
    const target = bodies.find((b) => b.name === camera.targetBody)
    if (target) {
      const baseScale = Math.min(width, height) * 0.04
      camera.x = -target.x * baseScale * camera.zoom
      camera.y = -target.y * baseScale * camera.zoom
    }
  }

  if (camera.targetBody !== shownTarget) {
    shownTarget = camera.targetBody
    if (targetPill) targetPill.hidden = !shownTarget
    if (trackedName && shownTarget) trackedName.textContent = shownTarget
    document.querySelectorAll("[data-planet]").forEach((el) => {
      el.classList.toggle("is-tracking", el.dataset.planet === shownTarget)
    })
  }

  bodies.forEach((b) => {
    b.screenPos = worldToScreen(b.x, b.y)
    if (running) {
      b.trail.push({ x: b.x, y: b.y })
      if (b.trail.length > (b.maxTrail || 500)) b.trail.shift()
    }
  })

  drawScene(ctx, width, height, bodies, totalSimulationYears)
  requestAnimationFrame(frame)
}

const zoomLabel = document.getElementById("zoomLabel")
const zoomInBtn = document.getElementById("zoomInBtn")
const zoomOutBtn = document.getElementById("zoomOutBtn")

function updateZoomUI() {
  if (zoomLabel) {
    zoomLabel.textContent = camera.zoom.toFixed(1) + "×"
  }
}

if (zoomInBtn) {
  zoomInBtn.addEventListener("click", () => {
    camera.zoom = Math.max(0.05, Math.min(camera.zoom * 1.5, 200))
    updateZoomUI()
  })
}

if (zoomOutBtn) {
  zoomOutBtn.addEventListener("click", () => {
    camera.zoom = Math.max(0.05, Math.min(camera.zoom / 1.5, 200))
    updateZoomUI()
  })
}

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault()
    const zoomFactor = 1.15
    if (e.deltaY < 0) {
      camera.zoom *= zoomFactor
    } else {
      camera.zoom /= zoomFactor
    }
    camera.zoom = Math.max(0.05, Math.min(camera.zoom, 200))
    updateZoomUI()
  },
  { passive: false },
)

const fitBtn = document.getElementById("fitBtn")
if (fitBtn) {
  fitBtn.addEventListener("click", () => {
    camera.targetBody = null
    camera.zoom = 1.0
    camera.x = 0
    camera.y = 0
    updateZoomUI()
  })
}

canvas.addEventListener("mousedown", (e) => {
  isDragging = true
  camera.targetBody = null
  startX = e.clientX - camera.x
  startY = e.clientY - camera.y
})

window.addEventListener("mousemove", (e) => {
  if (!isDragging) return
  camera.x = e.clientX - startX
  camera.y = e.clientY - startY
})

window.addEventListener("mouseup", () => {
  isDragging = false
})

const timeSpeedInput = document.getElementById("timeSpeed")
const timeSpeedOut = document.getElementById("timeSpeedOut")

if (timeSpeedInput && timeSpeedOut) {
  timeScale = Number(timeSpeedInput.value)
  timeSpeedOut.textContent = timeScale.toFixed(2).replace(/0$/, "") + "×"

  timeSpeedInput.addEventListener("input", (e) => {
    timeScale = Number(e.target.value)
    timeSpeedOut.textContent = timeScale.toFixed(2).replace(/0$/, "") + "×"
  })
}

const toggleBtn = document.getElementById("toggleBtn")
const resetBtn = document.getElementById("resetBtn")

if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    running = !running
    toggleBtn.classList.toggle("is-paused", !running)
  })
}

if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    camera.targetBody = null
    totalSimulationYears = 0
    resetBodies()
    running = true
    if (toggleBtn) toggleBtn.classList.remove("is-paused")
  })
}

setupUI(
  mult,
  () => {
    bodies.forEach((b) => (b.multiplier = mult[b.name]))
    initialEnergy = totalMechanicalEnergy(bodies)
  },
  (planetName) => {
    if (camera.targetBody === planetName) {
      camera.targetBody = null
    } else {
      camera.targetBody = planetName
    }
  },
)

const untrackBtn = document.getElementById("untrackBtn")
if (untrackBtn) {
  untrackBtn.addEventListener("click", () => {
    camera.targetBody = null
  })
}

const sunBtn = document.getElementById("sunBtn")
if (sunBtn) {
  sunBtn.addEventListener("click", () => {
    camera.targetBody = "Matahari"
  })
}

setupLayout()

window.addEventListener("resize", resize)
new ResizeObserver(() => resize()).observe(canvas.parentElement)
resize()
resetBodies()
updateZoomUI()
requestAnimationFrame(frame)

loadJPLStates()
  .then((states) => {
    jplStates = states
    document.body.dataset.jpl = "live"
    resetBodies()
  })
  .catch((err) => {
    console.warn("Gagal memuat API NASA, menggunakan fallback manual:", err)
    document.body.dataset.jpl = "fallback"
  })
