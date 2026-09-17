/**
 * The orbit field behind the hero: thousands of points (your files, repos and chats) on tilted
 * elliptical orbits around a warm core, with a few brighter bodies (agents) moving through them.
 *
 * Every frame is a pure function of time: `render(t)` places everything from `t` alone, with a
 * seeded random generator. The live page drives it from the clock, and HyperFrames can drive the
 * same module frame by frame to render video clips that match the page exactly.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
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

export interface OrbitScene {
  render(t: number): void
  resize(width: number, height: number): void
  pointer(x: number, y: number): void
  dispose(): void
}

/** mulberry32: a tiny seeded generator, so the field is identical on every load and every render */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ACCENT = new Color('#ff7a45')
const COOL = new Color('#c9d2ff')
const RINGS = [
  { a: 3.2, b: 1.25, tilt: 0.06, count: 900, speed: 0.05 },
  { a: 4.6, b: 1.8, tilt: -0.04, count: 1300, speed: 0.034 },
  { a: 6.2, b: 2.45, tilt: 0.02, count: 1700, speed: 0.024 },
  { a: 8.1, b: 3.2, tilt: -0.03, count: 1500, speed: 0.017 },
  { a: 10.4, b: 4.1, tilt: 0.05, count: 1100, speed: 0.012 },
]

function glowTexture(inner: string, outer: string) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, inner)
  grad.addColorStop(0.35, outer)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
}

export function createOrbitScene(canvas: HTMLCanvasElement, opts: { pixelRatio?: number } = {}): OrbitScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(opts.pixelRatio ?? window.devicePixelRatio, 1.75))
  const scene = new Scene()
  const camera = new PerspectiveCamera(38, 1, 0.1, 100)
  const field = new Group()
  // tipped towards the viewer so the ellipses read as orbits, not circles
  field.rotation.x = -1.12
  field.rotation.z = 0.18
  scene.add(field)

  const rand = seeded(7)

  // faint orbit lines
  const lineMat = new LineBasicMaterial({ color: COOL, transparent: true, opacity: 0.07 })
  for (const r of RINGS) {
    const pts = new Float32Array(256 * 3)
    for (let i = 0; i < 256; i++) {
      const th = (i / 256) * Math.PI * 2
      pts[i * 3] = Math.cos(th) * r.a
      pts[i * 3 + 1] = Math.sin(th) * r.b
      pts[i * 3 + 2] = Math.sin(th) * r.tilt * r.a
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(pts, 3))
    field.add(new LineLoop(g, lineMat))
  }

  // the particles: phase, ring, jitter per point; positions computed in the vertex shader from time
  const total = RINGS.reduce((n, r) => n + r.count, 0)
  const phase = new Float32Array(total)
  const ring = new Float32Array(total)
  const jitter = new Float32Array(total * 3)
  const size = new Float32Array(total)
  const warm = new Float32Array(total)
  let k = 0
  RINGS.forEach((r, ri) => {
    for (let i = 0; i < r.count; i++, k++) {
      phase[k] = rand() * Math.PI * 2
      ring[k] = ri
      jitter[k * 3] = (rand() - 0.5) * 0.55
      jitter[k * 3 + 1] = (rand() - 0.5) * 0.35
      jitter[k * 3 + 2] = (rand() - 0.5) * 0.25
      size[k] = 0.6 + rand() ** 3 * 2.6
      warm[k] = rand() < 0.035 ? 1 : 0
    }
  })
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(total * 3), 3))
  geo.setAttribute('aPhase', new BufferAttribute(phase, 1))
  geo.setAttribute('aRing', new BufferAttribute(ring, 1))
  geo.setAttribute('aJitter', new BufferAttribute(jitter, 3))
  geo.setAttribute('aSize', new BufferAttribute(size, 1))
  geo.setAttribute('aWarm', new BufferAttribute(warm, 1))
  const ringUniform = RINGS.map((r) => [r.a, r.b, r.tilt, r.speed]).flat()
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uRings: { value: ringUniform },
      uPixel: { value: renderer.getPixelRatio() },
      uCool: { value: COOL },
      uWarm: { value: ACCENT },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uRings[20];
      uniform float uPixel;
      attribute float aPhase;
      attribute float aRing;
      attribute vec3 aJitter;
      attribute float aSize;
      attribute float aWarm;
      varying float vWarm;
      varying float vFade;
      void main() {
        int r = int(aRing);
        float a = uRings[r * 4];
        float b = uRings[r * 4 + 1];
        float tilt = uRings[r * 4 + 2];
        float speed = uRings[r * 4 + 3];
        float th = aPhase + uTime * speed;
        vec3 p = vec3(cos(th) * a, sin(th) * b, sin(th) * tilt * a) + aJitter;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixel * (aWarm > 0.5 ? 2.2 : 1.0) * (22.0 / -mv.z);
        vWarm = aWarm;
        vFade = smoothstep(34.0, 12.0, -mv.z);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uCool;
      uniform vec3 uWarm;
      varying float vWarm;
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 col = mix(uCool, uWarm, vWarm);
        gl_FragColor = vec4(col, a * (vWarm > 0.5 ? 0.95 : 0.42) * vFade);
      }
    `,
  })
  field.add(new Points(geo, mat))

  // the core: a warm glow and a cooler halo
  const core = new Sprite(new SpriteMaterial({ map: glowTexture('rgba(255,190,150,1)', 'rgba(255,122,69,0.35)'), blending: AdditiveBlending, depthWrite: false, transparent: true }))
  core.scale.set(3.2, 3.2, 1)
  const halo = new Sprite(new SpriteMaterial({ map: glowTexture('rgba(255,122,69,0.22)', 'rgba(120,130,255,0.05)'), blending: AdditiveBlending, depthWrite: false, transparent: true }))
  halo.scale.set(16, 16, 1)
  scene.add(halo, core)

  // wide screens: the core sits right of the headline instead of behind the copy
  let offset = 0
  let px = 0
  let py = 0
  let tx = 0
  let ty = 0

  return {
    render(t) {
      mat.uniforms.uTime.value = t
      // ease the camera towards the pointer; deterministic when the pointer stays put
      px += (tx - px) * 0.04
      py += (ty - py) * 0.04
      camera.position.set(px * 1.4 - offset, 2.2 + py * 0.8, 17)
      camera.lookAt(-offset, 0.6, 0)
      field.rotation.z = 0.18 + t * 0.004
      const pulse = 1 + Math.sin(t * 0.9) * 0.04
      core.scale.set(3.2 * pulse, 3.2 * pulse, 1)
      renderer.render(scene, camera)
    },
    resize(width, height) {
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      // keep the field's width on narrow screens
      camera.fov = width / height < 1 ? 58 : 38
      offset = width >= 1100 ? 5.2 : width >= 760 ? 2.5 : 0
      camera.updateProjectionMatrix()
    },
    pointer(x, y) {
      tx = x
      ty = y
    },
    dispose() {
      geo.dispose()
      mat.dispose()
      renderer.dispose()
    },
  }
}
