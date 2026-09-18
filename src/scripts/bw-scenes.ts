/**
 * The three small scenes on /built-with-orbit/, in the hero's style (orbit-scene.ts):
 *   fleet    17 agents on tilted orbits around a warm core, each with a tail; two pulse "needs you"
 *   offload  work arcing from this Mac to another machine, and files arcing back
 *   recall   a cloud of files; a query flies in and lights the one section that answers
 *
 * Like the hero, every frame is a pure function of time: render(t) places everything from t and
 * a seeded generator, so a still frame (?frame=, reduced motion) matches the moving page.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  WebGLRenderer,
} from 'three'
import { glowTexture, seeded } from './orbit-scene'

export interface MiniScene {
  render(t: number): void
  resize(width: number, height: number): void
  dispose(): void
}

const ACCENT = new Color('#ff7a45')
const COOL = new Color('#c9d2ff')

function base(canvas: HTMLCanvasElement, fov: number) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  const scene = new Scene()
  const camera = new PerspectiveCamera(fov, 1, 0.1, 100)
  return { renderer, scene, camera }
}

function glow(inner: string, outer: string, s: number) {
  const sp = new Sprite(new SpriteMaterial({ map: glowTexture(inner, outer), blending: AdditiveBlending, depthWrite: false, transparent: true }))
  sp.scale.set(s, s, 1)
  return sp
}

/** soft round points, coloured and faded per point */
const pointsMaterial = (renderer: WebGLRenderer, vertexBody: string, uniforms: Record<string, { value: unknown }> = {}) =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uPixel: { value: renderer.getPixelRatio() }, uCool: { value: COOL }, uWarm: { value: ACCENT }, ...uniforms },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPixel;
      varying float vAlpha;
      varying float vWarm;
      ${vertexBody}
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCool;
      uniform vec3 uWarm;
      varying float vAlpha;
      varying float vWarm;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(mix(uCool, uWarm, vWarm), smoothstep(0.5, 0.0, d) * vAlpha);
      }
    `,
  })

// ───────────────────────────────────────────────────────────────── fleet

export function fleet(canvas: HTMLCanvasElement): MiniScene {
  const { renderer, scene, camera } = base(canvas, 36)
  const field = new Group()
  field.rotation.x = -1.1
  scene.add(field)
  const rand = seeded(17)

  const AGENTS = 17
  const TAIL = 26
  const NEEDS = new Set([4, 11])
  const lineMat = new LineBasicMaterial({ color: COOL, transparent: true, opacity: 0.06 })
  const orbit = new Float32Array(AGENTS * 4) // a, b, tilt, speed
  for (let i = 0; i < AGENTS; i++) {
    const a = 2 + (i / AGENTS) * 4.6 + rand() * 0.4
    orbit.set([a, a * (0.36 + rand() * 0.12), (rand() - 0.5) * 0.16, (0.34 / Math.sqrt(a)) * (0.8 + rand() * 0.4)], i * 4)
    const pts = new Float32Array(160 * 3)
    for (let k = 0; k < 160; k++) {
      const th = (k / 160) * Math.PI * 2
      pts.set([Math.cos(th) * a, Math.sin(th) * orbit[i * 4 + 1], Math.sin(th) * orbit[i * 4 + 2] * a], k * 3)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pts, 3))
    field.add(new LineLoop(g, lineMat))
  }

  const n = AGENTS * TAIL
  const agent = new Float32Array(n)
  const lag = new Float32Array(n)
  const phase = new Float32Array(n)
  for (let i = 0; i < AGENTS; i++) {
    const ph = rand() * Math.PI * 2
    for (let k = 0; k < TAIL; k++) {
      agent[i * TAIL + k] = i
      lag[i * TAIL + k] = k / (TAIL - 1)
      phase[i * TAIL + k] = ph
    }
  }
  const needs = new Float32Array(AGENTS).map((_, i) => (NEEDS.has(i) ? 1 : 0))
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3))
  geo.setAttribute('aAgent', new BufferAttribute(agent, 1))
  geo.setAttribute('aLag', new BufferAttribute(lag, 1))
  geo.setAttribute('aPhase', new BufferAttribute(phase, 1))
  const mat = pointsMaterial(
    renderer,
    /* glsl */ `
      uniform float uOrbit[${AGENTS * 4}];
      uniform float uNeeds[${AGENTS}];
      attribute float aAgent;
      attribute float aLag;
      attribute float aPhase;
      void main() {
        int i = int(aAgent);
        float a = uOrbit[i * 4], b = uOrbit[i * 4 + 1], tilt = uOrbit[i * 4 + 2], speed = uOrbit[i * 4 + 3];
        float th = aPhase + uTime * speed - aLag * 0.55;
        vec3 p = vec3(cos(th) * a, sin(th) * b, sin(th) * tilt * a);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float need = uNeeds[i];
        float pulse = need > 0.5 ? 0.75 + 0.25 * sin(uTime * 3.2 + aPhase) : 1.0;
        float head = 1.0 - aLag;
        gl_PointSize = uPixel * (22.0 / -mv.z) * (aLag < 0.01 ? (need > 0.5 ? 7.0 : 4.6) * pulse : 1.6 * head + 0.4);
        vAlpha = aLag < 0.01 ? 0.95 : 0.5 * head * head;
        vWarm = need;
      }
    `,
    { uOrbit: { value: Array.from(orbit) }, uNeeds: { value: Array.from(needs) } },
  )
  field.add(new Points(geo, mat))
  const core = glow('rgba(255,190,150,1)', 'rgba(255,122,69,0.35)', 2.4)
  scene.add(glow('rgba(255,122,69,0.2)', 'rgba(120,130,255,0.05)', 11), core)

  return {
    render(t) {
      mat.uniforms.uTime.value = t
      field.rotation.z = 0.2 + t * 0.01
      const pulse = 1 + Math.sin(t * 0.9) * 0.05
      core.scale.set(2.4 * pulse, 2.4 * pulse, 1)
      camera.position.set(0, 1.6, 15)
      camera.lookAt(0, 0.2, 0)
      renderer.render(scene, camera)
    },
    resize(w, h) {
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.fov = w / h < 1 ? 56 : 36
      camera.updateProjectionMatrix()
    },
    dispose() {
      geo.dispose()
      mat.dispose()
      renderer.dispose()
    },
  }
}

// ───────────────────────────────────────────────────────────────── offload

export function offload(canvas: HTMLCanvasElement): MiniScene {
  const { renderer, scene, camera } = base(canvas, 30)
  const rand = seeded(4)
  const L = -4.2
  const R = 4.2
  const mac = glow('rgba(255,190,150,1)', 'rgba(255,122,69,0.3)', 1.9)
  mac.position.set(L, 0, 0)
  const box = glow('rgba(220,228,255,1)', 'rgba(140,150,255,0.25)', 1.9)
  box.position.set(R, 0, 0)
  const boxHalo = glow('rgba(140,150,255,0.25)', 'rgba(140,150,255,0.04)', 5)
  boxHalo.position.set(R, 0, 0)
  scene.add(boxHalo, mac, box)

  // faint guide arcs
  const lineMat = new LineBasicMaterial({ color: COOL, transparent: true, opacity: 0.07 })
  for (const up of [1, -1]) {
    const pts = new Float32Array(96 * 3)
    for (let k = 0; k < 96; k++) {
      const u = k / 95
      pts.set([L + (R - L) * u, up * 2.3 * 4 * u * (1 - u), 0], k * 3)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pts, 3))
    scene.add(new Line(g, lineMat))
  }

  // packets: out along the upper arc (work), back along the lower one (files, warm)
  const n = 150
  const phase = new Float32Array(n)
  const dir = new Float32Array(n)
  const spread = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    phase[i] = rand()
    dir[i] = i < 90 ? 1 : -1
    spread[i] = (rand() - 0.5) * 0.35
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3))
  geo.setAttribute('aPhase', new BufferAttribute(phase, 1))
  geo.setAttribute('aDir', new BufferAttribute(dir, 1))
  geo.setAttribute('aSpread', new BufferAttribute(spread, 1))
  const mat = pointsMaterial(
    renderer,
    /* glsl */ `
      attribute float aPhase;
      attribute float aDir;
      attribute float aSpread;
      void main() {
        float u = fract(aPhase + uTime * (aDir > 0.0 ? 0.16 : 0.11));
        float x = aDir > 0.0 ? mix(${L.toFixed(1)}, ${R.toFixed(1)}, u) : mix(${R.toFixed(1)}, ${L.toFixed(1)}, u);
        float arc = aDir * (2.3 + aSpread) * 4.0 * u * (1.0 - u);
        vec4 mv = modelViewMatrix * vec4(x, arc, aSpread * 0.6, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uPixel * (22.0 / -mv.z) * (aDir > 0.0 ? 2.2 : 2.8);
        vAlpha = sin(3.14159 * u) * 0.85;
        vWarm = aDir > 0.0 ? 0.0 : 1.0;
      }
    `,
  )
  scene.add(new Points(geo, mat))

  return {
    render(t) {
      mat.uniforms.uTime.value = t
      const busy = 1 + Math.sin(t * 2.4) * 0.08
      boxHalo.scale.set(5 * busy, 5 * busy, 1)
      camera.position.set(0, 0.4, 16)
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
    },
    resize(w, h) {
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.fov = w / h < 1.2 ? 44 : 30
      camera.updateProjectionMatrix()
    },
    dispose() {
      geo.dispose()
      mat.dispose()
      renderer.dispose()
    },
  }
}

// ───────────────────────────────────────────────────────────────── recall

export function recall(canvas: HTMLCanvasElement): MiniScene {
  const { renderer, scene, camera } = base(canvas, 34)
  const rand = seeded(11)
  const cloud = new Group()
  scene.add(cloud)
  const TARGET = { x: 1.6, y: 0.5, z: 0.4 }
  const n = 1600
  const hit = 46
  const pos = new Float32Array(n * 3)
  const target = new Float32Array(n)
  const size = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    if (i < hit) {
      const r = 0.38 * Math.cbrt(rand())
      const th = rand() * Math.PI * 2
      const ph = Math.acos(2 * rand() - 1)
      pos.set([TARGET.x + r * Math.sin(ph) * Math.cos(th), TARGET.y + r * Math.cos(ph), TARGET.z + r * Math.sin(ph) * Math.sin(th)], i * 3)
      target[i] = 1
    } else {
      // loose clumps, like folders of files
      const c = Math.floor(rand() * 9)
      const cx = Math.cos(c * 2.1) * 2.6
      const cy = Math.sin(c * 1.3) * 1.3
      const cz = Math.sin(c * 2.7) * 1.8
      const r = 1.3 * Math.cbrt(rand())
      const th = rand() * Math.PI * 2
      const ph = Math.acos(2 * rand() - 1)
      pos.set([cx + r * Math.sin(ph) * Math.cos(th), cy + r * Math.cos(ph) * 0.8, cz + r * Math.sin(ph) * Math.sin(th)], i * 3)
    }
    size[i] = 0.7 + rand() ** 3 * 2.2
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(pos, 3))
  geo.setAttribute('aTarget', new BufferAttribute(target, 1))
  geo.setAttribute('aSize', new BufferAttribute(size, 1))
  // one query every 6 seconds: the beam flies in (0–1.4s), the answer lights (1.4–4.6s), then fades
  const mat = pointsMaterial(
    renderer,
    /* glsl */ `
      uniform float uLit;
      attribute float aTarget;
      attribute float aSize;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float lit = aTarget * uLit;
        gl_PointSize = uPixel * (22.0 / -mv.z) * aSize * (1.0 + lit * 1.6);
        vAlpha = mix(0.32, 1.0, lit) * smoothstep(30.0, 10.0, -mv.z);
        vWarm = lit;
      }
    `,
    { uLit: { value: 0 } },
  )
  cloud.add(new Points(geo, mat))

  const head = glow('rgba(255,210,180,1)', 'rgba(255,122,69,0.4)', 0.9)
  const flare = glow('rgba(255,160,110,0.9)', 'rgba(255,122,69,0.15)', 3.4)
  flare.position.set(TARGET.x, TARGET.y, TARGET.z)
  cloud.add(head, flare)
  const beamGeo = new BufferGeometry()
  beamGeo.setAttribute('position', new BufferAttribute(new Float32Array(6), 3))
  const beamMat = new LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0 })
  const beam = new Line(beamGeo, beamMat)
  cloud.add(beam)
  const FROM = { x: -9, y: 2.2, z: 3 }

  return {
    render(t) {
      cloud.rotation.y = Math.sin(t * 0.08) * 0.35
      const c = t % 6
      const fly = Math.min(1, c / 1.4)
      const ease = 1 - (1 - fly) ** 3
      const lit = c < 1.4 ? 0 : c < 1.8 ? (c - 1.4) / 0.4 : c < 4.6 ? 1 : Math.max(0, 1 - (c - 4.6) / 1.2)
      const hx = FROM.x + (TARGET.x - FROM.x) * ease
      const hy = FROM.y + (TARGET.y - FROM.y) * ease
      const hz = FROM.z + (TARGET.z - FROM.z) * ease
      head.position.set(hx, hy, hz)
      head.material.opacity = c < 1.5 ? 1 : 0
      const b = beamGeo.attributes.position.array as Float32Array
      b.set([FROM.x, FROM.y, FROM.z, hx, hy, hz])
      beamGeo.attributes.position.needsUpdate = true
      beamMat.opacity = c < 1.4 ? 0.35 : 0.35 * Math.max(0, 1 - (c - 1.4) / 0.8)
      mat.uniforms.uLit.value = lit
      flare.material.opacity = lit * 0.8
      camera.position.set(0, 1.2, 13)
      camera.lookAt(0, 0.2, 0)
      renderer.render(scene, camera)
    },
    resize(w, h) {
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.fov = w / h < 1.2 ? 46 : 34
      camera.updateProjectionMatrix()
    },
    dispose() {
      geo.dispose()
      mat.dispose()
      beamGeo.dispose()
      renderer.dispose()
    },
  }
}
