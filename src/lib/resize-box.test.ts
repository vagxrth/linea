import { describe, expect, it } from "vitest"
import { resizeBox } from "./resize-box"

// Right edge at 300, bottom edge at 200
const start = { x: 100, y: 100, w: 200, h: 100 }

describe("resizing from a corner", () => {
    it("moves the dragged corner to the pointer and keeps the opposite corner in place", () => {
        expect(resizeBox(start, "nw", { x: 50, y: 80 })).toEqual({ x: 50, y: 80, w: 250, h: 120 })
        expect(resizeBox(start, "ne", { x: 350, y: 60 })).toEqual({ x: 100, y: 60, w: 250, h: 140 })
        expect(resizeBox(start, "sw", { x: 60, y: 250 })).toEqual({ x: 60, y: 100, w: 240, h: 150 })
        expect(resizeBox(start, "se", { x: 400, y: 300 })).toEqual({ x: 100, y: 100, w: 300, h: 200 })
    })

    it("stops at 10×10 against the opposite corner when dragged past it, instead of sliding", () => {
        expect(resizeBox(start, "nw", { x: 900, y: 900 })).toEqual({ x: 290, y: 190, w: 10, h: 10 })
        expect(resizeBox(start, "ne", { x: -500, y: 900 })).toEqual({ x: 100, y: 190, w: 10, h: 10 })
        expect(resizeBox(start, "sw", { x: 900, y: -500 })).toEqual({ x: 290, y: 100, w: 10, h: 10 })
        expect(resizeBox(start, "se", { x: -500, y: -500 })).toEqual({ x: 100, y: 100, w: 10, h: 10 })
    })

    it("can still shrink one side to the limit while the other resizes", () => {
        expect(resizeBox(start, "nw", { x: 500, y: 40 })).toEqual({ x: 290, y: 40, w: 10, h: 160 })
    })
})
