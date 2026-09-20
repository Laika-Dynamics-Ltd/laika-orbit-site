/**
 * The price card's Monthly/Yearly transition: the old price breaks into particles that swing out on
 * a small orbit, pick up Orbit's orange mid-flight, and settle into the new price, which then fades
 * back in as real text. three.js loads once the card is near the screen and draws only while a
 * transition runs; between clicks it costs nothing.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three'

type Glyphs = { xy: Float32Array; n: number }

const DURATION = 900 // ms, the whole morph
const STEP = 2 // px between samples in the glyph mask

/** points covering the ink of `text`, drawn exactly where `el` shows it, relative to `origin` */
function sample(el: HTMLElement, text: string, origin: DOMRect): Glyphs {
  const cs = getComputedStyle(el)
  const range = document.createRange()
  range.selectNodeContents(el)
  const box = range.getClientRects()[0] ?? el.getBoundingClientRect()
  const c = document.createElement('canvas')
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  if ('letterSpacing' in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing
  const m = g.measureText(text)
  const ascent = m.fontBoundingBoxAscent
  c.width = Math.ceil(m.width + 8)
  c.height = Math.ceil(ascent + m.fontBoundingBoxDescent + 8)
  g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  if ('letterSpacing' in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing
  g.fillStyle = '#fff'
  g.textBaseline = 'alphabetic'
  g.fillText(text, 4, 4 + ascent)
  const px = g.getImageData(0, 0, c.width, c.height).data
  const out: number[] = []
  const x0 = box.left - origin.left - 4
  const y0 = box.top - origin.top - 4
  for (let y = 0; y < c.height; y += STEP)
    for (let x = 0; x < c.width; x += STEP) if (px[(y * c.width + x) * 4 + 3] > 110) out.push(x0 + x, y0 + y)
  return { xy: new Float32Array(out), n: out.length / 2 }
}

export function createPriceMorph(card: HTMLElement) {
  const canvas = document.createElement('canvas')
  canvas.className = 'ps-morph'
  canvas.setAttribute('aria-hidden', 'true')
  card.append(canvas)
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  const scene = new Scene()
  const camera = new OrthographicCamera(0, 1, 0, 1, -10, 10)
  const mat = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uT: { value: 0 },
      uPixel: { value: renderer.getPixelRatio() },
      uInk: { value: new Color('#f7f8f8') },
      uHot: { value: new Color('#ff7a45') },
      uCentre: { value: [0, 0] },
    },
    vertexShader: /* glsl */ `
      uniform float uT;
      uniform float uPixel;
      uniform vec2 uCentre;
      attribute vec2 aFrom;
      attribute vec2 aTo;
      attribute float aDelay;
      attribute float aSeed;
      varying float vHeat;
      varying float vAlpha;
      void main() {
        float p = clamp((uT - aDelay) / (1.0 - 0.28), 0.0, 1.0);
        float e = p < 0.5 ? 4.0 * p * p * p : 1.0 - pow(-2.0 * p + 2.0, 3.0) / 2.0;
        vec2 pos = mix(aFrom, aTo, e);
        // swing out around the price's centre, like a body on a short orbit, then back in
        float swing = sin(3.14159 * e);
        vec2 r = pos - uCentre;
        float a = swing * (0.9 + aSeed * 0.8) * (aSeed > 0.5 ? 1.0 : -1.0);
        pos = uCentre + mat2(cos(a), -sin(a), sin(a), cos(a)) * r * (1.0 + 0.35 * swing);
        pos.y -= swing * (10.0 + 26.0 * aSeed);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);
        gl_PointSize = uPixel * (1.9 + 1.6 * swing);
        vHeat = swing;
        vAlpha = 0.55 + 0.45 * swing;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk;
      uniform vec3 uHot;
      varying float vHeat;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        gl_FragColor = vec4(mix(uInk, uHot, vHeat), smoothstep(0.5, 0.05, d) * vAlpha);
      }
    `,
  })
  const geo = new BufferGeometry()
  const points = new Points(geo, mat)
  points.frustumCulled = false
  scene.add(points)

  let raf = 0
  let stop: (() => void) | null = null

  function fit() {
    const w = card.clientWidth
    const h = card.clientHeight
    renderer.setSize(w, h, false)
    camera.right = w
    camera.bottom = h
    camera.updateProjectionMatrix()
  }

  /** the ink of the price shown in `el` right now, in the card's coordinates */
  const measure = (el: HTMLElement) => sample(el, el.textContent ?? '', card.getBoundingClientRect())

  /** morph the glyphs `A` (measured before the switch) into the price now shown in `toEl` */
  function run(A: Glyphs, toEl: HTMLElement, done: () => void) {
    stop?.()
    fit()
    const origin = card.getBoundingClientRect()
    const B = measure(toEl)
    const n = Math.max(A.n, B.n)
    const from = new Float32Array(n * 2)
    const to = new Float32Array(n * 2)
    const delay = new Float32Array(n)
    const seed = new Float32Array(n)
    let minX = Infinity
    let maxX = -Infinity
    for (let i = 0; i < n; i++) {
      const a = i < A.n ? i : Math.floor(Math.random() * A.n)
      const b = i < B.n ? i : Math.floor(Math.random() * B.n)
      from.set([A.xy[a * 2], A.xy[a * 2 + 1]], i * 2)
      to.set([B.xy[b * 2], B.xy[b * 2 + 1]], i * 2)
      minX = Math.min(minX, from[i * 2])
      maxX = Math.max(maxX, from[i * 2])
      seed[i] = Math.random()
    }
    // a left-to-right sweep, loosened with a little noise
    for (let i = 0; i < n; i++) delay[i] = ((from[i * 2] - minX) / Math.max(1, maxX - minX)) * 0.2 + seed[i] * 0.08
    geo.setAttribute('position', new BufferAttribute(new Float32Array(n * 3), 3))
    geo.setAttribute('aFrom', new BufferAttribute(from, 2))
    geo.setAttribute('aTo', new BufferAttribute(to, 2))
    geo.setAttribute('aDelay', new BufferAttribute(delay, 1))
    geo.setAttribute('aSeed', new BufferAttribute(seed, 1))
    const box = toEl.getBoundingClientRect()
    mat.uniforms.uCentre.value = [box.left - origin.left + box.width / 2, box.top - origin.top + box.height / 2]
    canvas.classList.add('on')
    const t0 = performance.now()
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION)
      mat.uniforms.uT.value = t
      renderer.render(scene, camera)
      if (t < 1) raf = requestAnimationFrame(frame)
      else finish()
    }
    const finish = () => {
      cancelAnimationFrame(raf)
      canvas.classList.remove('on')
      renderer.clear()
      stop = null
      done()
    }
    stop = finish
    raf = requestAnimationFrame(frame)
  }

  return { measure, run }
}

export type PriceMorph = ReturnType<typeof createPriceMorph>
