import { describe, expect, it } from "vitest"
import { sketchThumbnail } from "./thumbnail"
import { isGradientPlaceholder } from "../src/lib/project-thumbnail"

// A saved drawing, as the canvas saves it: an entity state of shapes, in drawing order
const drawing = (...shapes: Record<string, unknown>[]) => ({
    shapes: {
        ids: shapes.map((_, index) => `s${index}`),
        entities: Object.fromEntries(shapes.map((shape, index) => [`s${index}`, { id: `s${index}`, stroke: "#ffffff", strokeWidth: 2, ...shape }])),
    },
    frameCounter: 1,
})

const svgOf = (dataUrl: string | undefined) => {
    expect(dataUrl).toMatch(/^data:image\/svg\+xml;base64,/)
    return atob(dataUrl!.split(",")[1])
}

describe("sketch thumbnail", () => {
    it("is undefined for an empty drawing, or none at all", () => {
        expect(sketchThumbnail(drawing())).toBeUndefined()
        expect(sketchThumbnail(undefined)).toBeUndefined()
        expect(sketchThumbnail({ shapes: { ids: ["x"], entities: {} } })).toBeUndefined()
    })

    it("draws the frame, boxes, strokes, text and designs that were saved", () => {
        const svg = svgOf(sketchThumbnail(drawing(
            { type: "frame", x: 0, y: 0, w: 800, h: 600, frameNumber: 1 },
            { type: "rect", x: 20, y: 20, w: 760, h: 60 },
            { type: "ellipse", x: 30, y: 30, w: 40, h: 40 },
            { type: "freedraw", points: [{ x: 40, y: 200 }, { x: 80, y: 210 }, { x: 120, y: 200 }] },
            { type: "line", startX: 40, startY: 300, endX: 300, endY: 300 },
            { type: "arrow", startX: 400, startY: 400, endX: 500, endY: 450 },
            { type: "text", x: 100, y: 40, text: "navbar", fontSize: 16 },
            { type: "generatedui", x: 900, y: 0, w: 800, h: 1200, uiSpecData: "<div>…</div>" },
        )))
        expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 240"')
        expect(svg.match(/<rect x=/g)).toHaveLength(3)
        expect(svg).toContain("<ellipse")
        expect(svg.match(/<polyline/g)).toHaveLength(3)
        expect(svg).toContain("<line")
        expect(svg).toContain(">navbar</text>")
        // The design is a light page, not its HTML
        expect(svg).toContain('fill="#ece7df"')
        expect(svg).not.toContain("<div>")
    })

    it("fits the drawing in the picture, without blowing up a small one", () => {
        const big = svgOf(sketchThumbnail(drawing({ type: "rect", x: 1000, y: 1000, w: 2000, h: 1000 })))
        // 320 × 0.84 / 2000 wide, 240 × 0.84 / 1000 tall: the width limits it
        expect(big).toContain("scale(0.1344)")
        const small = svgOf(sketchThumbnail(drawing({ type: "rect", x: 0, y: 0, w: 40, h: 30 })))
        expect(small).toContain("scale(1)")
    })

    it("escapes text, and keeps attributes to plain colors", () => {
        const svg = svgOf(sketchThumbnail(drawing(
            { type: "text", x: 0, y: 0, text: 'Café <b>&"', fontSize: 16, fill: '"/><script>' },
            { type: "rect", x: 0, y: 40, w: 100, h: 50, stroke: "red", fill: "#1a2b3c" },
        )))
        expect(svg).toContain(">Caf&#233; &lt;b&gt;&amp;\"</text>")
        expect(svg).not.toContain("<script>")
        expect(svg).toContain('fill="#ffffff">Caf')
        expect(svg).toContain('fill="#1a2b3c" stroke="red"')
    })

    it("thins long strokes", () => {
        const points = Array.from({ length: 500 }, (_, index) => ({ x: index, y: Math.sin(index / 10) * 50 }))
        const svg = svgOf(sketchThumbnail(drawing({ type: "freedraw", points })))
        const drawn = svg.match(/<polyline points="([^"]+)"/)![1].split(" ")
        expect(drawn).toHaveLength(48)
        // The stroke still ends where it ended
        expect(drawn.at(-1)).toBe(`499,${Math.round(Math.sin(49.9) * 50)}`)
    })

    it("isn't taken for one of the old gradient placeholders", () => {
        expect(isGradientPlaceholder(sketchThumbnail(drawing({ type: "rect", x: 0, y: 0, w: 10, h: 10 }))!)).toBe(false)
    })
})
