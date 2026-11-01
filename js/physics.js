import { G_SIM } from "./constants.js"

export function solveKepler(M, e) {
  let E = M
  for (let k = 0; k < 12; k++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
    E -= d
    if (Math.abs(d) < 1e-13) break
  }
  return E
}

export function orbitalState(el, mu) {
  const rad = Math.PI / 180,
    a = el.a,
    e = el.e
  const M = ((el.L - el.varpi) * rad) % (2 * Math.PI)
  const E = solveKepler(M, e),
    n = Math.sqrt(mu / (a * a * a))
  const xp = a * (Math.cos(E) - e),
    yp = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const den = 1 - e * Math.cos(E)
  const vxp = (-a * n * Math.sin(E)) / den,
    vyp = (a * n * Math.sqrt(1 - e * e) * Math.cos(E)) / den
  const w = (el.varpi - el.O) * rad,
    O = el.O * rad,
    inc = el.i * rad
  const cw = Math.cos(w),
    sw = Math.sin(w),
    cO = Math.cos(O),
    sO = Math.sin(O),
    ci = Math.cos(inc),
    si = Math.sin(inc)

  function rotate(x, y) {
    return {
      x: (cO * cw - sO * sw * ci) * x + (-cO * sw - sO * cw * ci) * y,
      y: (sO * cw + cO * sw * ci) * x + (-sO * sw + cO * cw * ci) * y,
      z: sw * si * x + cw * si * y,
    }
  }
  const pos = rotate(xp, yp),
    vel = rotate(vxp, vyp)
  return { x: pos.x, y: pos.y, z: pos.z, vx: vel.x, vy: vel.y, vz: vel.z }
}

export function calculateAccelerations(bodies) {
  const ax = bodies.map(() => 0),
    ay = bodies.map(() => 0),
    az = bodies.map(() => 0)
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i],
        b = bodies[j]
      const dx = b.x - a.x,
        dy = b.y - a.y,
        dz = (b.z || 0) - (a.z || 0)
      const r2 = Math.max(dx * dx + dy * dy + dz * dz, 1e-14),
        r = Math.sqrt(r2)
      const ma = a.baseMass * a.multiplier,
        mb = b.baseMass * b.multiplier
      const k = G_SIM / (r2 * r)
      ax[i] += k * mb * dx
      ay[i] += k * mb * dy
      az[i] += k * mb * dz
      ax[j] -= k * ma * dx
      ay[j] -= k * ma * dy
      az[j] -= k * ma * dz
    }
  }
  return { ax, ay, az }
}

export function physicsStep(bodies, dt) {
  const a0 = calculateAccelerations(bodies)
  bodies.forEach((b, i) => {
    b.x += b.vx * dt + 0.5 * a0.ax[i] * dt * dt
    b.y += b.vy * dt + 0.5 * a0.ay[i] * dt * dt
    b.z = (b.z || 0) + b.vz * dt + 0.5 * a0.az[i] * dt * dt
  })
  const a1 = calculateAccelerations(bodies)
  bodies.forEach((b, i) => {
    b.vx += 0.5 * (a0.ax[i] + a1.ax[i]) * dt
    b.vy += 0.5 * (a0.ay[i] + a1.ay[i]) * dt
    b.vz += 0.5 * (a0.az[i] + a1.az[i]) * dt
  })
}

export function totalMechanicalEnergy(bodies) {
  let kinetic = 0,
    potential = 0
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i],
      ma = a.baseMass * a.multiplier
    kinetic +=
      0.5 * ma * (a.vx * a.vx + a.vy * a.vy + (a.vz || 0) * (a.vz || 0))
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j],
        mb = b.baseMass * b.multiplier
      const r = Math.hypot(b.x - a.x, b.y - a.y, (b.z || 0) - (a.z || 0))
      if (r > 0) potential -= (G_SIM * ma * mb) / r
    }
  }
  return kinetic + potential
}
