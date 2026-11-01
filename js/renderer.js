import { worldToScreen, camera } from "./main.js"
import { G_PHYS } from "./constants.js"

const startDate = new Date(2026, 10, 1)

const GLOW = {
  Matahari: "#fb8500",
  Merkurius: "#cbd5e1",
  Venus: "#fef08a",
  Bumi: "#0ea5e9",
  Bulan: "#94a3b8",
  Mars: "#f87171",
  Jupiter: "#f59e0b",
  Saturnus: "#fbbf24",
  Uranus: "#22d3ee",
  Neptunus: "#60a5fa",
}

const stars = Array.from({ length: 160 }, () => ({
  x: Math.random(),
  y: Math.random(),
  size: Math.random() * 1.5 + 0.3,
  brightness: Math.random() * 0.7 + 0.3,
}))

let lastDateString = ""

export function drawScene(ctx, width, height, bodies, simulationTimeYears) {
  ctx.clearRect(0, 0, width, height)

  stars.forEach((st) => {
    ctx.fillStyle = `rgba(255, 255, 255, ${st.brightness * 0.6})`
    ctx.beginPath()
    ctx.arc(st.x * width, st.y * height, st.size, 0, Math.PI * 2)
    ctx.fill()
  })

  bodies.forEach((b) => {
    if (b.trail.length > 1) {
      ctx.beginPath()
      const firstScreen = worldToScreen(b.trail[0].x, b.trail[0].y)
      ctx.moveTo(firstScreen.x, firstScreen.y)

      for (let i = 1; i < b.trail.length; i++) {
        const sc = worldToScreen(b.trail[i].x, b.trail[i].y)
        ctx.lineTo(sc.x, sc.y)
      }
      ctx.strokeStyle = b.color + "99"
      ctx.lineWidth = Math.max(0.6, 1.0 * Math.sqrt(camera.zoom * 0.3))
      ctx.stroke()
    }
  })

  bodies.forEach((b) => {
    const p = b.screenPos
    if (p.x < -150 || p.x > width + 150 || p.y < -150 || p.y > height + 150)
      return

    let scaledRadius
    if (b.name === "Matahari") {
      scaledRadius = Math.max(4, Math.min(12, 7 * Math.pow(camera.zoom, 0.3)))
    } else if (b.isMoon) {
      scaledRadius = Math.max(
        1.5,
        Math.min(6, 2.2 * Math.pow(camera.zoom, 0.35)),
      )
    } else {
      scaledRadius = Math.max(
        2,
        Math.min(10, b.drawR * Math.pow(camera.zoom, 0.35)),
      )
    }

    const glowRadius = scaledRadius * (b.name === "Matahari" ? 2.8 : 1.6)
    const glow = ctx.createRadialGradient(
      p.x,
      p.y,
      scaledRadius * 0.4,
      p.x,
      p.y,
      glowRadius,
    )
    glow.addColorStop(0, GLOW[b.name] || b.color)
    glow.addColorStop(1, "transparent")
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2)
    ctx.fill()

    if (b.name === "Saturnus") {
      ctx.beginPath()
      ctx.ellipse(
        p.x,
        p.y,
        scaledRadius * 2.2,
        scaledRadius * 0.8,
        -0.3,
        0,
        Math.PI * 2,
      )
      ctx.strokeStyle = "rgba(252, 211, 77, 0.4)"
      ctx.lineWidth = 3
      ctx.stroke()
    }

    ctx.fillStyle = b.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, scaledRadius, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    ctx.font = "10px 'Space Grotesk', sans-serif"
    ctx.textAlign = "center"
    ctx.fillStyle = "rgba(226, 232, 240, 0.75)"
    ctx.fillText(b.name, p.x, p.y - scaledRadius - 4)
    ctx.restore()
  })

  const currentMillis =
    startDate.getTime() +
    (simulationTimeYears || 0) * 365.25 * 24 * 60 * 60 * 1000
  const currentDate = new Date(currentMillis)
  const options = { year: "numeric", month: "long", day: "numeric" }
  const dateString = currentDate.toLocaleDateString("id-ID", options)

  if (dateString !== lastDateString) {
    lastDateString = dateString
    document.querySelectorAll("[data-sim-date]").forEach((el) => {
      el.textContent = dateString
    })
  }

  updatePlanetTable(bodies)
  updateEnergyTelemetry(bodies)
}

function updatePlanetTable(bodies) {
  const container = document.getElementById("planetTableBody")
  if (!container) return

  const AU_YEAR_TO_KM_S = 4.7426

  if (container.children.length === 0) {
    bodies.forEach((b) => {
      const tr = document.createElement("tr")
      tr.id = `row-${b.name}`
      const currentMass = b.mass * (b.multiplier || 1)
      const surfaceG = (G_PHYS * currentMass) / (b.radius * b.radius)
      const v = Math.hypot(b.vx, b.vy) * AU_YEAR_TO_KM_S

      tr.innerHTML = `
        <td><span class="body-cell"><i class="body-dot" style="--c:${b.color}"></i><span class="body-name">${b.name}</span></span></td>
        <td class="num mass-val">${currentMass.toExponential(2)}</td>
        <td class="num gravity-val">${surfaceG.toFixed(2)}</td>
        <td class="num speed-val">${v.toFixed(2)}</td>
      `
      container.appendChild(tr)
    })
  } else {
    bodies.forEach((b) => {
      const tr = document.getElementById(`row-${b.name}`)
      if (tr) {
        const massEl = tr.querySelector(".mass-val")
        const gravityEl = tr.querySelector(".gravity-val")
        const speedEl = tr.querySelector(".speed-val")

        if (massEl && gravityEl && speedEl) {
          const currentMass = b.mass * (b.multiplier || 1)
          const surfaceG = (G_PHYS * currentMass) / (b.radius * b.radius)
          const v = Math.hypot(b.vx, b.vy) * AU_YEAR_TO_KM_S

          massEl.textContent = currentMass.toExponential(2)
          gravityEl.textContent = surfaceG.toFixed(2)
          speedEl.textContent = v.toFixed(2)
        }
      }
    })
  }
}

function updateEnergyTelemetry(bodies) {
  let kinetic = 0,
    potential = 0
  const G_SIM_VAL = 39.47841760435743

  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i],
      ma = a.baseMass * (a.multiplier || 1)
    kinetic +=
      0.5 * ma * (a.vx * a.vx + a.vy * a.vy + (a.vz || 0) * (a.vz || 0))
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j],
        mb = b.baseMass * (b.multiplier || 1)
      const r = Math.hypot(b.x - a.x, b.y - a.y, (b.z || 0) - (a.z || 0))
      if (r > 0) potential -= (G_SIM_VAL * ma * mb) / r
    }
  }
  const total = kinetic + potential

  const ekEl = document.getElementById("stat-ek")
  const epEl = document.getElementById("stat-ep")
  const etotEl = document.getElementById("stat-etot")

  if (ekEl) ekEl.textContent = `+${kinetic.toExponential(3)} J`
  if (epEl) epEl.textContent = `${potential.toExponential(3)} J`
  if (etotEl)
    etotEl.textContent = `${total < 0 ? "" : "+"}${total.toExponential(3)} J`
}
