import type { Point } from '@/redux/slice/viewport'

type Box = { x: number; y: number; w: number; h: number }

// The smallest a shape can be resized to
const MIN_SIZE = 10

// The box after dragging one of its corner handles to the pointer. The opposite corner stays where it
// was in `start`, the box when the drag began, and the dragged corner stops 10px from it. Dragged past
// the opposite edge, the box stays 10×10 against that corner instead of sliding along with the pointer.
export const resizeBox = (start: Box, corner: string, pointer: Point): Box => {
    const right = start.x + start.w
    const bottom = start.y + start.h
    const fromLeft = corner === 'nw' || corner === 'sw'
    const fromTop = corner === 'nw' || corner === 'ne'
    const x = fromLeft ? Math.min(pointer.x, right - MIN_SIZE) : start.x
    const y = fromTop ? Math.min(pointer.y, bottom - MIN_SIZE) : start.y
    return {
        x,
        y,
        w: fromLeft ? right - x : Math.max(MIN_SIZE, pointer.x - start.x),
        h: fromTop ? bottom - y : Math.max(MIN_SIZE, pointer.y - start.y),
    }
}
