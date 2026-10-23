import { describe, expect, it } from "vitest"
import { resizeText, textSelectionBox } from "./text-box"

// Long enough to be wider than the 100px minimum, so its box widens with the font size
const shape = { x: 100, y: 100, text: "Hello world", fontSize: 16 }
const start = textSelectionBox(shape)
// How far a handle moves to take the font size from 16 to 32: the box grows by 16 lines of 1.2
const toDouble = 16 * 1.2

const boxAfter = (corner: string, dy: number) =>
    textSelectionBox({ ...resizeText(shape.text, start, corner, dy), text: shape.text })

describe("text selection box", () => {
    it("is estimated from the font size and length, and is at least 100 wide", () => {
        expect(start.x).toBe(98)
        expect(start.y).toBe(98)
        expect(start.w).toBeCloseTo(117.6)
        expect(start.h).toBeCloseTo(27.2)
        expect(textSelectionBox({ ...shape, text: "Hi" }).w).toBe(112)
    })
})

describe("resizing text", () => {
    it("scales the font size with the bottom-right handle and keeps the top-left corner", () => {
        expect(resizeText(shape.text, start, "se", toDouble)).toEqual({ x: 100, y: 100, fontSize: 32 })
    })

    it("keeps the corner opposite each handle in place", () => {
        const nw = boxAfter("nw", -toDouble)
        expect(nw.x + nw.w).toBeCloseTo(start.x + start.w)
        expect(nw.y + nw.h).toBeCloseTo(start.y + start.h)

        const ne = boxAfter("ne", -toDouble)
        expect(ne.x).toBeCloseTo(start.x)
        expect(ne.y + ne.h).toBeCloseTo(start.y + start.h)

        const sw = boxAfter("sw", toDouble)
        expect(sw.x + sw.w).toBeCloseTo(start.x + start.w)
        expect(sw.y).toBeCloseTo(start.y)
    })

    it("shrinks the text when a handle moves inward", () => {
        expect(resizeText(shape.text, start, "se", -6).fontSize).toBe(11)
        expect(resizeText(shape.text, start, "nw", 6).fontSize).toBe(11)
    })

    it("keeps whole font sizes, so a tiny move doesn't change the size", () => {
        expect(resizeText(shape.text, start, "se", 0.5).fontSize).toBe(16)
        expect(resizeText(shape.text, start, "se", 1.2).fontSize).toBe(17)
    })

    it("stays within the font size slider's range of 8 to 128", () => {
        expect(resizeText(shape.text, start, "se", -1000).fontSize).toBe(8)
        expect(resizeText(shape.text, start, "nw", -5000).fontSize).toBe(128)
    })
})
