import { JPL_IDS, JPL_EPOCH, AU_M } from "./constants.js"

export async function loadJPLStates() {
  const numberPattern =
    /\bX\s*=\s*([-+\d.Ee]+)\s+Y\s*=\s*([-+\d.Ee]+)\s+Z\s*=\s*([-+\d.Ee]+)/
  const velocityPattern =
    /\bVX\s*=\s*([-+\d.Ee]+)\s+VY\s*=\s*([-+\d.Ee]+)\s+VZ\s*=\s*([-+\d.Ee]+)/
  const entries = []

  for (const [name, id] of Object.entries(JPL_IDS)) {
    const params = new URLSearchParams({
      format: "json",
      COMMAND: `'${id}'`,
      OBJ_DATA: "NO",
      MAKE_EPHEM: "YES",
      EPHEM_TYPE: "VECTORS",
      CENTER: "'@0'",
      TLIST: `'${JPL_EPOCH}'`,
      TIME_TYPE: "'TDB'",
      OUT_UNITS: "'AU-D'",
      REF_PLANE: "'ECLIPTIC'",
      VEC_TABLE: "'2'",
      VEC_CORR: "'NONE'",
    })

    const url = "http://localhost:8080/api/horizons.api?" + params.toString()

    let data = null
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(20000),
        })
        const body = await response.text()
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        data = JSON.parse(body)
        if (data.error) throw new Error(data.error)
        break
      } catch (err) {
        if (attempt === 3) throw err
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
    const result = data.result || ""
    const soe = result.indexOf("$$SOE"),
      eoe = result.indexOf("$$EOE")
    const block = result.slice(soe, eoe)
    const pm = block.match(numberPattern),
      vm = block.match(velocityPattern)
    entries.push([
      name,
      {
        x: Number(pm[1]),
        y: Number(pm[2]),
        z: Number(pm[3]),
        vx: Number(vm[1]),
        vy: Number(vm[2]),
        vz: Number(vm[3]),
      },
    ])
  }
  return Object.fromEntries(entries)
}
