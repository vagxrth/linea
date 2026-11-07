'use client'

import { useTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'

// Screenshots from a demo project in Linea, floating up both sides of the hero: the sketch on the
// canvas, the moodboard, style guide and inspiration board, the generated page and a chat redesign. To
// change them, replace public/images/landing/float-*.webp with new 16:10 screenshots.
const IMAGES = ['canvas', 'moodboard', 'style-guide', 'inspiration', 'sketch', 'generated', 'page', 'chat'].map(
    (name) => `/images/landing/float-${name}.webp`
)

const PER_SIDE = 7
// The depth band, in world units from the camera. Pages stay inside it, so none comes close enough to
// fill the screen, and nearer ones rise faster, which gives the depth.
const NEAR = 6.5
const FAR = 15
const PAGE_HEIGHT = 1.5
// How fast a page at depth 10 rises, in world units per second
const RISE = 0.3
const FOV = 50
// Pages stay a little see-through, so they read as background behind the headline
const MAX_OPACITY = 0.86

// A box in normalized device coordinates: -1 to 1 across the scene, y pointing up
export type ClearBox = { left: number; right: number; top: number; bottom: number }

export type KeepClear = {
    // The hero copy's pieces: the headline, the paragraph and each button. A page fades out while it
    // overlaps one, so it never sits under the text or a button.
    boxes: ClearBox[]
    // How far from the middle the copy reaches, so the pages float in the space beside it
    reach: number
}

type Props = {
    keepClear: RefObject<KeepClear | null>
    // Bumped when the copy moves, so a still scene draws again
    keepClearVersion: number
    reducedMotion: boolean
    paused: boolean
    onReady: () => void
}

type Page = {
    side: 1 | -1
    // Where in the free space beside the copy it floats, 0 nearest the copy to 1 at the screen's edge
    lane: number
    depth: number
    y: number
    image: number
    tilt: number
    // 0 to 1: eases to 0 while the page overlaps the copy
    clear: number
}

const vertexShader = /* glsl */ `
  uniform float time;
  uniform float seed;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;
    // A slow ripple, like a sheet of paper moving through air
    pos.z += sin(pos.x * 2.2 + time * 0.7 + seed) * 0.03 + sin(pos.y * 1.7 + time * 0.5 + seed) * 0.02;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float opacity;
  uniform float haze;
  uniform vec3 hazeColor;
  varying vec2 vUv;

  void main() {
    vec4 color = texture2D(map, vUv);
    // Far pages sink into the background, so the near ones read as nearer
    color.rgb = mix(color.rgb, hazeColor, haze);
    gl_FragColor = vec4(color.rgb, color.a * opacity);
  }
`

// The page background, oklch(0.145 0 0)
const HAZE = new THREE.Color(0.039, 0.039, 0.039)

const fraction = (value: number) => value - Math.floor(value)

const smoothstep = (edge0: number, edge1: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)
}

const tanHalf = Math.tan(THREE.MathUtils.degToRad(FOV / 2))

// Two columns of pages, spread out in height and depth so neighbours don't line up
const startingPages = (): Page[] =>
    ([-1, 1] as const).flatMap((side) =>
        Array.from({ length: PER_SIDE }, (_, i) => {
            const depth = NEAR + (FAR - NEAR) * fraction(i * 0.618 + (side > 0 ? 0.31 : 0))
            // Spread from below the screen to above it, in screen terms
            const screenY = -1.25 + (2.5 * (i + (side > 0 ? 0.5 : 0))) / PER_SIDE
            return {
                side,
                lane: fraction(i * 0.381 + (side > 0 ? 0.5 : 0.17)),
                depth,
                y: screenY * depth * tanHalf,
                image: (i * 2 + (side > 0 ? 1 : 0)) % IMAGES.length,
                tilt: (fraction(i * 0.73 + side) - 0.5) * 0.08,
                clear: 1,
            }
        })
    )

