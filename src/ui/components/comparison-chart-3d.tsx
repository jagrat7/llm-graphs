import { RiDragMove2Line } from "@remixicon/react"
import { OrbitControls } from "@react-three/drei"
import { Canvas, invalidate, useFrame, useThree } from "@react-three/fiber"
import { type ComponentRef, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"

import type { Metric } from "#/ui/lib/metrics"
import type { ProviderName } from "#/ui/lib/orpc-client"
import type { Model } from "#/ui/lib/registry-view"
import type { PlotAxis, PlotData } from "#/ui/lib/comparison-plot-data"

import { DataState } from "#/ui/components/data-state"
import { PointDetails } from "#/ui/components/point-details"
import { Button } from "#/ui/components/ui/button"
import {
  CHART_ACTIVE_SCALE,
  CHART_AXIS_TITLE_SIZE,
  CHART_GRID_OPACITY,
  CHART_TICK_SIZE,
  CHART_TOOLTIP_CLASS,
  CHART_TOOLTIP_GAP,
  CHART_TOOLTIP_WIDTH,
  chartFontRem,
} from "#/ui/lib/chart-styles"
import { axisTicks, buildPlotData, describePlot } from "#/ui/lib/comparison-plot-data"
import { CHART_HEIGHT_CLASS } from "#/ui/lib/layout-styles"
import { formatMetric, metricAxisTitle, METRIC_CONFIG } from "#/ui/lib/metrics"
import {
  buildSeriesLabels,
  LABEL_COLLISION_GAP,
  LABEL_EFFORT_SIZE,
  LABEL_NAME_SIZE,
} from "#/ui/lib/plot-labels"
import { useThemeColors } from "#/ui/lib/theme-colors"
import { cn } from "#/ui/lib/utils"
import { useReducedMotion } from "#/ui/lib/use-reduced-motion"

/**
 * `in` grows the cube out of the flat 2D framing, `out` collapses it back,
 * `instant` skips straight to the finished perspective for deep links.
 */
export type MorphPhase = "instant" | "in" | "out"

type SphericalView = { yaw: number; pitch: number; radius: number }

type LabelItem = {
  key: string
  text: string
  /** Effort tier drawn under a point label's model name; null for axis furniture. */
  effort?: string | null
  color?: string
  kind: "axis" | "tick" | "point"
  /** Fixed world anchor; points carry one, axis labels resolve theirs per frame. */
  base?: THREE.Vector3
  /** Axis-attached labels ride whichever edge is currently outermost. */
  axis?: PlotAxis
  fraction?: number
  pointId?: string
  /** Every effort variant of the labelled model, so hovering any of them lights it. */
  pointIds?: Set<string>
  fadeWithDepth?: boolean
  /** Pixels to push the label perpendicular to its axis, away from the cube. */
  screenOffset?: number
}

/** Which side of each perpendicular axis an edge sits on, as -1 or 1. */
type EdgeSigns = Record<PlotAxis, number>

/** Shared mutable scene state, kept off React so camera frames never rerender. */
type SceneRefs = {
  depth: number
  activeId: string | null
}

type PlotControls = ComponentRef<typeof OrbitControls>

const AXES = ["x", "y", "z"] as const
const CUBE_HALF = 1
/** Tuned so a point reads at the 2D chart's 10px diameter from the default camera. */
const POINT_RADIUS = 0.026
/** Logo sprites span a sphere's diameter, so switching markers keeps the cube's density. */
const LOGO_SPRITE_SIZE = POINT_RADIUS * 2
/** Logos are rasterized once at this size, then scaled by the GPU. */
const LOGO_TEXTURE_PIXELS = 128
const ACTIVE_POINT_SCALE = CHART_ACTIVE_SCALE
const MORPH_DURATION = 0.7
const PRESET_DURATION = 0.55
const VIEW_RADIUS = 5.4
const ORBIT_VIEW: SphericalView = { yaw: 0.72, pitch: 0.42, radius: VIEW_RADIUS }
/** The camera framing the cube collapses into, matched to the flat 2D plot. */
const MORPH_VIEW: SphericalView = { yaw: 0, pitch: 0, radius: 4 }
const VIEW_PRESETS: Record<string, SphericalView> = {
  Perspective: ORBIT_VIEW,
  Front: { yaw: 0, pitch: 0, radius: VIEW_RADIUS },
  Top: { yaw: 0, pitch: Math.PI / 2 - 0.02, radius: VIEW_RADIUS },
}
const TICK_TARGET = 6
/** Same type scale the 2D chart's SVG axes use. */
const LABEL_SIZES: Record<LabelItem["kind"], number> = {
  axis: CHART_AXIS_TITLE_SIZE,
  tick: CHART_TICK_SIZE,
  point: LABEL_NAME_SIZE,
}
/**
 * Label distances are pixels, not world units. A world-space offset is scaled by
 * perspective, so near labels drift further out than far ones and the column stops
 * reading as a straight line beside the axis.
 */
const TICK_LABEL_PIXELS = 20
const AXIS_TITLE_PIXELS = 54
const POINT_LABEL_MIN_WIDTH = 640
/** Lifts the card so it sits beside the point rather than under the cursor. */
const TOOLTIP_RISE = 56
const TOOLTIP_SAFE_BOTTOM = 190

function viewPosition(view: SphericalView, target = new THREE.Vector3()) {
  const horizontal = view.radius * Math.cos(view.pitch)

  return target.set(
    horizontal * Math.sin(view.yaw),
    view.radius * Math.sin(view.pitch),
    horizontal * Math.cos(view.yaw),
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function easeOutQuart(progress: number) {
  return 1 - (1 - progress) ** 4
}

function unitToScene(unit: number) {
  return (unit - 0.5) * 2 * CUBE_HALF
}

const SIGN_PAIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const

/** A point at `fraction` along one of the four cube edges parallel to `axis`. */
function edgePoint(
  axis: PlotAxis,
  fraction: number,
  signs: EdgeSigns,
  depth: number,
  target: THREE.Vector3,
) {
  const [first, second] = WALL_PLANE[axis]
  const coordinate: EdgeSigns = { x: 0, y: 0, z: 0 }

  coordinate[axis] = unitToScene(fraction)
  coordinate[first] = signs[first] * CUBE_HALF
  coordinate[second] = signs[second] * CUBE_HALF

  return target.set(coordinate.x, coordinate.y, coordinate.z * depth)
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas")

    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"))
  } catch {
    return false
  }
}

/** Ticks sitting on the frame itself would z-fight with the cube edges. */
function interior(fraction: number) {
  return fraction > 0.001 && fraction < 0.999
}

/** The two in-plane axes for a wall named by its normal. */
const WALL_PLANE: Record<PlotAxis, [PlotAxis, PlotAxis]> = {
  x: ["y", "z"],
  y: ["x", "z"],
  z: ["x", "y"],
}
const WALL_SIDES = [-1, 1] as const

/**
 * One wall's grid, ruled at the same tick values the axis labels use so every line
 * lands on a labelled value.
 */
function wallGridPositions(
  normal: PlotAxis,
  side: number,
  fractions: Record<PlotAxis, Array<number>>,
) {
  const positions: Array<number> = []
  const [first, second] = WALL_PLANE[normal]
  const vertex = (firstValue: number, secondValue: number) => {
    const coordinate: Record<PlotAxis, number> = { x: 0, y: 0, z: 0 }

    coordinate[normal] = side * CUBE_HALF
    coordinate[first] = firstValue
    coordinate[second] = secondValue

    positions.push(coordinate.x, coordinate.y, coordinate.z)
  }

  for (const fraction of fractions[first].filter(interior)) {
    vertex(unitToScene(fraction), -CUBE_HALF)
    vertex(unitToScene(fraction), CUBE_HALF)
  }

  for (const fraction of fractions[second].filter(interior)) {
    vertex(-CUBE_HALF, unitToScene(fraction))
    vertex(CUBE_HALF, unitToScene(fraction))
  }

  return new Float32Array(positions)
}

function PlotFrame({
  borderColor,
  gridFractions,
  scene,
}: {
  borderColor: string
  gridFractions: Record<PlotAxis, Array<number>>
  scene: React.RefObject<SceneRefs>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const wallRefs = useRef<Array<THREE.LineSegments | null>>([])
  const appliedDepth = useRef(-1)
  const box = useMemo(() => new THREE.BoxGeometry(2 * CUBE_HALF, 2 * CUBE_HALF, 2 * CUBE_HALF), [])
  const walls = useMemo(
    () =>
      AXES.flatMap((normal) =>
        WALL_SIDES.map((side) => {
          const geometry = new THREE.BufferGeometry()

          geometry.setAttribute(
            "position",
            new THREE.BufferAttribute(wallGridPositions(normal, side, gridFractions), 3),
          )

          return { key: `${normal}${side}`, normal, side, geometry }
        }),
      ),
    [gridFractions],
  )

  useEffect(
    () => () => {
      box.dispose()
      for (const wall of walls) wall.geometry.dispose()
    },
    [box, walls],
  )

  useFrame((state) => {
    const group = groupRef.current

    if (group && appliedDepth.current !== scene.current.depth) {
      appliedDepth.current = scene.current.depth
      group.scale.z = Math.max(scene.current.depth, 0.0001)
    }

    // Only the walls the camera looks at from behind stay ruled, so the grid always
    // sits as a backdrop rather than crossing in front of the data.
    for (const [index, wall] of walls.entries()) {
      const node = wallRefs.current[index]

      if (node) node.visible = state.camera.position[wall.normal] * wall.side < 0
    }
  })

  return (
    <group ref={groupRef}>
      <lineSegments>
        <edgesGeometry args={[box]} />
        <lineBasicMaterial color={borderColor} />
      </lineSegments>
      {walls.map((wall, index) => (
        <lineSegments
          key={wall.key}
          ref={(node) => {
            wallRefs.current[index] = node
          }}
          geometry={wall.geometry}
          visible={false}
        >
          <lineBasicMaterial color={borderColor} transparent opacity={CHART_GRID_OPACITY} />
        </lineSegments>
      ))}
    </group>
  )
}

/**
 * Rasterizes each vendor logo into a white silhouette, so a sprite's colour tints it to the
 * vendor hue. A logo that fails to load keeps its point a sphere.
 */
function useLogoTextures(urls: ReadonlyArray<string>) {
  const [textures, setTextures] = useState<ReadonlyMap<string, THREE.Texture>>(() => new Map())
  const urlKey = urls.join("\n")

  useEffect(() => {
    let cancelled = false
    const loaded = new Map<string, THREE.Texture>()

    for (const url of urlKey === "" ? [] : urlKey.split("\n")) {
      const image = new Image()

      image.addEventListener("load", () => {
        if (cancelled) return

        const canvas = document.createElement("canvas")
        canvas.width = LOGO_TEXTURE_PIXELS
        canvas.height = LOGO_TEXTURE_PIXELS
        const context = canvas.getContext("2d")
        if (!context) return

        const scale = LOGO_TEXTURE_PIXELS / Math.max(image.width || 1, image.height || 1)
        const width = (image.width || 1) * scale
        const height = (image.height || 1) * scale
        context.drawImage(
          image,
          (LOGO_TEXTURE_PIXELS - width) / 2,
          (LOGO_TEXTURE_PIXELS - height) / 2,
          width,
          height,
        )
        context.globalCompositeOperation = "source-in"
        context.fillStyle = "#ffffff"
        context.fillRect(0, 0, LOGO_TEXTURE_PIXELS, LOGO_TEXTURE_PIXELS)

        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        loaded.set(url, texture)
        setTextures(new Map(loaded))
        invalidate()
      })
      image.src = url
    }

    return () => {
      cancelled = true
      for (const texture of loaded.values()) texture.dispose()
      setTextures(new Map())
    }
  }, [urlKey])

  return textures
}

function PlotPoints({
  data,
  positions,
  haloColor,
  resolveColor,
  scene,
  onActivate,
}: {
  data: PlotData
  positions: Array<THREE.Vector3>
  haloColor: string
  resolveColor: (value: string) => string
  scene: React.RefObject<SceneRefs>
  onActivate: (id: string | null) => void
}) {
  const meshesRef = useRef<Array<THREE.Object3D | null>>([])
  const haloRef = useRef<THREE.Mesh>(null)
  const appliedDepth = useRef(-1)
  const geometry = useMemo(() => new THREE.SphereGeometry(POINT_RADIUS, 24, 16), [])
  const haloGeometry = useMemo(() => new THREE.SphereGeometry(POINT_RADIUS * 1.75, 24, 16), [])
  const materials = useMemo(() => {
    const byColor = new Map<string, THREE.MeshBasicMaterial>()

    for (const point of data.points) {
      if (byColor.has(point.color)) continue
      byColor.set(point.color, new THREE.MeshBasicMaterial({ color: resolveColor(point.color) }))
    }

    return byColor
  }, [data, resolveColor])
  const logoUrls = useMemo(
    () =>
      [
        ...new Set(data.points.flatMap((point) => (point.logoUrl ? [point.logoUrl] : []))),
      ].toSorted(),
    [data],
  )
  const textures = useLogoTextures(logoUrls)
  // One sprite material per vendor colour and logo; the texture is white, so colour tints it.
  const spriteMaterials = useMemo(() => {
    const byMarker = new Map<string, THREE.SpriteMaterial>()

    for (const point of data.points) {
      const texture = point.logoUrl ? textures.get(point.logoUrl) : undefined
      const key = `${point.color}\n${point.logoUrl}`
      if (!texture || byMarker.has(key)) continue

      byMarker.set(
        key,
        new THREE.SpriteMaterial({
          map: texture,
          color: resolveColor(point.color),
          transparent: true,
          alphaTest: 0.1,
        }),
      )
    }

    return byMarker
  }, [data, resolveColor, textures])
  // `<line>` collides with the SVG intrinsic element, so the runs are plain three
  // objects mounted through `<primitive>`.
  const seriesLines = useMemo(
    () =>
      data.series
        .filter((series) => series.points.length > 1)
        .map((series) => {
          const bufferGeometry = new THREE.BufferGeometry()
          const attribute = new THREE.BufferAttribute(new Float32Array(series.points.length * 3), 3)

          for (const [pointIndex, point] of series.points.entries()) {
            const position = positions[point.index]

            attribute.setXYZ(pointIndex, position.x, position.y, position.z * scene.current.depth)
          }

          bufferGeometry.setAttribute("position", attribute)
          bufferGeometry.computeBoundingSphere()

          const object = new THREE.Line(
            bufferGeometry,
            new THREE.LineBasicMaterial({
              color: resolveColor(series.color),
              transparent: true,
              opacity: 0.55,
            }),
          )

          return { series, object, attribute }
        }),
    [data, positions, resolveColor, scene],
  )
  useEffect(
    () => () => {
      geometry.dispose()
      haloGeometry.dispose()
      for (const material of materials.values()) material.dispose()
      for (const entry of seriesLines) {
        entry.object.geometry.dispose()
        entry.object.material.dispose()
      }
    },
    [geometry, haloGeometry, materials, seriesLines],
  )
  // Sprite materials turn over as each logo loads; that must not dispose the spheres and lines.
  useEffect(
    () => () => {
      for (const material of spriteMaterials.values()) material.dispose()
    },
    [spriteMaterials],
  )

  useFrame(() => {
    const depth = scene.current.depth
    const activeId = scene.current.activeId
    let needsFrame = false

    if (appliedDepth.current !== depth) {
      appliedDepth.current = depth

      for (const [index, mesh] of meshesRef.current.entries()) {
        const position = positions[index]

        if (mesh && position) mesh.position.set(position.x, position.y, position.z * depth)
      }

      for (const entry of seriesLines) {
        for (const [pointIndex, point] of entry.series.points.entries()) {
          const position = positions[point.index]

          entry.attribute.setXYZ(pointIndex, position.x, position.y, position.z * depth)
        }
        entry.attribute.needsUpdate = true
        entry.object.geometry.computeBoundingSphere()
        entry.object.visible = true
      }
    }

    // Hover growth eases in refs so a hovered point never triggers a React render loop.
    for (const [index, mesh] of meshesRef.current.entries()) {
      if (!mesh) continue

      // Sprites carry their size in their scale; spheres carry it in their geometry.
      const base = mesh instanceof THREE.Sprite ? LOGO_SPRITE_SIZE : 1
      const target = data.points[index]?.id === activeId ? ACTIVE_POINT_SCALE : 1
      const next = THREE.MathUtils.lerp(mesh.scale.x / base, target, 0.24)

      if (Math.abs(next - target) < 0.002) mesh.scale.setScalar(target * base)
      else {
        mesh.scale.setScalar(next * base)
        needsFrame = true
      }
    }

    const halo = haloRef.current

    if (halo) {
      const activeIndex = activeId == null ? -1 : (data.pointById.get(activeId)?.index ?? -1)
      const position = activeIndex === -1 ? null : positions[activeIndex]

      halo.visible = position != null
      if (position) halo.position.set(position.x, position.y, position.z * depth)
    }

    if (needsFrame) invalidate()
  })

  return (
    <group>
      {seriesLines.map((entry) => (
        <primitive key={entry.series.key} object={entry.object} />
      ))}

      {data.points.map((point, index) => {
        const position: [number, number, number] = [
          positions[index].x,
          positions[index].y,
          positions[index].z * scene.current.depth,
        ]
        const spriteMaterial = spriteMaterials.get(`${point.color}\n${point.logoUrl}`)
        const pointer = {
          onPointerOver: (event: { stopPropagation: () => void }) => {
            event.stopPropagation()
            document.body.style.cursor = "pointer"
            onActivate(point.id)
          },
          onPointerOut: () => {
            document.body.style.cursor = ""
            onActivate(null)
          },
          onClick: (event: { stopPropagation: () => void }) => {
            event.stopPropagation()
            onActivate(point.id)
          },
        }
        const ref = (node: THREE.Object3D | null) => {
          meshesRef.current[index] = node
        }

        // Sprites always face the camera, so a logo reads the same from any orbit angle.
        return spriteMaterial ? (
          <sprite
            key={point.id}
            ref={ref}
            material={spriteMaterial}
            position={position}
            scale={LOGO_SPRITE_SIZE}
            {...pointer}
          />
        ) : (
          <mesh
            key={point.id}
            ref={ref}
            geometry={geometry}
            material={materials.get(point.color)}
            position={position}
            {...pointer}
          />
        )
      })}

      <mesh ref={haloRef} geometry={haloGeometry} visible={false}>
        <meshBasicMaterial color={haloColor} transparent opacity={0.3} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

/**
 * Owns every animated camera value. Runs entirely on refs and `invalidate()`, so the
 * WebGL loop stops the moment the cube settles.
 */
function CameraDirector({
  controls,
  onExitComplete,
  phase,
  preset,
  reduceMotion,
  scene,
}: {
  controls: React.RefObject<PlotControls | null>
  onExitComplete?: () => void
  phase: MorphPhase
  /** The nonce re-fires the tween when the same preset is picked again after a drag. */
  preset: { name: string; nonce: number }
  reduceMotion: boolean
  scene: React.RefObject<SceneRefs>
}) {
  const camera = useThree((state) => state.camera)
  const exitCompleteRef = useRef(onExitComplete)
  const firstPreset = useRef(true)
  const tween = useRef({
    active: false,
    elapsed: 0,
    duration: MORPH_DURATION,
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    fromDepth: 1,
    toDepth: 1,
    settlesFlat: false,
  })

  exitCompleteRef.current = onExitComplete

  function start(view: SphericalView, depth: number, duration: number, settlesFlat = false) {
    const current = tween.current

    current.from.copy(camera.position)
    viewPosition(view, current.to)
    current.fromDepth = scene.current.depth
    current.toDepth = depth
    current.elapsed = 0
    current.duration = duration
    current.settlesFlat = settlesFlat
    current.active = true
    invalidate()
  }

  function settle(view: SphericalView, depth: number) {
    viewPosition(view, camera.position)
    camera.lookAt(0, 0, 0)
    scene.current.depth = depth
    controls.current?.update()
    invalidate()
  }

  useEffect(() => {
    if (phase === "instant") return

    const view = phase === "out" ? MORPH_VIEW : ORBIT_VIEW
    const depth = phase === "out" ? 0 : 1

    if (reduceMotion) {
      settle(view, depth)
      if (phase === "out") exitCompleteRef.current?.()
      return
    }

    start(view, depth, MORPH_DURATION, phase === "out")
    // The tween reads the live camera, so only the phase should restart it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduceMotion])

  useEffect(() => {
    // The mounted camera already sits at its preset; only later picks should animate.
    if (firstPreset.current) {
      firstPreset.current = false
      return
    }

    const view = VIEW_PRESETS[preset.name]

    if (!view) return

    // A preset picked mid-entrance wins, and still finishes opening the cube.
    const targetDepth = phase === "out" ? 0 : 1

    if (reduceMotion) {
      settle(view, targetDepth)
      return
    }

    start(view, targetDepth, PRESET_DURATION)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  useFrame((_state, delta) => {
    const current = tween.current

    if (!current.active) return

    current.elapsed += delta
    const progress = Math.min(1, current.elapsed / current.duration)
    const eased = easeOutQuart(progress)

    if (controls.current) controls.current.enabled = false
    camera.position.lerpVectors(current.from, current.to, eased)
    camera.lookAt(0, 0, 0)
    scene.current.depth = current.fromDepth + (current.toDepth - current.fromDepth) * eased

    if (progress === 1) {
      current.active = false
      if (controls.current) {
        controls.current.enabled = true
        controls.current.update()
      }
      if (current.settlesFlat) exitCompleteRef.current?.()
    }

    invalidate()
  })

  return null
}

/**
 * Picks which of the four cube edges parallel to `axis` currently sits furthest
 * outside the silhouette, measured perpendicular to the axis on screen. That is the
 * edge the back-wall grid lines run to, so labels track the walls as they flip.
 */
function chooseAxisEdge(
  axis: PlotAxis,
  depth: number,
  camera: THREE.Camera,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  probeStart: THREE.Vector3,
  probeEnd: THREE.Vector3,
  out: EdgeSigns,
) {
  const [first, second] = WALL_PLANE[axis]
  const candidate: EdgeSigns = { x: 0, y: 0, z: 0 }
  let bestDistance = -Infinity

  for (const [firstSign, secondSign] of SIGN_PAIRS) {
    candidate[first] = firstSign
    candidate[second] = secondSign

    edgePoint(axis, 0, candidate, depth, probeStart).project(camera)
    edgePoint(axis, 1, candidate, depth, probeEnd).project(camera)

    const startX = (probeStart.x * 0.5 + 0.5) * width
    const startY = (-probeStart.y * 0.5 + 0.5) * height
    const endX = (probeEnd.x * 0.5 + 0.5) * width
    const endY = (-probeEnd.y * 0.5 + 0.5) * height
    const deltaX = endX - startX
    const deltaY = endY - startY
    const length = Math.hypot(deltaX, deltaY) || 1
    // Displacement along the axis is the same for every candidate, so only the
    // perpendicular component separates them.
    const distance = Math.abs(
      (-deltaY / length) * ((startX + endX) / 2 - centerX) +
        (deltaX / length) * ((startY + endY) / 2 - centerY),
    )

    if (distance > bestDistance) {
      bestDistance = distance
      out[first] = firstSign
      out[second] = secondSign
      out[axis] = 0
    }
  }
}

/**
 * Projects label anchors to screen space and writes transforms straight to the DOM.
 * Keeping text in HTML gives crisp theme typography without an `<Html>` per point and
 * without a React render per frame.
 */
function LabelProjector({
  items,
  nodes,
  scene,
}: {
  items: Array<LabelItem>
  nodes: React.RefObject<Array<HTMLElement | null>>
  scene: React.RefObject<SceneRefs>
}) {
  const sizes = useRef<Array<[number, number] | null>>([])
  const anchor = useMemo(() => new THREE.Vector3(), [])
  const alongStart = useMemo(() => new THREE.Vector3(), [])
  const alongEnd = useMemo(() => new THREE.Vector3(), [])
  const origin = useMemo(() => new THREE.Vector3(), [])
  const probeStart = useMemo(() => new THREE.Vector3(), [])
  const probeEnd = useMemo(() => new THREE.Vector3(), [])
  const edges = useMemo<Record<PlotAxis, EdgeSigns>>(
    () => ({ x: { x: 0, y: 0, z: 0 }, y: { x: 0, y: 0, z: 0 }, z: { x: 0, y: 0, z: 0 } }),
    [],
  )

  useEffect(() => {
    sizes.current = items.map(() => null)
    invalidate()
  }, [items])

  useFrame((state) => {
    const depth = scene.current.depth
    const activeId = scene.current.activeId
    const { width, height } = state.size
    const placed: Array<{ left: number; right: number; top: number; bottom: number }> = []

    origin.set(0, 0, 0).project(state.camera)
    const centerX = (origin.x * 0.5 + 0.5) * width
    const centerY = (-origin.y * 0.5 + 0.5) * height

    for (const axis of AXES) {
      chooseAxisEdge(
        axis,
        depth,
        state.camera,
        width,
        height,
        centerX,
        centerY,
        probeStart,
        probeEnd,
        edges[axis],
      )
    }

    const order = items
      .map((item, index) => {
        const signs = item.axis == null ? null : edges[item.axis]

        if (item.axis != null && signs) {
          edgePoint(item.axis, item.fraction ?? 0.5, signs, depth, anchor)
        } else if (item.base) {
          anchor.set(item.base.x, item.base.y, item.base.z * depth)
        }
        anchor.project(state.camera)

        let screenX = (anchor.x * 0.5 + 0.5) * width
        let screenY = (-anchor.y * 0.5 + 0.5) * height
        let angle = 0

        if (item.axis != null && signs) {
          edgePoint(item.axis, 0, signs, depth, alongStart).project(state.camera)
          edgePoint(item.axis, 1, signs, depth, alongEnd).project(state.camera)

          const deltaX = (alongEnd.x - alongStart.x) * 0.5 * width
          const deltaY = -(alongEnd.y - alongStart.y) * 0.5 * height
          const length = Math.hypot(deltaX, deltaY) || 1
          // Perpendicular to the axis in screen space, pointing away from the cube.
          const awayX = -deltaY / length
          const awayY = deltaX / length
          const sign = awayX * (screenX - centerX) + awayY * (screenY - centerY) >= 0 ? 1 : -1
          const distance = item.screenOffset ?? 0

          screenX += awayX * sign * distance
          screenY += awayY * sign * distance

          if (item.kind === "axis") {
            const tilt = (Math.atan2(deltaY, deltaX) * 180) / Math.PI

            // Flip past vertical so the title never reads upside down.
            angle = tilt > 90 ? tilt - 180 : tilt < -90 ? tilt + 180 : tilt
          }
        }

        return {
          index,
          item,
          screenX,
          screenY,
          angle,
          // Points sort back-to-front; axis furniture always wins a slot.
          rank: item.kind === "point" ? anchor.z : -1,
          behind: anchor.z > 1,
        }
      })
      .toSorted((left, right) => left.rank - right.rank)

    for (const entry of order) {
      const node = nodes.current[entry.index]

      if (!node) continue

      sizes.current[entry.index] ??= [node.offsetWidth, node.offsetHeight]
      const [measuredWidth, measuredHeight] = sizes.current[entry.index] ?? [0, 0]
      // A steeply rotated title occupies its own bounding box turned on its side.
      const upright = Math.abs(entry.angle) < 45
      const labelWidth = upright ? measuredWidth : measuredHeight
      const labelHeight = upright ? measuredHeight : measuredWidth
      const isActive = activeId != null && (entry.item.pointIds?.has(activeId) ?? false)
      const box = {
        left: entry.screenX - labelWidth / 2,
        right: entry.screenX + labelWidth / 2,
        top: entry.screenY - labelHeight / 2,
        bottom: entry.screenY + labelHeight / 2,
      }
      const offscreen =
        entry.behind || box.right < 0 || box.left > width || box.bottom < 0 || box.top > height
      const collides =
        !isActive &&
        placed.some(
          (other) =>
            box.left < other.right + LABEL_COLLISION_GAP &&
            box.right > other.left - LABEL_COLLISION_GAP &&
            box.top < other.bottom + LABEL_COLLISION_GAP &&
            box.bottom > other.top - LABEL_COLLISION_GAP,
        )
      const visible = !offscreen && !collides
      const opacity = entry.item.fadeWithDepth ? depth : 1

      if (visible) placed.push(box)

      node.style.transform = `translate3d(${entry.screenX.toFixed(1)}px, ${entry.screenY.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${entry.angle.toFixed(2)}deg)`
      node.style.opacity = visible ? String(opacity) : "0"
      node.dataset.active = String(isActive)
    }
  })

  return null
}

/**
 * Pins the floating detail card beside the active point, matching the 2D chart's
 * popover. Written straight to the DOM so the card tracks the camera without a
 * React render per frame.
 */
function TooltipAnchor({
  card,
  data,
  positions,
  scene,
}: {
  card: React.RefObject<HTMLDivElement | null>
  data: PlotData
  positions: Array<THREE.Vector3>
  scene: React.RefObject<SceneRefs>
}) {
  const anchor = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    const node = card.current

    if (!node) return

    const activeId = scene.current.activeId
    const index = activeId == null ? -1 : (data.pointById.get(activeId)?.index ?? -1)
    const position = index === -1 ? null : positions[index]

    if (!position) {
      node.style.opacity = "0"

      return
    }

    anchor.set(position.x, position.y, position.z * scene.current.depth)
    anchor.project(state.camera)

    const { width, height } = state.size
    const screenX = (anchor.x * 0.5 + 0.5) * width
    const screenY = (-anchor.y * 0.5 + 0.5) * height
    // Flips to the inside edge so the card never leaves the plot frame.
    const left = clamp(
      screenX +
        (screenX > width / 2 ? -(CHART_TOOLTIP_WIDTH + CHART_TOOLTIP_GAP) : CHART_TOOLTIP_GAP),
      8,
      Math.max(8, width - CHART_TOOLTIP_WIDTH - 8),
    )
    const top = clamp(screenY - TOOLTIP_RISE, 8, Math.max(8, height - TOOLTIP_SAFE_BOTTOM))

    node.style.transform = `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)`
    node.style.opacity = anchor.z > 1 ? "0" : "1"
  })

  return null
}

export function ComparisonChart3D({
  models,
  metrics,
  sources,
  phase = "instant",
  onExitComplete,
}: {
  models: Array<Model>
  metrics: Record<"x" | "y" | "z", Metric>
  sources: Record<"x" | "y" | "z", ProviderName | null>
  phase?: MorphPhase
  onExitComplete?: () => void
}) {
  const reduceMotion = useReducedMotion()
  const { colors, resolve } = useThemeColors()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [preset, setPreset] = useState({ name: "Perspective", nonce: 0 })
  const [webgl, setWebgl] = useState<boolean | null>(null)
  const [showPointLabels, setShowPointLabels] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const labelNodes = useRef<Array<HTMLElement | null>>([])
  const tooltipCard = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<PlotControls>(null)
  const data = useMemo(() => buildPlotData(models, metrics), [metrics, models])
  const startsFlat = phase === "in" && !reduceMotion
  const sceneRef = useRef<SceneRefs>({ depth: startsFlat ? 0 : 1, activeId: null })
  const positions = useMemo(
    () =>
      data.points.map(
        (point) =>
          new THREE.Vector3(
            unitToScene(point.unit.x),
            unitToScene(point.unit.y),
            unitToScene(point.unit.z),
          ),
      ),
    [data],
  )
  const axisTickFractions = useMemo(() => {
    const fractions: Record<PlotAxis, Array<number>> = { x: [], y: [], z: [] }

    for (const axis of AXES) {
      const domain = data.domains[axis]
      const span = domain.max - domain.min

      fractions[axis] = axisTicks(domain, TICK_TARGET).map((value) =>
        span === 0 ? 0.5 : (value - domain.min) / span,
      )
    }

    return fractions
  }, [data])
  const labelItems = useMemo<Array<LabelItem>>(() => {
    const items: Array<LabelItem> = []

    for (const axis of AXES) {
      const metric = metrics[axis]
      const domain = data.domains[axis]
      const span = domain.max - domain.min
      const fadeWithDepth = axis === "z"

      items.push({
        key: `axis-${axis}`,
        text: metricAxisTitle(metric, sources[axis]),
        kind: "axis",
        axis,
        fraction: 0.5,
        fadeWithDepth,
        screenOffset: AXIS_TITLE_PIXELS,
      })

      for (const value of axisTicks(domain, TICK_TARGET)) {
        items.push({
          key: `tick-${axis}-${value}`,
          text: formatMetric(value, metric),
          kind: "tick",
          axis,
          fraction: span === 0 ? 0.5 : (value - domain.min) / span,
          fadeWithDepth,
          screenOffset: TICK_LABEL_PIXELS,
        })
      }
    }

    if (showPointLabels) {
      // One name per model, pinned to the same anchor effort the 2D chart labels.
      for (const label of buildSeriesLabels(data)) {
        const anchor = data.pointById.get(label.pointId)

        if (!anchor) continue

        items.push({
          key: `point-${label.key}`,
          text: label.name,
          effort: label.effort,
          color: label.color,
          kind: "point",
          base: positions[anchor.index].clone().setY(positions[anchor.index].y + 0.11),
          pointId: label.pointId,
          pointIds: label.ids,
        })
      }
    }

    return items
  }, [data, metrics, positions, showPointLabels, sources])

  const activePoint = activeId == null ? null : (data.pointById.get(activeId) ?? null)

  useEffect(() => setWebgl(supportsWebGL()), [])

  useEffect(() => {
    const container = containerRef.current

    if (!container) return undefined

    const observer = new ResizeObserver(([entry]) => {
      setShowPointLabels(entry.contentRect.width >= POINT_LABEL_MIN_WIDTH)
    })

    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    sceneRef.current.activeId = activeId
    invalidate()
  }, [activeId])

  useEffect(() => {
    invalidate()
  }, [colors])

  useEffect(
    () => () => {
      document.body.style.cursor = ""
    },
    [],
  )

  function handlePointKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction = ["ArrowRight", "ArrowDown"].includes(event.key)
      ? 1
      : ["ArrowLeft", "ArrowUp"].includes(event.key)
        ? -1
        : 0

    if (direction === 0) return

    event.preventDefault()
    const nextIndex = (index + direction + data.points.length) % data.points.length

    document.querySelector<HTMLButtonElement>(`[data-plot-3d-point="${nextIndex}"]`)?.focus()
  }

  if (data.points.length === 0) {
    return (
      <DataState
        className={CHART_HEIGHT_CLASS}
        title="No models have values for all three selected metrics"
      />
    )
  }

  return (
    <div ref={containerRef} className="relative" data-chart-frame="loaded">
      {/* One quiet track with only the current view filled, so the control recedes
          behind the plot instead of reading as three separate buttons. */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-0.5">
        {Object.keys(VIEW_PRESETS).map((label) => (
          <Button
            key={label}
            size="sm"
            variant="ghost"
            aria-pressed={preset.name === label}
            onClick={() => setPreset((current) => ({ name: label, nonce: current.nonce + 1 }))}
            className={cn(
              "px-2 font-normal",
              preset.name === label
                ? "bg-muted text-foreground font-medium"
                : "text-muted-foreground",
            )}
          >
            {label}
          </Button>
        ))}
      </div>
      <p className="text-muted-foreground pointer-events-none absolute right-3 bottom-3 z-20 hidden items-center gap-1.5 text-xs sm:flex">
        <RiDragMove2Line aria-hidden="true" className="size-3.5" />
        Drag to rotate · scroll to zoom
      </p>
      <div
        role="img"
        aria-label={describePlot(data)}
        className={`relative w-full touch-none select-none ${CHART_HEIGHT_CLASS}`}
      >
        {webgl === false ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-sm">
            <p>3D rendering is unavailable on this device.</p>
            <dl className="max-h-64 w-full max-w-md overflow-y-auto text-left text-xs">
              {data.points.map((point) => (
                <div
                  key={point.id}
                  className="border-border flex justify-between gap-4 border-b py-1.5"
                >
                  <dt className="truncate">{point.label}</dt>
                  <dd className="shrink-0 tabular-nums">
                    {AXES.map((axis) => formatMetric(point.values[axis], metrics[axis])).join(
                      " · ",
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <p>Removing the Z axis returns the full 2D chart.</p>
          </div>
        ) : null}

        {webgl ? (
          <>
            <Canvas
              frameloop="demand"
              dpr={[1, 2]}
              gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
              camera={{
                fov: 38,
                near: 0.1,
                far: 60,
                position: viewPosition(startsFlat ? MORPH_VIEW : ORBIT_VIEW).toArray(),
              }}
              className="cursor-grab active:cursor-grabbing"
              onPointerMissed={() => setActiveId(null)}
            >
              <PlotFrame
                borderColor={colors.border}
                gridFractions={axisTickFractions}
                scene={sceneRef}
              />
              <PlotPoints
                data={data}
                positions={positions}
                haloColor={colors.ring}
                resolveColor={resolve}
                scene={sceneRef}
                onActivate={setActiveId}
              />
              <LabelProjector items={labelItems} nodes={labelNodes} scene={sceneRef} />
              <TooltipAnchor
                card={tooltipCard}
                data={data}
                positions={positions}
                scene={sceneRef}
              />
              <CameraDirector
                controls={controlsRef}
                onExitComplete={onExitComplete}
                phase={phase}
                preset={preset}
                reduceMotion={reduceMotion}
                scene={sceneRef}
              />
              <OrbitControls
                ref={controlsRef}
                makeDefault
                enablePan={false}
                enableDamping
                dampingFactor={0.08}
                rotateSpeed={0.65}
                zoomSpeed={0.6}
                minDistance={2.4}
                maxDistance={9}
                minPolarAngle={0.08}
                maxPolarAngle={Math.PI - 0.08}
              />
            </Canvas>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              {labelItems.map((item, index) => (
                <div
                  key={item.key}
                  ref={(node) => {
                    labelNodes.current[index] = node
                  }}
                  className={`absolute top-0 left-0 text-center whitespace-nowrap opacity-0 will-change-transform ${
                    item.kind === "point"
                      ? "font-semibold"
                      : item.kind === "axis"
                        ? "text-muted-foreground font-medium"
                        : "text-muted-foreground tabular-nums"
                  }`}
                  style={{
                    color: item.color,
                    fontSize: chartFontRem(LABEL_SIZES[item.kind]),
                    textShadow: `0 0 3px ${colors.background}, 0 0 3px ${colors.background}, 0 0 6px ${colors.background}`,
                  }}
                >
                  {item.text}
                  {item.effort ? (
                    <span
                      className="text-muted-foreground block font-medium tracking-wide"
                      style={{ fontSize: chartFontRem(LABEL_EFFORT_SIZE) }}
                    >
                      {item.effort}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            <div
              ref={tooltipCard}
              aria-hidden={activePoint == null}
              className={`absolute top-0 left-0 opacity-0 will-change-transform ${CHART_TOOLTIP_CLASS}`}
              style={{ width: CHART_TOOLTIP_WIDTH }}
            >
              {activePoint ? (
                <PointDetails axes={data.axes} metrics={data.metrics} point={activePoint} />
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <div className="sr-only" role="group" aria-label="Chart points">
        {data.points.map((point) => (
          <button
            key={point.id}
            type="button"
            tabIndex={point.index === 0 ? 0 : -1}
            data-plot-3d-point={point.index}
            aria-label={`${point.label}, ${AXES.map((axis) => `${METRIC_CONFIG[metrics[axis]].label} ${formatMetric(point.values[axis], metrics[axis])}`).join(", ")}`}
            onFocus={() => setActiveId(point.id)}
            onClick={() => setActiveId(point.id)}
            onKeyDown={(event) => handlePointKeyDown(event, point.index)}
          >
            {point.label}
          </button>
        ))}
      </div>

      <p aria-live="polite" className="sr-only">
        {activePoint ? `${activePoint.label} selected` : ""}
      </p>
    </div>
  )
}
