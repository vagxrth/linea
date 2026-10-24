import type { Shape } from '@/redux/slice/shapes'
import type { Point, Rect } from '@/redux/slice/viewport'

// Copied shapes go on the clipboard as text marked as Linea's, so they can be pasted into another
// project or tab. Pasted text without the mark is left to the browser.
const CLIPBOARD_TYPE = 'linea/shapes'

export const shapesToClipboard = (shapes: Shape[]) => JSON.stringify({ type: CLIPBOARD_TYPE, shapes })

const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)

// The text can come from anywhere, so only shapes with the fields the canvas draws them by are pasted
const isShape = (value: unknown): value is Shape => {
    if (typeof value !== 'object' || value === null) return false
    const shape = value as Record<string, unknown>
    if (typeof shape.id !== 'string') return false
    switch (shape.type) {
        case 'frame':
        case 'rect':
        case 'ellipse':
        case 'generatedui':
            return [shape.x, shape.y, shape.w, shape.h].every(isNumber)
        case 'text':
            return isNumber(shape.x) && isNumber(shape.y) && isNumber(shape.fontSize) && typeof shape.text === 'string'
        case 'arrow':
        case 'line':
            return [shape.startX, shape.startY, shape.endX, shape.endY].every(isNumber)
        case 'freedraw':
            return Array.isArray(shape.points) && shape.points.length >= 2 &&
                shape.points.every((point) => isNumber(point?.x) && isNumber(point?.y))
        default:
            return false
    }
}

// The shapes in clipboard text, or null when it isn't shapes copied from Linea
export const shapesFromClipboard = (text: string | null | undefined): Shape[] | null => {
    if (!text) return null
    try {
        const data = JSON.parse(text)
        if (data?.type !== CLIPBOARD_TYPE || !Array.isArray(data.shapes)) return null
        const shapes = data.shapes.filter(isShape)
        return shapes.length > 0 ? shapes : null
    } catch {
        return null
    }
}

// How far each paste of the same copy steps from the last, down and to the right
const PASTE_STEP = 20

// Where pasted shapes go, as an offset from where they were copied. Paste number n lands n steps away,
// so copies don't hide each other; shapes that were cut go back in place first. When that spot is
// out of view, such as in another project, they go to the middle of the view instead.
export const pasteOffset = (bounds: Rect, view: Rect, paste: number): Point => {
    const step = PASTE_STEP * paste
    const x = bounds.x + step
    const y = bounds.y + step
    const inView = x < view.x + view.width && x + bounds.width > view.x && y < view.y + view.height && y + bounds.height > view.y
    if (inView) return { x: step, y: step }
    return {
        x: view.x + view.width / 2 - (bounds.x + bounds.width / 2),
        y: view.y + view.height / 2 - (bounds.y + bounds.height / 2),
    }
}