const Pages = ({ keepClear, keepClearVersion, reducedMotion, onReady }: Omit<Props, 'paused'>) => {
    const textures = useTexture(IMAGES)
    const pages = useRef<Page[]>(startingPages())
    const meshes = useRef<(THREE.Mesh | null)[]>([])
    const nextImage = useRef(0)
    const { size, invalidate } = useThree()

    const materials = useMemo(
        () =>
            pages.current.map((_, i) =>
                new THREE.ShaderMaterial({
                    transparent: true,
                    depthWrite: false,
                    uniforms: {
                        map: { value: null },
                        opacity: { value: 0 },
                        haze: { value: 0 },
                        hazeColor: { value: HAZE },
                        time: { value: 0 },
                        seed: { value: i * 1.7 },
                    },
                    vertexShader,
                    fragmentShader,
                })
            ),
        []
    )

    // Frees the shader programs when the scene goes away
    useEffect(() => () => materials.forEach((material) => material.dispose()), [materials])

    useEffect(() => {
        onReady()
    }, [onReady])

    // A still scene only draws when asked
    useEffect(() => {
        invalidate()
    }, [keepClearVersion, invalidate])

    useFrame((state, delta) => {
        const step = reducedMotion ? 0 : Math.min(delta, 0.1)
        const aspect = size.width / Math.max(size.height, 1)
        const copy = keepClear.current
        // Without the copy's size yet, assume it takes the middle half
        const reach = Math.min(Math.max(copy?.reach ?? 0.5, 0.2), 0.9)
        const time = reducedMotion ? 0 : state.clock.getElapsedTime()

        pages.current.forEach((page, i) => {
            const texture = textures[page.image]
            const image = texture.image as { width?: number; height?: number } | undefined
            const width = PAGE_HEIGHT * (image?.width && image?.height ? image.width / image.height : 1.6)

            // Screen units per world unit at this depth
            const perUnitY = 1 / (page.depth * tanHalf)
            const perUnitX = perUnitY / aspect
            const halfHeight = (PAGE_HEIGHT / 2) * perUnitY
            const halfWidth = (width / 2) * perUnitX

            page.y += RISE * (10 / page.depth) * step
            if (page.y * perUnitY - halfHeight > 1.05) {
                // Gone off the top: back in below the bottom, as the next image
                page.y = (-1.05 - halfHeight) / perUnitY
                page.image = nextImage.current
                nextImage.current = (nextImage.current + 1) % IMAGES.length
            }

            // Its place across the free space beside the copy. Where that space is narrower than the
            // page, the screen's edge crops it.
            const gap = 0.05
            const room = Math.max(0, 1 - reach - gap - halfWidth * 2)
            const centerX = page.side * (reach + gap + halfWidth + page.lane * room)
            const x = centerX / perUnitX

            const left = centerX - halfWidth
            const right = centerX + halfWidth
            const top = page.y * perUnitY + halfHeight
            const bottom = page.y * perUnitY - halfHeight
            const overlaps = (copy?.boxes ?? []).some(
                (box) => left < box.right && right > box.left && bottom < box.top && top > box.bottom
            )
            const target = overlaps ? 0 : 1
            page.clear = reducedMotion ? target : page.clear + (target - page.clear) * Math.min(1, delta * 5)

            const mesh = meshes.current[i]
            if (mesh) {
                mesh.position.set(x, page.y, -page.depth)
                mesh.scale.set(width, PAGE_HEIGHT, 1)
                // Turned a little toward the middle, like pages on the walls of a corridor
                mesh.rotation.set(0, -page.side * 0.3, page.tilt)
            }
            const material = materials[i]
            material.uniforms.map.value = texture
            material.uniforms.opacity.value = page.clear * MAX_OPACITY
            material.uniforms.haze.value = 0.16 + smoothstep(NEAR, FAR, page.depth) * 0.5
            material.uniforms.time.value = time
        })
    })

    return (
        <>
            {materials.map((material, i) => (
                <mesh
                    key={i}
                    ref={(mesh) => {
                        meshes.current[i] = mesh
                    }}
                    material={material}
                    frustumCulled={false}
                >
                    <planeGeometry args={[1, 1, 24, 24]} />
                </mesh>
            ))}
        </>
    )
}

const FloatingPages = ({ paused, reducedMotion, ...props }: Props) => (
    <Canvas
        // Pointer events pass through to the page: nothing in the scene is interactive
        style={{ pointerEvents: 'none' }}
        dpr={[1, 1.75]}
        camera={{ fov: FOV, near: 0.1, far: 100, position: [0, 0, 0] }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        // Stops drawing while the hero is off screen; with reduced motion it draws only when asked
        frameloop={paused ? 'never' : reducedMotion ? 'demand' : 'always'}
    >
        {/* Waits here for the images, so loading them never holds up the page around the scene.
            three.js draws transparent pages far to near on its own, so they overlap correctly. */}
        <Suspense fallback={null}>
            <Pages {...props} reducedMotion={reducedMotion} />
        </Suspense>
    </Canvas>
)

export default FloatingPages
