import { describe, expect, it } from "vitest"
import type { Shape } from "@/redux/slice/shapes"
import { zoomToFit } from "@/redux/slice/viewport"
import { contentBounds, fitToContent } from "./shape-bounds"

const rect = { id: "r1", type: "rect", x: 10, y: 10, w: 40, h: 30, stroke: "#fff", strokeWidth: 2, fill: null } as Shape
const line = { id: "l1", type: "line", startX: 100, startY: -20, endX: 60, endY: 50, stroke: "#fff", strokeWidth: 2, fill: null } as Shape
const view = { width: 1000, height: 800 }

describe("content bounds", () => {
    it("covers every shape", () => {
        expect(contentBounds([rect, line])).toEqual({ x: 10, y: -20, width: 90, height: 70 })
    })

    it("is null without shapes", () => {
        expect(contentBounds([])).toBeNull()
    })
})

describe("zoom to fit", () => {
    it("fits every shape at no more than 100%, leaving room for the bars over the canvas", () => {
        expect(fitToContent([rect], view)).toEqual(
            zoomToFit({ bounds: { x: 10, y: 10, width: 40, height: 30 }, viewportPx: view, padding: 96, maxScale: 1 })
        )
    })

    it("does nothing without shapes", () => {
        expect(fitToContent([], view)).toBeNull()
    })
})
