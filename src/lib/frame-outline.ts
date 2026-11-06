import type { FrameShape, Shape } from '@/redux/slice/shapes'
import { getShapeBounds } from './shape-bounds'

// A text description of a frame's wireframe, sent with its picture when a design is generated: every
// box with its label, which boxes are crossed out (image slots), which sit side by side, and where
// each one is, as a percent of the frame. The picture shows the same things, but reading them off an
// image is where the model miscounts cards and drops labels.

type Box = { left: number; top: number; right: number; bottom: number }

type Item = {
    kind: 'box' | 'circle' | 'text' | 'line' | 'arrow' | 'scribble'
    box: Box
    label?: string
    crossed?: boolean
    children: Item[]
}

// Kept short, so a busy frame doesn't crowd out the rest of the prompt
const MAX_LINES = 120

const area = (box: Box) => (box.right - box.left) * (box.bottom - box.top)

// Whether inner lies within outer, give or take a little, since sketches are rough
const within = (inner: Box, outer: Box, slack = 1) =>
    inner.left >= outer.left - slack && inner.right <= outer.right + slack &&
    inner.top >= outer.top - slack && inner.bottom <= outer.bottom + slack

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

const percent = (value: number) => Math.round(Math.min(100, Math.max(0, value)))

// Reading order: rows from the top, and left to right within a row. Items share a row when the
// next one's middle is above the bottom of the row so far.
const rows = (items: Item[]): Item[][] => {
    const sorted = [...items].sort((a, b) => a.box.top - b.box.top || a.box.left - b.box.left)
    const result: Item[][] = []
    let bottom = -Infinity
    for (const item of sorted) {
        const middle = (item.box.top + item.box.bottom) / 2
        if (result.length && middle < bottom) {
            result[result.length - 1].push(item)
            bottom = Math.max(bottom, item.box.bottom)
        } else {
            result.push([item])
            bottom = item.box.bottom
        }
    }
    return result
}

// A row's columns, left to right, each read top to bottom. Items whose left edges are within a few
// percent share a column: a hand-drawn column's edges are never quite straight.
const columns = (row: Item[]): Item[][] => {
    const result: Item[][] = []
    let start = -Infinity
    for (const item of [...row].sort((a, b) => a.box.left - b.box.left)) {
        if (item.box.left - start > 4) {
            result.push([])
            start = item.box.left
        }
        result[result.length - 1].push(item)
    }
    return result.map((column) => column.sort((a, b) => a.box.top - b.box.top))
}

const where = ({ box }: Item) => {
    const span = (from: number, to: number) => (Math.round(from) === Math.round(to) ? `${percent(from)}` : `${percent(from)}–${percent(to)}`)
    return `x ${span(box.left, box.right)}%, y ${span(box.top, box.bottom)}%`
}

const describe = (item: Item) => {
    const label = item.label ? ` "${item.label}"` : ''
    switch (item.kind) {
        case 'box': return item.crossed ? `image slot (crossed box)${label}, ${where(item)}` : `box${label}, ${where(item)}`
        case 'circle': return `circle${label}, ${where(item)}`
        // Only where it starts: a label's own size says nothing about how big the text it stands for is
        case 'text': return `text${label}, at x ${percent(item.box.left)}%, y ${percent(item.box.top)}%`
        case 'line': return `line, ${where(item)}`
        case 'arrow': return `arrow, ${where(item)}`
        case 'scribble': return `scribble, ${where(item)}`
    }
}

// Whether the boxes are about the same size, like a row of cards, rather than a hero's button and image
const alike = (boxes: Item[]) => {
    const size = (item: Item) => [item.box.right - item.box.left, item.box.bottom - item.box.top]
    const [width, height] = size(boxes[0])
    return boxes.every((box) => {
        const [w, h] = size(box)
        return Math.abs(w - width) <= width * 0.35 && Math.abs(h - height) <= height * 0.35
    })
}

const span = (items: Item[]) =>
    `x ${percent(Math.min(...items.map((item) => item.box.left)))}–${percent(Math.max(...items.map((item) => item.box.right)))}%`

