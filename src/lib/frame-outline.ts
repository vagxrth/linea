import type { FrameShape, Shape } from '@/redux/slice/shapes'
import { getShapeBounds } from './shape-bounds'
import { clampPercent, isComponentLabel, MAX_OUTLINE_NODES, OUTLINE_VERSION, readingRows, truncateOutline, type FrameOutline, type OutlineNode } from './wireframe-outline'

// A frame's wireframe read off the canvas shapes, sent with its picture when a design is generated
// (see src/lib/wireframe-outline.ts): every box with its label, which boxes are crossed out (image
// slots), what sits inside what, and where each one is, as a percent of the frame. The picture shows
// the same things, but reading them off an image is where the model miscounts cards and drops labels.

const area = (box: OutlineNode['box']) => (box[2] - box[0]) * (box[3] - box[1])

// Whether inner lies within outer, give or take a little, since sketches are rough
const within = (inner: OutlineNode['box'], outer: OutlineNode['box'], slack = 1) =>
    inner[0] >= outer[0] - slack && inner[2] <= outer[2] + slack &&
    inner[1] >= outer[1] - slack && inner[3] <= outer[3] + slack

const close = (ax: number, ay: number, bx: number, by: number, tolerance: number) =>
    Math.hypot(ax - bx, ay - by) <= tolerance

// Whether the line runs corner to corner across the box, either way round
const isDiagonal = (line: { startX: number; startY: number; endX: number; endY: number }, box: { x: number; y: number; w: number; h: number }) => {
    const tolerance = Math.min(box.w, box.h) * 0.2
    const corners: [number, number][][] = [
        [[box.x, box.y], [box.x + box.w, box.y + box.h]],
        [[box.x + box.w, box.y], [box.x, box.y + box.h]],
    ]
    return corners.findIndex(([a, b]) =>
        (close(line.startX, line.startY, ...a, tolerance) && close(line.endX, line.endY, ...b, tolerance)) ||
        (close(line.startX, line.startY, ...b, tolerance) && close(line.endX, line.endY, ...a, tolerance)))
}

// Shape ids are long; the outline uses their first 8 characters, which stay the same for as long as
// the shape exists, and the whole id for any that would clash
const shortIds = (ids: string[]) => {
    const short = (id: string) => (id.length > 12 ? id.slice(0, 8) : id)
    const counts = new Map<string, number>()
    for (const id of ids) counts.set(short(id), (counts.get(short(id)) ?? 0) + 1)
    return new Map(ids.map((id) => [id, counts.get(short(id))! > 1 ? id : short(id)]))
}

const containers = new Set<OutlineNode['kind']>(['box', 'image', 'circle'])

// Children in reading order, all the way down, so the outline reads the same however the shapes were drawn
const ordered = (nodes: OutlineNode[]): OutlineNode[] =>
    readingRows(nodes).flat().map((node) => (node.children?.length ? { ...node, children: ordered(node.children) } : node))

// The outline of the shapes inside a frame (as getShapesInsideFrame finds them), cut down to
// MAX_OUTLINE_NODES a whole row at a time
export const frameOutline = (frame: FrameShape, shapes: Shape[]): FrameOutline => {
    const round = (value: number) => Math.round(value * 10) / 10
    // A percent of the frame, to a tenth, and no further out than just past its edges: a shape that
    // hangs over the frame is still part of it, and the server would clamp it to the same range
    const pct = (value: number) => round(clampPercent(value))
    const toFrame = (bounds: { x: number; y: number; w: number; h: number }): OutlineNode['box'] => [
        pct(((bounds.x - frame.x) / frame.w) * 100),
        pct(((bounds.y - frame.y) / frame.h) * 100),
        pct(((bounds.x + bounds.w - frame.x) / frame.w) * 100),
        pct(((bounds.y + bounds.h - frame.y) / frame.h) * 100),
    ]

    // A box with lines corner to corner both ways is the usual sketch of an image
    const boxes = shapes.filter((shape) => shape.type === 'rect' || shape.type === 'frame')
    const crossings = new Set<string>()
    const crossed = new Set<string>()
    for (const shape of boxes) {
        const lines = shapes.filter((other) => (other.type === 'line' || other.type === 'arrow') && !crossings.has(other.id))
        const first = lines.find((line) => 'startX' in line && isDiagonal(line, shape) === 0)
        const second = lines.find((line) => 'startX' in line && isDiagonal(line, shape) === 1)
        if (first && second) {
            crossings.add(first.id)
            crossings.add(second.id)
            crossed.add(shape.id)
        }
    }

    const kept = shapes.filter((shape) => !crossings.has(shape.id) && shape.type !== 'generatedui' && shape.id !== frame.id)
    const ids = shortIds([frame.id, ...kept.map((shape) => shape.id)])
    const nodes: OutlineNode[] = []
    for (const shape of kept) {
        const kind: OutlineNode['kind'] =
            shape.type === 'rect' || shape.type === 'frame' ? (crossed.has(shape.id) ? 'image' : 'box')
            : shape.type === 'ellipse' ? 'circle'
            : shape.type === 'text' ? 'text'
            : shape.type === 'freedraw' ? 'scribble'
            : shape.type === 'arrow' ? 'arrow'
            : 'line'
        const node: OutlineNode = { id: ids.get(shape.id)!, kind, box: toFrame(getShapeBounds(shape)) }
        if (shape.type === 'text') {
            const text = shape.text.trim()
            if (!text || text === 'Type here...') continue
            // A component's name ("card", "hero image") or words for the page ("Fresh plants weekly")
            if (isComponentLabel(text)) node.label = text.slice(0, 60)
            else node.text = text.slice(0, 200)
        }
        nodes.push(node)
    }

    // Each node goes inside the smallest box around it
    const holders = nodes.filter((node) => containers.has(node.kind))
    const parentOf = (node: OutlineNode) =>
        holders
            .filter((holder) => holder !== node && area(holder.box) > area(node.box) && within(node.box, holder.box))
            .sort((a, b) => area(a.box) - area(b.box))[0]

    const top: OutlineNode[] = []
    for (const node of nodes) {
        const parent = parentOf(node)
        if (parent) (parent.children ??= []).push(node)
        else top.push(node)
    }

    // A box's first text, reading from its top left, is its label when it names a component; real
    // words stay as the box's copy
    for (const holder of holders) {
        const first = readingRows(holder.children ?? []).flat().find((child) => child.kind === 'text')
        if (first?.label && !first.children?.length && !holder.label) {
            holder.label = first.label
            holder.children = holder.children!.filter((child) => child !== first)
        }
        if (holder.children?.length === 0) delete holder.children
    }

    return truncateOutline({
        version: OUTLINE_VERSION,
        frame: { id: ids.get(frame.id)!, number: frame.frameNumber, width: Math.round(frame.w), height: Math.round(frame.h) },
        nodes: ordered(top),
    }, MAX_OUTLINE_NODES)
}
