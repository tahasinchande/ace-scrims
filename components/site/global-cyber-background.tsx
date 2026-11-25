"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { useViewMode } from "@/lib/view-mode"
import {
  applyAmbientThemeToRoot,
  getAmbientPhaseAt,
  STAGE_BASE_NORM,
} from "@/lib/ambient-theme"

const VOLUMETRIC_2D_VS = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`

/**
 * Volumetric 2D Flowing Blue-Spectrum Atmospheric Fragment Shader
 * - Continuously flowing liquid-aurora ribbons & multi-depth domain-warped light fields
 * - Moves clearly and organically on its own over time, shifting across deep navy,
 *   electric cobalt, electric cyan, and luminous azure with smooth pointer/scroll parallax.
 */
const VOLUMETRIC_2D_FS = `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uPointer;
  uniform float uScroll;
  uniform vec3 uBgA;
  uniform vec3 uBgB;
  uniform vec3 uGlow;
  uniform vec3 uC1;
  uniform vec3 uC2;
  uniform vec3 uC3;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash12(i + vec2(0.0, 0.0)), hash12(i + vec2(1.0, 0.0)), u.x),
      mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 4; i++) {
      v += a * noise2D(p);
      p = rot * p * 2.04 + vec2(17.1, 31.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / max(uRes.y, 1.0);
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

    vec2 drift = vec2(uPointer.x * 0.07, uPointer.y * 0.055 - uScroll * 0.09);
    float t = uTime * 0.42;

    // 1. Deep navy obsidian base + sweeping top/diagonal ambient wash
    vec3 col = uBgA;
    float g1 = clamp(1.0 - length((uv - vec2(0.1 + sin(t * 0.45) * 0.12, 0.92) - drift * 0.35) * vec2(0.85, 1.1)), 0.0, 1.0);
    col = mix(col, uBgB * 1.65, smoothstep(0.0, 1.0, g1) * 0.95);

    float g2 = clamp(1.0 - length((uv - vec2(0.88 + cos(t * 0.38) * 0.10, 0.72) + drift * 0.4) * vec2(1.15, 0.95)), 0.0, 1.0);
    col += uGlow * 0.82 * pow(g2, 1.5);

    // 2. Flowing domain-warped liquid energy currents
    vec2 q = vec2(
      fbm(p * 1.45 + vec2(t * 0.65, -t * 0.42)),
      fbm(p * 1.45 + vec2(-t * 0.52 + 4.3, t * 0.58 + 1.9))
    );
    float veilA = fbm(p * 1.65 + 1.75 * q + vec2(t * 0.36, -t * 0.24));
    float veilB = fbm(p * 2.25 - 1.35 * q + vec2(-t * 0.42, t * 0.28));

    // Undulating aurora wave ribbons sweeping continuously across the viewport
    float waveY1 = 0.62 + sin(p.x * 2.1 - t * 1.05 + q.x * 2.4) * 0.14;
    float ribbon1 = exp(-pow((uv.y - waveY1) * 4.4, 2.0)) * (0.55 + veilA * 0.75);

    float waveY2 = 0.36 + cos(p.x * 1.7 + t * 0.85 - q.y * 2.2) * 0.16;
    float ribbon2 = exp(-pow((uv.y - waveY2) * 3.8, 2.0)) * (0.45 + veilB * 0.80);

    // Drifting radial bloom pools
    vec2 field1Center = vec2(
      0.26 + sin(t * 0.82) * 0.18,
      0.74 + cos(t * 0.64) * 0.12
    ) + drift * 0.5;
    float f1 = exp(-pow(length((uv - field1Center) * vec2(aspect * 0.65, 1.0)), 2.0) * 1.55);

    vec2 field2Center = vec2(
      0.74 + cos(t * 0.74) * 0.16,
      0.58 + sin(t * 0.62) * 0.14
    ) - drift * 0.45;
    float f2 = exp(-pow(length((uv - field2Center) * vec2(aspect * 0.68, 1.05)), 2.0) * 1.75);

    vec2 field3Center = vec2(
      0.50 + sin(t * 0.55 + 2.1) * 0.20,
      0.22 + cos(t * 0.48 + 1.4) * 0.10
    ) + drift * 0.3;
    float f3 = exp(-pow(length((uv - field3Center) * vec2(aspect * 0.58, 1.1)), 2.0) * 1.55);

    col += uC1 * (f1 * (0.34 + veilA * 0.28) + ribbon1 * 0.36);
    col += uC2 * (f2 * (0.30 + veilB * 0.28) + ribbon2 * 0.32);
    col += mix(uBgB, uC1, 0.55) * (f3 * (0.30 + veilA * 0.20));

    // Luminous crest caustics gliding along the liquid waves
    float caustic = smoothstep(0.42, 0.86, veilA * 0.58 + veilB * 0.42) * (ribbon1 * 0.75 + ribbon2 * 0.65 + f1 * 0.35);
    col += mix(uC2, uC3, 0.52) * caustic * 0.32;

    float upperLift = smoothstep(0.0, 0.94, uv.y);
    col *= mix(0.82, 1.12, upperLift);

    float vig = smoothstep(1.45, 0.24, length((uv - 0.5) * vec2(aspect * 0.76, 1.02)));
    col *= mix(0.68, 1.0, vig);

    // Smooth filmic roll-off
    col = col / (1.0 + col * 0.34);

    // Dither to prevent 8-bit banding
    float dither = (hash12(gl_FragCoord.xy + fract(uTime * 13.7)) - 0.5) / 255.0;
    col = clamp(col + dither, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
  }
`

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

/**
 * Detect software WebGL (SwiftShader, llvmpipe, WARP) from the GPU renderer string.
 * Used strictly for rendering cost & frame pacing (never hides or alters the scene).
 */
function detectSoftwareWebGL(): boolean {
  if (typeof document === "undefined") return false
  try {
    const probeCanvas = document.createElement("canvas")
    const gl = probeCanvas.getContext("webgl2") || probeCanvas.getContext("webgl")
    if (!gl) return true
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER
    const gpu = String(gl.getParameter(param) || "")
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu)
  } catch {
    return false
  }
}

export function GlobalCyberBackground() {
  const threeContainerRef = useRef<HTMLDivElement>(null)
  const volumetric2DCanvasRef = useRef<HTMLCanvasElement>(null)
  const sharedStartMsRef = useRef<number | null>(null)
  const { mode } = useViewMode()
  const [webgl2DReady, setWebgl2DReady] = useState(false)
  const [webgl3DFallback, setWebgl3DFallback] = useState(false)

  // Synchronized dynamic blue-spectrum color-shifting engine across BOTH 2D & 3D modes.
  // Never freezes completely on reduced-motion; instead uses a calm 0.5x color glide speed.
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (sharedStartMsRef.current === null) {
      sharedStartMsRef.current = performance.now()
    }

    const initialPhase = getAmbientPhaseAt(0)
    applyAmbientThemeToRoot(initialPhase)

    let rafId = 0
    let lastAppliedKey = ""
    const colorSpeed = prefersReducedMotion ? 0.5 : 1.0

    const tick = () => {
      rafId = window.requestAnimationFrame(tick)
      if (document.hidden) return
      const startMs = sharedStartMsRef.current ?? performance.now()
      const elapsedSec = ((performance.now() - startMs) / 1000) * colorSpeed
      const state = getAmbientPhaseAt(elapsedSec)
      const key = `${state.primaryRgb.join(",")}|${state.glowRgb.join(",")}|${state.accentRgb.join(",")}`
      if (key !== lastAppliedKey) {
        lastAppliedKey = key
        applyAmbientThemeToRoot(state)
      }
    }

    rafId = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────────
  // 2D MODE: FLOWING VOLUMETRIC WEBGL COLOR-FIELD SHADER (with animated CSS fallback)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "3d" && !webgl3DFallback) {
      setWebgl2DReady(false)
      return
    }

    const canvas = volumetric2DCanvasRef.current
    if (!canvas) return

    let gl: WebGLRenderingContext | null = null
    try {
      gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      })
    } catch {
      gl = null
    }

    if (!gl) {
      setWebgl2DReady(false)
      return
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VOLUMETRIC_2D_VS)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, VOLUMETRIC_2D_FS)
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs)
      if (fs) gl.deleteShader(fs)
      setWebgl2DReady(false)
      return
    }

    const program = gl.createProgram()
    if (!program) {
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      setWebgl2DReady(false)
      return
    }

    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      setWebgl2DReady(false)
      return
    }

    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    )

    const aPos = gl.getAttribLocation(program, "aPos")
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(program, "uTime")
    const uRes = gl.getUniformLocation(program, "uRes")
    const uPointer = gl.getUniformLocation(program, "uPointer")
    const uScroll = gl.getUniformLocation(program, "uScroll")
    const uBgA = gl.getUniformLocation(program, "uBgA")
    const uBgB = gl.getUniformLocation(program, "uBgB")
    const uGlow = gl.getUniformLocation(program, "uGlow")
    const uC1 = gl.getUniformLocation(program, "uC1")
    const uC2 = gl.getUniformLocation(program, "uC2")
    const uC3 = gl.getUniformLocation(program, "uC3")

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const motionRate = prefersReducedMotion ? 0.4 : 1.0

    let targetPtrX = 0
    let targetPtrY = 0
    let smoothPtrX = 0
    let smoothPtrY = 0
    let scrollRatio = 0
    let contextLost = false
    let isDisposed = false

    const resize = () => {
      if (!gl || contextLost || isDisposed) return
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const w = Math.max(1, Math.floor(window.innerWidth * dpr))
      const h = Math.max(1, Math.floor(window.innerHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
    }

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY
      targetPtrX = (clientX / Math.max(window.innerWidth, 1)) * 2 - 1
      targetPtrY = -((clientY / Math.max(window.innerHeight, 1)) * 2 - 1)
    }

    const onScroll = () => {
      const docHeight =
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          window.innerHeight * 2
        ) - window.innerHeight
      const y = window.scrollY || document.documentElement.scrollTop || 0
      scrollRatio = Math.max(0, Math.min(1, y / Math.max(docHeight, 1)))
    }

    const onContextLost = (e: Event) => {
      e.preventDefault()
      contextLost = true
      if (!isDisposed) setWebgl2DReady(false)
    }

    resize()
    window.addEventListener("resize", resize, { passive: true })
    window.addEventListener("mousemove", onPointerMove, { passive: true })
    window.addEventListener("touchmove", onPointerMove, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })
    canvas.addEventListener("webglcontextlost", onContextLost)

    const drawFrame = (elapsedSec: number) => {
      if (!gl || contextLost || isDisposed) return
      const phase = getAmbientPhaseAt(elapsedSec * motionRate)
      smoothPtrX += (targetPtrX - smoothPtrX) * 0.045
      smoothPtrY += (targetPtrY - smoothPtrY) * 0.045

      gl.uniform1f(uTime, elapsedSec * motionRate)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform2f(uPointer, smoothPtrX, smoothPtrY)
      gl.uniform1f(uScroll, scrollRatio)
      gl.uniform3f(uBgA, STAGE_BASE_NORM[0], STAGE_BASE_NORM[1], STAGE_BASE_NORM[2])
      gl.uniform3f(uBgB, phase.bgB[0], phase.bgB[1], phase.bgB[2])
      gl.uniform3f(uGlow, phase.glow[0], phase.glow[1], phase.glow[2])
      gl.uniform3f(uC1, phase.c1[0], phase.c1[1], phase.c1[2])
      gl.uniform3f(uC2, phase.c2[0], phase.c2[1], phase.c2[2])
      gl.uniform3f(uC3, phase.c3[0], phase.c3[1], phase.c3[2])

      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    const initStart = sharedStartMsRef.current ?? performance.now()
    drawFrame((performance.now() - initStart) / 1000)
    setWebgl2DReady(true)

    let rafId = 0
    const loop = () => {
      if (isDisposed) return
      rafId = window.requestAnimationFrame(loop)
      if (document.hidden || contextLost) return
      const startMs = sharedStartMsRef.current ?? performance.now()
      drawFrame((performance.now() - startMs) / 1000)
    }

    rafId = window.requestAnimationFrame(loop)

    return () => {
      isDisposed = true
      window.cancelAnimationFrame(rafId)
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onPointerMove)
      window.removeEventListener("touchmove", onPointerMove)
      window.removeEventListener("scroll", onScroll)
      canvas.removeEventListener("webglcontextlost", onContextLost)
      if (gl && !contextLost) {
        try {
          if (buffer) gl.deleteBuffer(buffer)
          gl.deleteProgram(program)
          gl.deleteShader(vs)
          gl.deleteShader(fs)
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }, [mode, webgl3DFallback])

  // ─────────────────────────────────────────────────────────────────────────────
  // 3D MODE: CONTINUOUSLY FLOWING BLUE-SHIFTING 3D CYBER TERRAIN,
  // UNDULATING ENERGY WAVES, REFLECTIVE MONOLITHS, BEAMS & PARTICLES
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "3d") {
      setWebgl3DFallback(false)
      return
    }

    const container = threeContainerRef.current
    if (!container) return

    let width = Math.max(window.innerWidth, 1)
    let height = Math.max(window.innerHeight, 1)
    let isDisposed = false
    let contextLost = false

    const isSoftwareGl = detectSoftwareWebGL()

    const disposables: Array<{ dispose: () => void }> = []
    const trackDisposable = <T extends { dispose: () => void }>(resource: T): T => {
      disposables.push(resource)
      return resource
    }

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        powerPreference: "high-performance",
        antialias: !isSoftwareGl,
        alpha: false,
        stencil: false,
        depth: true,
      })
    } catch {
      setWebgl3DFallback(true)
      return
    }

    setWebgl3DFallback(false)

    const initialElapsed =
      sharedStartMsRef.current !== null
        ? Math.max(0, (performance.now() - sharedStartMsRef.current) / 1000)
        : 0
    const initPhase = getAmbientPhaseAt(initialElapsed)

    // 1. Scene, Fog, Camera & Studio Environment Map (so metallic blocks reflect rich blue light)
    const scene = new THREE.Scene()
    const stageColor = new THREE.Color(
      STAGE_BASE_NORM[0] + initPhase.bgB[0] * 0.42,
      STAGE_BASE_NORM[1] + initPhase.bgB[1] * 0.42,
      STAGE_BASE_NORM[2] + initPhase.bgB[2] * 0.48
    )
    scene.background = stageColor.clone()
    const fog = new THREE.FogExp2(stageColor.getHex(), 0.0145)
    scene.fog = fog

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 420)
    camera.position.set(17, 15.5, 27)
    camera.lookAt(0, 2.2, 0)

    const maxDPR = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75)
    renderer.setPixelRatio(maxDPR)
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.38
    renderer.shadowMap.enabled = false

    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer)
      const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04)
      scene.environment = envRT.texture
      trackDisposable(envRT)
      pmremGenerator.dispose()
    } catch {
      // Proceed cleanly without PMREM if restricted
    }

    renderer.domElement.style.position = "absolute"
    renderer.domElement.style.top = "0"
    renderer.domElement.style.left = "0"
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    renderer.domElement.style.display = "block"
    renderer.domElement.style.pointerEvents = "none"

    container.replaceChildren(renderer.domElement)

    const onWebglContextLost = (e: Event) => {
      e.preventDefault()
      contextLost = true
      if (!isDisposed) {
        setWebgl3DFallback(true)
      }
    }
    renderer.domElement.addEventListener("webglcontextlost", onWebglContextLost)

    // 2. Dynamic Blue-Shifting Multi-Point Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x050b24, 1.45)
    scene.add(hemiLight)

    const dirKey = new THREE.DirectionalLight(0x1f73ff, 3.2)
    dirKey.position.set(24, 34, 20)
    scene.add(dirKey)

    const dirRim = new THREE.DirectionalLight(0x22d3ee, 2.4)
    dirRim.position.set(-28, 22, -24)
    scene.add(dirRim)

    const coreLight1 = new THREE.PointLight(0x1f73ff, 12.0, 58, 1.4)
    coreLight1.position.set(0, 6.5, 0)
    scene.add(coreLight1)

    const coreLight2 = new THREE.PointLight(0x38bdf8, 9.5, 48, 1.4)
    coreLight2.position.set(16, 5.0, -12)
    scene.add(coreLight2)

    const coreLight3 = new THREE.PointLight(0x2563eb, 8.8, 48, 1.4)
    coreLight3.position.set(-16, 4.5, 11)
    scene.add(coreLight3)

    // 3. CONTINUOUS FLOWING 3D LIQUID-ENERGY WAVE SURFACE (Video-like undulating ocean of light)
    const waveUniforms = {
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color(initPhase.bgB[0] * 1.4, initPhase.bgB[1] * 1.6, initPhase.bgB[2] * 1.9) },
      uPrimaryColor: { value: new THREE.Color(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2]) },
      uAccentColor: { value: new THREE.Color(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2]) },
      uCrestColor: { value: new THREE.Color(initPhase.c3[0], initPhase.c3[1], initPhase.c3[2]) },
    }

    const waveGeo = trackDisposable(new THREE.PlaneGeometry(118, 118, 76, 76))
    waveGeo.rotateX(-Math.PI / 2)

    const waveMat = trackDisposable(
      new THREE.ShaderMaterial({
        uniforms: waveUniforms,
        vertexShader: `
          uniform float uTime;
          varying float vElevation;
          varying vec2 vWorldXZ;
          varying vec2 vUv;

          void main() {
            vUv = uv;
            vec3 pos = position;

            float w1 = sin(pos.x * 0.11 - uTime * 1.35) * cos(pos.z * 0.09 - uTime * 0.95) * 1.35;
            float w2 = sin((pos.x * 0.07 + pos.z * 0.08) + uTime * 1.1) * 0.85;
            float w3 = cos(length(pos.xz) * 0.14 - uTime * 1.75) * 0.65;
            float elevation = w1 + w2 + w3;

            pos.y += elevation;
            vElevation = elevation;
            vWorldXZ = pos.xz;

            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uDeepColor;
          uniform vec3 uPrimaryColor;
          uniform vec3 uAccentColor;
          uniform vec3 uCrestColor;
          varying float vElevation;
          varying vec2 vWorldXZ;
          varying vec2 vUv;

          void main() {
            float h = clamp((vElevation + 2.4) / 4.8, 0.0, 1.0);

            // Flowing cyan/cobalt/azure bands shifting along the moving terrain
            float flowBand = sin(vWorldXZ.x * 0.12 - vWorldXZ.y * 0.08 - uTime * 1.6) * 0.5 + 0.5;
            vec3 base = mix(uDeepColor, uPrimaryColor, smoothstep(0.18, 0.78, h));
            base = mix(base, uAccentColor, smoothstep(0.45, 0.95, h) * (0.45 + 0.55 * flowBand));

            // Glowing topographic grid lines moving smoothly across the 3D surface
            vec2 gridCoord = (vWorldXZ + vec2(0.0, -uTime * 2.8)) * 0.38;
            vec2 gridFrac = abs(fract(gridCoord - 0.5) - 0.5);
            float lineX = 1.0 - smoothstep(0.012, 0.052, gridFrac.x);
            float lineY = 1.0 - smoothstep(0.012, 0.052, gridFrac.y);
            float line = max(lineX, lineY);
            float crestGlow = smoothstep(0.62, 1.0, h);

            vec3 col = base * 0.82 + uAccentColor * line * 0.52 + uCrestColor * (crestGlow * 0.42 + line * crestGlow * 0.65);

            // Smooth radial horizon fade into fog
            float dist = length(vWorldXZ) / 56.0;
            float alpha = clamp((1.0 - smoothstep(0.55, 1.0, dist)) * (0.38 + h * 0.34 + line * 0.35), 0.0, 0.92);

            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      })
    )

    const waveMesh = new THREE.Mesh(waveGeo, waveMat)
    waveMesh.position.y = 0.55
    scene.add(waveMesh)

    // 4. CONTINUOUSLY UNDULATING 3D MONOLITH TERRAIN (32 x 32 = 1,024 animated pillars)
    const gridSize = 32
    const monolithCount = gridSize * gridSize
    const boxGeo = trackDisposable(new THREE.BoxGeometry(0.96, 1, 0.96))
    boxGeo.translate(0, 0.5, 0)

    const blockMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: 0x10203d,
        roughness: 0.24,
        metalness: 0.82,
        envMapIntensity: 1.35,
      })
    )

    const instancedTerrain = new THREE.InstancedMesh(boxGeo, blockMat, monolithCount)
    instancedTerrain.frustumCulled = false
    const dummy = new THREE.Object3D()
    const colorDummy = new THREE.Color()

    const monolithPosX = new Float32Array(monolithCount)
    const monolithPosZ = new Float32Array(monolithCount)
    const monolithBaseH = new Float32Array(monolithCount)
    const monolithPhase = new Float32Array(monolithCount)
    const monolithDist = new Float32Array(monolithCount)

    const halfGrid = gridSize / 2
    let mIdx = 0
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const px = (x - halfGrid) * 1.65
        const pz = (z - halfGrid) * 1.65
        const dist = Math.sqrt(px * px + pz * pz)

        monolithPosX[mIdx] = px
        monolithPosZ[mIdx] = pz
        monolithDist[mIdx] = dist
        monolithPhase[mIdx] = x * 0.26 + z * 0.22
        monolithBaseH[mIdx] =
          dist < 6.2
            ? 2.2 + ((x * 7 + z * 13) % 10) * 0.26
            : 0.55 + Math.abs(Math.sin(x * 0.32) * Math.cos(z * 0.32)) * 1.85

        dummy.position.set(px, -0.4, pz)
        dummy.scale.set(1, monolithBaseH[mIdx], 1)
        dummy.updateMatrix()
        instancedTerrain.setMatrixAt(mIdx, dummy.matrix)

        colorDummy.setRGB(0.06, 0.14, 0.28)
        instancedTerrain.setColorAt(mIdx, colorDummy)
        mIdx++
      }
    }
    instancedTerrain.instanceMatrix.needsUpdate = true
    if (instancedTerrain.instanceColor) instancedTerrain.instanceColor.needsUpdate = true
    scene.add(instancedTerrain)

    // 5. CYBER TOWERS WITH BREATHING LASER SLITS & 42 ORBITING DATA CUBES
    const towerConfigs = [
      { x: 0, z: 0, s: 1.05, h: 7.4 },
      { x: 15, z: -10, s: 0.85, h: 6.6 },
      { x: -16, z: 12, s: 0.8, h: 6.1 },
      { x: -14, z: -16, s: 0.72, h: 5.8 },
      { x: 20, z: 14, s: 0.68, h: 5.5 },
      { x: 6, z: 22, s: 0.62, h: 5.0 },
      { x: -22, z: -4, s: 0.58, h: 4.9 },
    ]
    const towerCount = towerConfigs.length
    const unitBoxGeo = trackDisposable(new THREE.BoxGeometry(1, 1, 1))

    const towerNodeMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: 0x091429,
        roughness: 0.18,
        metalness: 0.9,
        envMapIntensity: 1.5,
      })
    )
    const towerOuterGlowMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2]),
      })
    )
    const towerInnerGlowMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2]),
      })
    )

    const instancedPillars = new THREE.InstancedMesh(unitBoxGeo, towerNodeMat, towerCount)
    const instancedOuterSlits = new THREE.InstancedMesh(unitBoxGeo, towerOuterGlowMat, towerCount)
    const instancedInnerSlits = new THREE.InstancedMesh(unitBoxGeo, towerInnerGlowMat, towerCount)
    instancedPillars.frustumCulled = false
    instancedOuterSlits.frustumCulled = false
    instancedInnerSlits.frustumCulled = false

    scene.add(instancedPillars)
    scene.add(instancedOuterSlits)
    scene.add(instancedInnerSlits)

    const totalSatelliteCubes = towerCount * 6
    const satelliteMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
      })
    )
    const instancedSatelliteCubes = new THREE.InstancedMesh(
      unitBoxGeo,
      satelliteMat,
      totalSatelliteCubes
    )
    instancedSatelliteCubes.frustumCulled = false

    type SatelliteMeta = {
      towerX: number
      towerZ: number
      towerScale: number
      baseY: number
      angle: number
      radius: number
      isGlow: boolean
      accentMix: number
      orbitSpeed: number
    }
    const satelliteMeta: SatelliteMeta[] = []
    const darkSatColor = new THREE.Color(0x0b1a36)

    let satIdx = 0
    towerConfigs.forEach((t, tIdx) => {
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2
        const rad = (2.0 + (i % 2) * 0.65) * t.s
        const isGlow = i % 2 === 0
        const baseY = (t.h * 0.58 + (i % 3) * 0.85) * t.s
        const accentMix = ((tIdx + i) % 3) * 0.35

        satelliteMeta.push({
          towerX: t.x,
          towerZ: t.z,
          towerScale: t.s,
          baseY,
          angle,
          radius: rad,
          isGlow,
          accentMix,
          orbitSpeed: (i % 2 === 0 ? 0.65 : -0.48) * (0.9 + (tIdx % 3) * 0.14),
        })

        if (isGlow) {
          colorDummy.setRGB(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2])
        } else {
          colorDummy.copy(darkSatColor)
        }
        instancedSatelliteCubes.setColorAt(satIdx, colorDummy)
        satIdx++
      }
    })
    if (instancedSatelliteCubes.instanceColor) instancedSatelliteCubes.instanceColor.needsUpdate = true
    scene.add(instancedSatelliteCubes)

    // 6. VOLUMETRIC SWEEPING LIGHT BEAMS / ENERGY RIBBONS
    const wallUniforms = {
      uTime: { value: 0 },
      uColorDark: {
        value: new THREE.Color(initPhase.glow[0] * 1.4, initPhase.glow[1] * 1.4, initPhase.glow[2] * 1.4),
      },
      uColorMid: { value: new THREE.Color(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2]) },
      uColorCore: { value: new THREE.Color(initPhase.c3[0], initPhase.c3[1], initPhase.c3[2]) },
    }

    const laserShaderMat = trackDisposable(
      new THREE.ShaderMaterial({
        uniforms: wallUniforms,
        vertexShader: `
          varying vec2 vUv;
          uniform float uTime;
          void main() {
            vUv = uv;
            vec3 pos = position;
            pos.y += sin(pos.x * 0.22 - uTime * 3.1) * 0.48;
            pos.z += cos(pos.x * 0.16 - uTime * 2.2) * 0.42;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uColorDark;
          uniform vec3 uColorMid;
          uniform vec3 uColorCore;
          varying vec2 vUv;

          void main() {
            float fastStreams = sin(vUv.x * 48.0 - uTime * 9.5) * 0.5 + 0.5;
            float pulseWaves = sin(vUv.x * 10.0 - uTime * 3.8) * 0.5 + 0.5;

            float beamCore = pow(sin(vUv.y * 3.14159), 2.0);
            float thinIntense = pow(sin(vUv.y * 3.14159), 7.5) * 2.0;

            vec3 col = mix(uColorDark, uColorMid, vUv.y);
            col = mix(col, uColorCore, clamp(thinIntense + fastStreams * 0.36, 0.0, 1.0));

            float alpha = (beamCore * 0.72 + fastStreams * 0.20) * (0.78 + pulseWaves * 0.22);
            gl_FragColor = vec4(col * 1.5, alpha);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )

    const beamSpecs = [
      { len: 54, h: 6.4, x: -12, y: 1.4, z: -6, rotY: -Math.PI * 0.22, scale: 1.0 },
      { len: 46, h: 5.4, x: -16, y: 1.2, z: 10, rotY: Math.PI * 0.36, scale: 0.9 },
      { len: 58, h: 4.8, x: -24, y: 1.0, z: -18, rotY: -Math.PI * 0.06, scale: 1.0 },
      { len: 48, h: 5.2, x: -8, y: 2.2, z: 16, rotY: -Math.PI * 0.42, scale: 0.85 },
    ]
    const laserWalls: THREE.Mesh[] = []
    for (const spec of beamSpecs) {
      const geo = trackDisposable(new THREE.PlaneGeometry(spec.len, spec.h, 44, 1))
      geo.translate(spec.len / 2, spec.h / 2, 0)
      const mesh = new THREE.Mesh(geo, laserShaderMat)
      mesh.position.set(spec.x, spec.y, spec.z)
      mesh.rotation.y = spec.rotY
      mesh.scale.set(spec.scale, spec.scale, 1)
      scene.add(mesh)
      laserWalls.push(mesh)
    }

    // 7. 900 FLOWING LUMINOUS PARTICLES / HELICAL RISING BLUE EMBERS
    const particleCount = 900
    const particleGeo = trackDisposable(new THREE.BufferGeometry())
    const particlePos = new Float32Array(particleCount * 3)
    const particleBaseX = new Float32Array(particleCount)
    const particleBaseZ = new Float32Array(particleCount)
    const particleSpeed = new Float32Array(particleCount)
    const particleSeed = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      const px = (Math.random() - 0.5) * 68
      const py = Math.random() * 26
      const pz = (Math.random() - 0.5) * 68
      particlePos[i * 3] = px
      particlePos[i * 3 + 1] = py
      particlePos[i * 3 + 2] = pz
      particleBaseX[i] = px
      particleBaseZ[i] = pz
      particleSpeed[i] = 1.4 + Math.random() * 2.2
      particleSeed[i] = Math.random() * Math.PI * 2
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3))

    const particleMat = trackDisposable(
      new THREE.PointsMaterial({
        color: new THREE.Color(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2]),
        size: 0.24,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    const particles = new THREE.Points(particleGeo, particleMat)
    particles.frustumCulled = false
    scene.add(particles)

    // 8. PASSIVE POINTER & SCROLL INPUTS
    let mouseX = 0
    let mouseY = 0
    let scrollY = 0

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY
      const nx = (clientX / (window.innerWidth || 1)) * 2 - 1
      const ny = -(clientY / (window.innerHeight || 1)) * 2 + 1
      mouseX = nx * 5.2
      mouseY = ny * 3.4
    }

    const onScroll = () => {
      scrollY = window.scrollY || document.documentElement.scrollTop || 0
    }

    window.addEventListener("mousemove", onPointerMove, { passive: true })
    window.addEventListener("touchmove", onPointerMove, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })

    // 9. TAB VISIBILITY PAUSE ONLY (NEVER use IntersectionObserver on fixed inset-0!)
    let isTabActive = typeof document !== "undefined" ? !document.hidden : true
    const onVisibilityChange = () => {
      isTabActive = !document.hidden
      if (isTabActive) {
        lastFrameNow = performance.now()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    // Pre-allocated math objects (zero GC churn inside render loop)
    const rotationEuler = new THREE.Euler()
    const rotQuat = new THREE.Quaternion()
    const cubeScaleVec = new THREE.Vector3()
    const c1Color = new THREE.Color()
    const c2Color = new THREE.Color()
    const c3Color = new THREE.Color()
    const bgTintColor = new THREE.Color()
    const deepTintColor = new THREE.Color()
    const tempBlockColor = new THREE.Color()
    const tempSatColor = new THREE.Color()
    const baseDarkBlock = new THREE.Color(0x07132b)

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const motionRate = prefersReducedMotion ? 0.35 : 1.0

    const baseCamX = 16.5
    const baseCamY = 15.5
    const baseCamZ = 27.0

    let frameId = 0
    let softwareTimerId = 0
    let lastFrameNow = performance.now()
    let motionElapsed = 0

    function afterDraw(cb: () => void) {
      if (isDisposed || contextLost) return
      const gl = renderer.getContext()
      if (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext) {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        gl.flush()
        const poll = () => {
          if (isDisposed || contextLost) {
            if (sync) gl.deleteSync(sync)
            return
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS)
          if (state === gl.UNSIGNALED) {
            softwareTimerId = window.setTimeout(poll, 8)
          } else {
            if (sync) gl.deleteSync(sync)
            softwareTimerId = window.setTimeout(cb, 60)
          }
        }
        softwareTimerId = window.setTimeout(poll, 8)
      } else {
        softwareTimerId = window.setTimeout(cb, 70)
      }
    }

    const scheduleNext = () => {
      if (isDisposed || contextLost) return
      if (isSoftwareGl) {
        afterDraw(renderFrame)
      } else {
        frameId = window.requestAnimationFrame(renderFrame)
      }
    }

    const renderFrame = () => {
      if (isDisposed || contextLost) return

      const now = performance.now()
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameNow) / 1000))
      lastFrameNow = now

      if (!isTabActive) {
        frameId = window.requestAnimationFrame(renderFrame)
        return
      }

      motionElapsed += dt * motionRate
      const colorElapsed =
        sharedStartMsRef.current !== null
          ? Math.max(0, (now - sharedStartMsRef.current) / 1000) * (prefersReducedMotion ? 0.5 : 1.0)
          : motionElapsed

      const phase = getAmbientPhaseAt(colorElapsed)

      c1Color.setRGB(phase.c1[0], phase.c1[1], phase.c1[2])
      c2Color.setRGB(phase.c2[0], phase.c2[1], phase.c2[2])
      c3Color.setRGB(phase.c3[0], phase.c3[1], phase.c3[2])
      deepTintColor.setRGB(
        phase.bgB[0] * 1.45,
        phase.bgB[1] * 1.65,
        phase.bgB[2] * 1.95
      )

      // Atmospheric background & horizon fog shift seamlessly across blue tones
      bgTintColor.setRGB(
        STAGE_BASE_NORM[0] + phase.bgB[0] * 0.42,
        STAGE_BASE_NORM[1] + phase.bgB[1] * 0.42,
        STAGE_BASE_NORM[2] + phase.bgB[2] * 0.48
      )
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(bgTintColor)
      }
      fog.color.copy(bgTintColor)

      // Synchronized blue-spectrum lights + orbital point-light movement
      hemiLight.color.copy(c2Color)
      hemiLight.groundColor.copy(bgTintColor)
      dirKey.color.copy(c1Color)
      dirRim.color.copy(c2Color)

      coreLight1.color.copy(c1Color)
      coreLight1.intensity = 11.5 + Math.sin(motionElapsed * 2.6) * 3.4
      coreLight1.position.x = Math.sin(motionElapsed * 0.55) * 6.5
      coreLight1.position.z = Math.cos(motionElapsed * 0.48) * 6.5

      coreLight2.color.copy(c2Color)
      coreLight2.intensity = 9.2 + Math.cos(motionElapsed * 2.2) * 2.8
      coreLight2.position.x = 14 + Math.cos(motionElapsed * 0.42) * 5.0
      coreLight2.position.z = -10 + Math.sin(motionElapsed * 0.5) * 5.0

      coreLight3.color.copy(c1Color).lerp(c2Color, 0.45)
      coreLight3.intensity = 8.4 + Math.sin(motionElapsed * 1.9 + 1.2) * 2.5

      // Update flowing 3D wave ocean shader
      waveUniforms.uTime.value = motionElapsed
      waveUniforms.uDeepColor.value.copy(deepTintColor)
      waveUniforms.uPrimaryColor.value.copy(c1Color)
      waveUniforms.uAccentColor.value.copy(c2Color)
      waveUniforms.uCrestColor.value.copy(c3Color)

      // Update undulating 3D monolith pillars every frame (genuinely alive terrain waves!)
      for (let i = 0; i < monolithCount; i++) {
        const px = monolithPosX[i]
        const pz = monolithPosZ[i]
        const dist = monolithDist[i]
        const wave =
          Math.sin(px * 0.14 - motionElapsed * 1.45) *
            Math.cos(pz * 0.14 - motionElapsed * 1.15) *
            1.15 +
          Math.sin(dist * 0.24 - motionElapsed * 1.9) * 0.65

        const h = Math.max(0.28, monolithBaseH[i] + wave)
        dummy.position.set(px, -0.4, pz)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, h, 1)
        dummy.updateMatrix()
        instancedTerrain.setMatrixAt(i, dummy.matrix)

        const crest = Math.max(0, Math.min(1, (h - 1.1) / 3.4))
        tempBlockColor.copy(baseDarkBlock).lerp(c1Color, crest * 0.52).lerp(c2Color, crest * crest * 0.48)
        instancedTerrain.setColorAt(i, tempBlockColor)
      }
      instancedTerrain.instanceMatrix.needsUpdate = true
      if (instancedTerrain.instanceColor) instancedTerrain.instanceColor.needsUpdate = true

      // Update breathing cyber towers & laser slits
      towerOuterGlowMat.color.copy(c1Color)
      towerInnerGlowMat.color.copy(c2Color).lerp(c3Color, 0.45)

      for (let i = 0; i < towerCount; i++) {
        const t = towerConfigs[i]
        const breathe = 1 + Math.sin(motionElapsed * 1.6 + i * 0.9) * 0.08
        const th = t.h * t.s * breathe

        dummy.position.set(t.x, th / 2, t.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1.45 * t.s, th, 1.45 * t.s)
        dummy.updateMatrix()
        instancedPillars.setMatrixAt(i, dummy.matrix)

        dummy.position.set(t.x, th / 2, t.z)
        dummy.scale.set(0.38 * t.s, th * 0.95, 1.54 * t.s)
        dummy.updateMatrix()
        instancedOuterSlits.setMatrixAt(i, dummy.matrix)

        dummy.position.set(t.x, th / 2, t.z)
        dummy.scale.set(0.15 * t.s, th * 0.95, 1.58 * t.s)
        dummy.updateMatrix()
        instancedInnerSlits.setMatrixAt(i, dummy.matrix)
      }
      instancedPillars.instanceMatrix.needsUpdate = true
      instancedOuterSlits.instanceMatrix.needsUpdate = true
      instancedInnerSlits.instanceMatrix.needsUpdate = true

      // Update 42 orbiting satellite data cubes
      for (let k = 0; k < totalSatelliteCubes; k++) {
        const meta = satelliteMeta[k]
        const orbitAngle = meta.angle + motionElapsed * meta.orbitSpeed
        const cubeY = meta.baseY + Math.sin(motionElapsed * 2.4 + k) * 0.35
        const cubeX = meta.towerX + Math.cos(orbitAngle) * meta.radius
        const cubeZ = meta.towerZ + Math.sin(orbitAngle) * meta.radius

        rotationEuler.set(motionElapsed * 0.8 + k * 0.3, motionElapsed * 1.35 + k * 0.5, 0)
        rotQuat.setFromEuler(rotationEuler)
        cubeScaleVec.set(0.68 * meta.towerScale, 0.68 * meta.towerScale, 0.68 * meta.towerScale)

        dummy.position.set(cubeX, cubeY, cubeZ)
        dummy.quaternion.copy(rotQuat)
        dummy.scale.copy(cubeScaleVec)
        dummy.updateMatrix()

        instancedSatelliteCubes.setMatrixAt(k, dummy.matrix)
        if (meta.isGlow) {
          tempSatColor.copy(c1Color).lerp(c2Color, meta.accentMix).lerp(c3Color, 0.18)
          instancedSatelliteCubes.setColorAt(k, tempSatColor)
        }
      }
      instancedSatelliteCubes.instanceMatrix.needsUpdate = true
      if (instancedSatelliteCubes.instanceColor) instancedSatelliteCubes.instanceColor.needsUpdate = true

      // Update sweeping volumetric energy beams
      wallUniforms.uTime.value = motionElapsed
      wallUniforms.uColorDark.value.setRGB(
        phase.glow[0] * 1.5,
        phase.glow[1] * 1.5,
        phase.glow[2] * 1.5
      )
      wallUniforms.uColorMid.value.copy(c1Color).lerp(c2Color, 0.45)
      wallUniforms.uColorCore.value.copy(c3Color)
      laserWalls.forEach((wall, idx) => {
        wall.position.y = 1.1 + idx * 0.25 + Math.sin(motionElapsed * 0.85 + idx * 1.4) * 0.55
      })

      // Update 900 helical rising blue embers
      particleMat.color.copy(c2Color).lerp(c3Color, 0.38)
      const positions = particleGeo.attributes.position.array as Float32Array
      for (let i = 0; i < particleCount; i++) {
        const yIndex = i * 3 + 1
        let y = positions[yIndex] + particleSpeed[i] * dt * motionRate
        if (y > 26) y = 0.2
        positions[yIndex] = y

        const swirl = motionElapsed * 0.55 + particleSeed[i]
        positions[i * 3] = particleBaseX[i] + Math.sin(swirl) * 1.35
        positions[i * 3 + 2] = particleBaseZ[i] + Math.cos(swirl) * 1.35
      }
      particleGeo.attributes.position.needsUpdate = true

      // Autonomous cinematic figure-8 camera glide + exponential-damped mouse & scroll parallax
      const docHeight =
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          window.innerHeight * 2
        ) - window.innerHeight
      const scrollRatio = Math.min(scrollY / Math.max(docHeight, 1), 1)

      const targetX =
        baseCamX +
        mouseX +
        Math.sin(motionElapsed * 0.28) * 6.4 +
        scrollRatio * 7.5
      const targetY =
        baseCamY +
        mouseY -
        scrollRatio * 6.2 +
        Math.cos(motionElapsed * 0.22) * 2.4
      const targetZ =
        baseCamZ -
        scrollRatio * 5.5 +
        Math.cos(motionElapsed * 0.19) * 4.4

      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX, 3.2, dt)
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 3.2, dt)
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.2, dt)
      camera.lookAt(
        Math.sin(motionElapsed * 0.18) * 2.2 + scrollRatio * 3.5,
        2.0 + Math.cos(motionElapsed * 0.24) * 0.6,
        Math.cos(motionElapsed * 0.16) * 2.0 - scrollRatio * 3.5
      )

      renderer.render(scene, camera)
      scheduleNext()
    }

    // Start animation immediately
    renderFrame()

    // Responsive resize handler
    let resizeTimeout: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        if (isDisposed || contextLost) return
        width = Math.max(window.innerWidth, 1)
        height = Math.max(window.innerHeight, 1)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height)
      }, 60)
    }

    window.addEventListener("resize", handleResize, { passive: true })

    // Clean GPU & DOM disposal (never forces context loss during React remount)
    return () => {
      isDisposed = true
      clearTimeout(resizeTimeout)
      clearTimeout(softwareTimerId)
      window.cancelAnimationFrame(frameId)
      window.removeEventListener("mousemove", onPointerMove)
      window.removeEventListener("touchmove", onPointerMove)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", handleResize)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      renderer.domElement.removeEventListener("webglcontextlost", onWebglContextLost)

      scene.environment = null
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          ;(obj as THREE.Mesh).geometry.dispose()
        }
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose())
          } else {
            mat.dispose()
          }
        }
      })

      disposables.forEach((item) => {
        try {
          item.dispose()
        } catch {
          // ignore already disposed
        }
      })
      disposables.length = 0

      try {
        renderer.dispose()
      } catch {
        // ignore disposal errors
      }

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [mode])

  // Render 2D Volumetric Flowing Atmosphere (also serves as seamless animated fallback if 3D WebGL is unavailable)
  if (mode !== "3d" || webgl3DFallback) {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden bg-[#020510]"
      >
        {/* Animated CSS volumetric fallback layer */}
        <div
          className="rushx-ambient-canvas absolute inset-0 w-full h-full transition-opacity duration-700"
          style={{ opacity: webgl2DReady ? 0.2 : 1 }}
        >
          <div className="rushx-ambient-glow absolute inset-0 w-full h-full" />
        </div>

        {/* GPU-accelerated Volumetric 2D Flowing Blue-Spectrum Shader Canvas */}
        <canvas
          ref={volumetric2DCanvasRef}
          className="absolute inset-0 h-full w-full block transition-opacity duration-700"
          style={{ opacity: webgl2DReady ? 1 : 0 }}
        />

        {/* Subtle radial edge vignette for crisp foreground readability */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(2,5,16,0.42)_100%)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden bg-[#020510]"
    >
      {/* Isolated Three.js Canvas Mount */}
      <div ref={threeContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Soft edge vignette preserving foreground legibility while keeping 3D visuals vibrant */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_44%,rgba(2,5,16,0.48)_100%)] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
    </div>
  )
}
