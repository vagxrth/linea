// A project's picture on the dashboard: its canvas drawn small, as SVG. The server draws it from the
// saved shapes each time the drawing is saved, so it's always the real sketch. Frames, boxes, strokes
// and text look as they do on the canvas, and a generated design shows as a light page in its place.

type Point = { x: number; y: number }

// The fields this reads from a saved shape (see src/redux/slice/shapes)
type SavedShape = {
    type?: string
    x?: number
    y?: number
    w?: number
    h?: number
    startX?: number
    startY?: number
    endX?: number
    endY?: number
    points?: Point[]
    text?: string
    fontSize?: number
    fontWeight?: number
    fontStyle?: string
    stroke?: string
    fill?: string | null
}

type Box = { x: number; y: number; w: number; h: number }

// The picture's size, the card's 4:3
const WIDTH = 320
const HEIGHT = 240
// Room around the drawing, as a share of the picture
const PADDING = 0.08
// Caps that keep the picture small enough for every project on the dashboard to load at once
const MAX_SHAPES = 300
const MAX_TEXT = 60
const MAX_BYTES = 24_000

const finite = (...values: unknown[]) => values.every((value) => typeof value === 'number' && Number.isFinite(value))

// The area a shape covers, as on the canvas (src/lib/shape-bounds.ts), or null for a shape that can't be drawn
const shapeBox = (shape: SavedShape): Box | null => {
    switch (shape.type) {
        case 'frame':
        case 'rect':
        case 'ellipse':
        case 'generatedui':
            return finite(shape.x, shape.y, shape.w, shape.h) ? { x: shape.x!, y: shape.y!, w: shape.w!, h: shape.h! } : null
        case 'freedraw': {
            const points = (shape.points ?? []).filter((point) => finite(point?.x, point?.y))
            if (points.length < 2) return null
            const xs = points.map((point) => point.x)
            const ys = points.map((point) => point.y)
            const x = Math.min(...xs)
            const y = Math.min(...ys)
            return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
        }
        case 'arrow':
        case 'line':
            if (!finite(shape.startX, shape.startY, shape.endX, shape.endY)) return null
            return {
                x: Math.min(shape.startX!, shape.endX!),
                y: Math.min(shape.startY!, shape.endY!),
                w: Math.abs(shape.endX! - shape.startX!),
                h: Math.abs(shape.endY! - shape.startY!),
            }
        case 'text': {
            if (!finite(shape.x, shape.y) || !shape.text?.trim()) return null
            const size = finite(shape.fontSize) ? shape.fontSize! : 16
            return { x: shape.x!, y: shape.y!, w: Math.max(shape.text.length * size * 0.6, 100) + 8, h: size * 1.2 + 8 }
        }
        default:
            return null
    }
}

