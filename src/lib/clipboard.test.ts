import { describe, expect, it } from "vitest"
import type { Shape } from "@/redux/slice/shapes"
import { pasteOffset, shapesFromClipboard, shapesToClipboard } from "./clipboard"

const rect = { id: "r1", type: "rect", x: 10, y: 10, w: 40, h: 30, stroke: "#fff", strokeWidth: 2, fill: null } as Shape
const copied = (shapes: unknown[]) => JSON.stringify({ type: "linea/shapes", shapes })

describe("clipboard text", () => {
    it("reads back the shapes it wrote", () => {
        expect(shapesFromClipboard(shapesToClipboard([rect]))).toEqual([rect])
    })

    it("ignores text that isn't shapes copied from Linea", () => {
        expect(shapesFromClipboard("Hello")).toBeNull()
        expect(shapesFromClipboard(JSON.stringify({ shapes: [rect] }))).toBeNull()
        expect(shapesFromClipboard(copied([]))).toBeNull()
        expect(shapesFromClipboard(undefined)).toBeNull()
    })

    it("drops shapes without the fields they're drawn by", () => {
        const text = copied([
            rect,
            { ...rect, id: "r2", x: "10" },
            { id: "u1", type: "unknown", x: 0, y: 0 },
            { id: "s1", type: "freedraw", points: [{ x: 0, y: 0 }] },
        ])
        expect(shapesFromClipboard(text)).toEqual([rect])
    })
})

describe("where pasted shapes go", () => {
    const bounds = { x: 100, y: 100, width: 50, height: 40 }
    const view = { x: 0, y: 0, width: 800, height: 600 }

    it("steps each paste of the same copy further down and to the right", () => {
        expect(pasteOffset(bounds, view, 1)).toEqual({ x: 20, y: 20 })
        expect(pasteOffset(bounds, view, 2)).toEqual({ x: 40, y: 40 })
    })

    it("puts shapes that were cut back in place", () => {
        expect(pasteOffset(bounds, view, 0)).toEqual({ x: 0, y: 0 })
    })

    it("centers shapes in the view when their spot is out of view", () => {
        const elsewhere = { x: 5000, y: 5000, width: 800, height: 600 }
        const offset = pasteOffset(bounds, elsewhere, 1)
        expect(bounds.x + bounds.width / 2 + offset.x).toBe(5400)
        expect(bounds.y + bounds.height / 2 + offset.y).toBe(5300)
    })
})