const write = (items: Item[], depth: number, lines: string[]) => {
    const indent = '  '.repeat(depth)
    const item = (entry: Item, at: number) => {
        lines.push(`${'  '.repeat(at)}- ${describe(entry)}`)
        write(entry.children, at + 1, lines)
    }
    for (const row of rows(items)) {
        const boxes = row.filter((entry) => entry.kind === 'box' || entry.kind === 'circle')
        const parts = columns(row)
        if (boxes.length > 1 && alike(boxes)) {
            // Repeated boxes side by side, like cards, so the design keeps the row and its count
            lines.push(`${indent}- row of ${boxes.length} side by side:`)
            parts.flat().forEach((entry) => item(entry, depth + 1))
        } else if (parts.length > 1 && parts.some((column) => column.length > 1)) {
            // A stack beside something else, like a hero's text beside its image: columns, so the
            // design doesn't stack them
            lines.push(`${indent}- ${parts.length} columns side by side:`)
            for (const column of parts) {
                lines.push(`${indent}  - column, ${span(column)}:`)
                column.forEach((entry) => item(entry, depth + 2))
            }
        } else {
            parts.flat().forEach((entry) => item(entry, depth))
        }
    }
}

// The outline of the shapes inside a frame (as getShapesInsideFrame finds them)
export const frameOutline = (frame: FrameShape, shapes: Shape[]): string => {
    const toFrame = (bounds: { x: number; y: number; w: number; h: number }): Box => ({
        left: ((bounds.x - frame.x) / frame.w) * 100,
        top: ((bounds.y - frame.y) / frame.h) * 100,
        right: ((bounds.x + bounds.w - frame.x) / frame.w) * 100,
        bottom: ((bounds.y + bounds.h - frame.y) / frame.h) * 100,
    })

    const containers = shapes.filter((shape) => shape.type === 'rect' || shape.type === 'ellipse' || shape.type === 'frame')
    const crossings = new Set<string>()
    const crossed = new Set<string>()
    // A box with lines corner to corner both ways is the usual sketch of an image
    for (const shape of containers) {
        if (shape.type === 'ellipse') continue
        const lines = shapes.filter((other) => (other.type === 'line' || other.type === 'arrow') && !crossings.has(other.id))
        const first = lines.find((line) => 'startX' in line && isDiagonal(line, shape) === 0)
        const second = lines.find((line) => 'startX' in line && isDiagonal(line, shape) === 1)
        if (first && second) {
            crossings.add(first.id)
            crossings.add(second.id)
            crossed.add(shape.id)
        }
    }

    const items = new Map<string, Item>()
    for (const shape of shapes) {
        if (crossings.has(shape.id) || shape.type === 'generatedui') continue
        const kind: Item['kind'] =
            shape.type === 'rect' || shape.type === 'frame' ? 'box'
            : shape.type === 'ellipse' ? 'circle'
            : shape.type === 'text' ? 'text'
            : shape.type === 'freedraw' ? 'scribble'
            : shape.type === 'arrow' ? 'arrow'
            : 'line'
        const item: Item = { kind, box: toFrame(getShapeBounds(shape)), children: [], crossed: crossed.has(shape.id) }
        if (shape.type === 'text') {
            const text = shape.text.trim()
            if (!text || text === 'Type here...') continue
            item.label = text.slice(0, 60)
        }
        items.set(shape.id, item)
    }

    // Each item goes inside the smallest box around it
    const boxes = [...items.values()].filter((item) => item.kind === 'box' || item.kind === 'circle')
    const parentOf = (item: Item) =>
        boxes
            .filter((box) => box !== item && area(box.box) > area(item.box) && within(item.box, box.box))
            .sort((a, b) => area(a.box) - area(b.box))[0]

    const top: Item[] = []
    for (const item of items.values()) {
        const parent = parentOf(item)
        // A box's first text is its label, saying what the box is
        if (item.kind === 'text' && parent && !parent.label) {
            parent.label = item.label
            continue
        }
        if (parent) parent.children.push(item)
        else top.push(item)
    }

    const shape = frame.w >= frame.h ? 'landscape' : 'portrait'
    const lines = [`Frame ${frame.frameNumber}: ${Math.round(frame.w)} × ${Math.round(frame.h)} px, ${shape}. Positions are percent of the frame, x across and y down; indented items sit inside the box above them.`]
    write(top, 0, lines)
    if (lines.length > MAX_LINES) {
        return [...lines.slice(0, MAX_LINES), `(${lines.length - MAX_LINES} more items not listed)`].join('\n')
    }
    return lines.join('\n')
}