// Colors go into attributes, so only plain color values pass; anything else gets the canvas's white
const COLOR = /^(#[0-9a-f]{3,8}|[a-z]{3,20}|(rgb|hsl)a?\([\d\s.,%/]+\))$/i
const color = (value: string | null | undefined, fallback: string) =>
    value && COLOR.test(value.trim()) ? value.trim() : fallback

// Text as SVG content: markup escaped, and anything outside ASCII as a character reference, so the
// picture can be base64-encoded as is
const escapeText = (text: string) =>
    Array.from(text.slice(0, MAX_TEXT))
        .map((char) => {
            const code = char.codePointAt(0)!
            if (char === '&') return '&amp;'
            if (char === '<') return '&lt;'
            if (char === '>') return '&gt;'
            if (code < 32) return ' '
            return code > 126 ? `&#${code};` : char
        })
        .join('')

const round = (value: number) => Math.round(value)
const STROKE = 'vector-effect="non-scaling-stroke" stroke-width="1.25"'

// Every nth point of a stroke, keeping its last, so long strokes stay small
const thin = (points: Point[], max: number) => {
    if (points.length <= max) return points
    const step = (points.length - 1) / (max - 1)
    return Array.from({ length: max }, (_, index) => points[Math.round(index * step)])
}

const drawShape = (shape: SavedShape, maxPoints: number): string => {
    const stroke = color(shape.stroke, '#ffffff')
    const fill = shape.fill ? color(shape.fill, 'none') : 'none'
    switch (shape.type) {
        case 'frame':
            return `<rect x="${round(shape.x!)}" y="${round(shape.y!)}" width="${round(shape.w!)}" height="${round(shape.h!)}" rx="12" fill="#ffffff" fill-opacity="0.06" stroke="#ffffff" stroke-opacity="0.2" ${STROKE}/>`
        case 'generatedui':
            return `<rect x="${round(shape.x!)}" y="${round(shape.y!)}" width="${round(shape.w!)}" height="${round(shape.h!)}" rx="8" fill="#ece7df"/>`
        case 'rect':
            return `<rect x="${round(shape.x!)}" y="${round(shape.y!)}" width="${round(shape.w!)}" height="${round(shape.h!)}" rx="8" fill="${fill}" stroke="${stroke}" ${STROKE}/>`
        case 'ellipse':
            return `<ellipse cx="${round(shape.x! + shape.w! / 2)}" cy="${round(shape.y! + shape.h! / 2)}" rx="${round(shape.w! / 2)}" ry="${round(shape.h! / 2)}" fill="${fill}" stroke="${stroke}" ${STROKE}/>`
        case 'freedraw': {
            const points = thin((shape.points ?? []).filter((point) => finite(point?.x, point?.y)), maxPoints)
            return `<polyline points="${points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ')}" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${STROKE}/>`
        }
        case 'line':
            return `<line x1="${round(shape.startX!)}" y1="${round(shape.startY!)}" x2="${round(shape.endX!)}" y2="${round(shape.endY!)}" stroke="${stroke}" stroke-linecap="round" ${STROKE}/>`
        case 'arrow': {
            const { startX, startY, endX, endY } = shape as Required<Pick<SavedShape, 'startX' | 'startY' | 'endX' | 'endY'>>
            const angle = Math.atan2(endY - startY, endX - startX)
            const head = Math.min(18, Math.hypot(endX - startX, endY - startY) / 3)
            const wing = (side: number) =>
                `${round(endX - head * Math.cos(angle + side * 0.5))},${round(endY - head * Math.sin(angle + side * 0.5))}`
            return `<polyline points="${round(startX)},${round(startY)} ${round(endX)},${round(endY)}" fill="none" stroke="${stroke}" stroke-linecap="round" ${STROKE}/><polyline points="${wing(1)} ${round(endX)},${round(endY)} ${wing(-1)}" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${STROKE}/>`
        }
        case 'text': {
            const size = finite(shape.fontSize) ? shape.fontSize! : 16
            const weight = finite(shape.fontWeight) ? shape.fontWeight : 400
            const style = shape.fontStyle === 'italic' ? ' font-style="italic"' : ''
            return `<text x="${round(shape.x! + 8)}" y="${round(shape.y! + 4 + size)}" font-family="system-ui, sans-serif" font-size="${round(size)}" font-weight="${weight}"${style} fill="${color(shape.fill, '#ffffff')}">${escapeText(shape.text!)}</text>`
        }
        default:
            return ''
    }
}

// The saved drawing's shapes, in drawing order (later ones on top)
const savedShapes = (sketchesData: unknown): SavedShape[] => {
    const shapes = (sketchesData as { shapes?: { ids?: unknown; entities?: Record<string, SavedShape> } } | null)?.shapes
    if (!shapes || !Array.isArray(shapes.ids) || !shapes.entities) return []
    return shapes.ids.map((id) => shapes.entities![String(id)]).filter((shape): shape is SavedShape => !!shape)
}

const render = (shapes: { shape: SavedShape; box: Box }[], maxPoints: number) => {
    const left = Math.min(...shapes.map(({ box }) => box.x))
    const top = Math.min(...shapes.map(({ box }) => box.y))
    const width = Math.max(1, Math.max(...shapes.map(({ box }) => box.x + box.w)) - left)
    const height = Math.max(1, Math.max(...shapes.map(({ box }) => box.y + box.h)) - top)
    // Fits the drawing, centered, never larger than on the canvas at 100%
    const scale = Math.min((WIDTH * (1 - 2 * PADDING)) / width, (HEIGHT * (1 - 2 * PADDING)) / height, 1)
    const offsetX = (WIDTH - width * scale) / 2 - left * scale
    const offsetY = (HEIGHT - height * scale) / 2 - top * scale
    const fixed = (value: number) => Number(value.toFixed(4))

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">` +
        // The canvas: its background and dot grid
        `<defs><pattern id="dots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="0.6" fill="#ffffff" fill-opacity="0.12"/></pattern></defs>` +
        `<rect width="${WIDTH}" height="${HEIGHT}" fill="#0a0a0a"/><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dots)"/>` +
        `<g transform="translate(${fixed(offsetX)} ${fixed(offsetY)}) scale(${fixed(scale)})">` +
        shapes.map(({ shape }) => drawShape(shape, maxPoints)).join('') +
        `</g></svg>`
}

// The thumbnail for a saved drawing, as an SVG data URL, or undefined when there's nothing drawn
export const sketchThumbnail = (sketchesData: unknown): string | undefined => {
    const drawable = savedShapes(sketchesData)
        .map((shape) => ({ shape, box: shapeBox(shape) }))
        .filter((entry): entry is { shape: SavedShape; box: Box } => entry.box !== null)
        .slice(0, MAX_SHAPES)
    if (drawable.length === 0) return undefined

    // Long strokes are thinned further until the picture is small enough
    let svg = ''
    for (const maxPoints of [48, 16, 6, 2]) {
        svg = render(drawable, maxPoints)
        if (svg.length <= MAX_BYTES) break
    }
    return `data:image/svg+xml;base64,${btoa(svg)}`
}
