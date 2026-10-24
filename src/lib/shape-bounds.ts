import type { Shape } from '@/redux/slice/shapes'
import { zoomToFit, type Rect } from '@/redux/slice/viewport'

// The area each shape covers, matching the areas clicks hit
export const getShapeBounds = (shape: Shape): { x: number; y: number; w: number; h: number } => {
    switch (shape.type) {
        case 'frame':
        case 'rect':
        case 'ellipse':
        case 'generatedui':
            return { x: shape.x, y: shape.y, w: shape.w, h: shape.h }
        case 'freedraw': {
            const xs = shape.points.map((p) => p.x)
            const ys = shape.points.map((p) => p.y)
            const x = Math.min(...xs)
            const y = Math.min(...ys)
            return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
        }
        case 'arrow':
        case 'line':
            return {
                x: Math.min(shape.startX, shape.endX),
                y: Math.min(shape.startY, shape.endY),
                w: Math.abs(shape.endX - shape.startX),
                h: Math.abs(shape.endY - shape.startY),
            }
        case 'text':
            return {
                x: shape.x,
                y: shape.y,
                w: Math.max(shape.text.length * (shape.fontSize * 0.6), 100) + 8,
                h: shape.fontSize * 1.2 + 8,
            }
    }
}

// The smallest rectangle around all the shapes, or null when there are none
export const contentBounds = (shapes: Shape[]): Rect | null => {
    if (shapes.length === 0) return null
    const boxes = shapes.map(getShapeBounds)
    const x = Math.min(...boxes.map((b) => b.x))
    const y = Math.min(...boxes.map((b) => b.y))
    const right = Math.max(...boxes.map((b) => b.x + b.w))
    const bottom = Math.max(...boxes.map((b) => b.y + b.h))
    return { x, y, width: right - x, height: bottom - y }
}

// Room left around the drawing, so the bars over the canvas don't cover it
const FIT_PADDING = 96

// Zooms and pans so every shape is in view, at no more than 100%, so a small drawing isn't blown up.
// Null when there's nothing to fit.
export const fitToContent = (shapes: Shape[], viewportPx: { width: number; height: number }) => {
    const bounds = contentBounds(shapes)
    return bounds ? zoomToFit({ bounds, viewportPx, padding: FIT_PADDING, maxScale: 1 }) : null
}
