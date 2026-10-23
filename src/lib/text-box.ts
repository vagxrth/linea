import type { TextShape } from '@/redux/slice/shapes'
import { clamp } from '@/redux/slice/viewport'

type Box = { x: number; y: number; w: number; h: number }

// The same range as the font size slider in the text sidebar
const MIN_FONT_SIZE = 8
const MAX_FONT_SIZE = 128

// Text has no stored size, so the selection box around it is estimated from the font size: about
// 0.6 of the font size per character (at least 100 wide) and 1.2 lines tall, plus the text's
// padding and a small margin
const CHAR_WIDTH = 0.6
const LINE_HEIGHT = 1.2
const PAD_X = 12
const PAD_Y = 8

export const textSelectionBox = ({ x, y, text, fontSize }: Pick<TextShape, 'x' | 'y' | 'text' | 'fontSize'>): Box => ({
    x: x - 2,
    y: y - 2,
    w: Math.max(text.length * fontSize * CHAR_WIDTH, 100) + PAD_X,
    h: fontSize * LINE_HEIGHT + PAD_Y,
})

// Dragging a corner handle scales the text. The box grows or shrinks by as much as the pointer moves
// up or down (`dy`, on the canvas), which sets the font size, and the opposite corner stays where it
// was in `start`, the box when the drag began.
export const resizeText = (text: string, start: Box, corner: string, dy: number) => {
    const fromTop = corner === 'nw' || corner === 'ne'
    const fromLeft = corner === 'nw' || corner === 'sw'

    const height = start.h + (fromTop ? -dy : dy)
    const fontSize = Math.round(clamp((height - PAD_Y) / LINE_HEIGHT, MIN_FONT_SIZE, MAX_FONT_SIZE))

    // The new box, with its offset from the text's position
    const box = textSelectionBox({ x: 0, y: 0, text, fontSize })
    const boxX = fromLeft ? start.x + start.w - box.w : start.x
    const boxY = fromTop ? start.y + start.h - box.h : start.y

    return { x: boxX - box.x, y: boxY - box.y, fontSize }
}
