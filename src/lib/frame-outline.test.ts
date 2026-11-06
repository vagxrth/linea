import { describe, expect, it } from "vitest"
import type { FrameShape, Shape } from "@/redux/slice/shapes"
import { frameOutline } from "./frame-outline"

const base = { stroke: "#ffffff", strokeWidth: 2, fill: null }
const frame = { ...base, id: "f", type: "frame", x: 0, y: 0, w: 1000, h: 800, frameNumber: 1 } as FrameShape
const rect = (id: string, x: number, y: number, w: number, h: number) => ({ ...base, id, type: "rect", x, y, w, h }) as Shape
const text = (id: string, x: number, y: number, value: string) =>
    ({ ...base, id, type: "text", x, y, text: value, fontSize: 16, fontFamily: "Geist", fontWeight: 400, fontStyle: "normal", textAlign: "left", textDecoration: "none", lineHeight: 1.2, letterSpacing: 0, textTransform: "none" }) as Shape
const line = (id: string, startX: number, startY: number, endX: number, endY: number) => ({ ...base, id, type: "line", startX, startY, endX, endY }) as Shape

// The demo's wireframe: a navbar, a hero with a headline, text, a button and a crossed-out image, and three cards
const wireframe: Shape[] = [
    rect("nav", 20, 20, 960, 60), text("nav-label", 80, 35, "navbar"),
    { ...base, id: "logo", type: "ellipse", x: 30, y: 30, w: 30, h: 30 } as Shape,
    text("headline", 30, 120, "headline"),
    { ...base, id: "scribble", type: "freedraw", points: [{ x: 30, y: 150 }, { x: 160, y: 165 }, { x: 300, y: 150 }] } as Shape,
    rect("image", 500, 110, 460, 300), line("x1", 502, 112, 958, 408), line("x2", 958, 112, 502, 408), text("image-label", 680, 250, "hero image"),
    rect("button", 30, 300, 150, 50), text("button-label", 60, 312, "button"),
    rect("card-1", 30, 500, 300, 250), text("card-1-label", 50, 520, "card"),
    rect("card-2", 350, 500, 300, 250), text("card-2-label", 370, 520, "card"),
    rect("card-3", 670, 500, 300, 250), text("card-3-label", 690, 520, "card"),
]

describe("frame outline", () => {
    const outline = frameOutline(frame, wireframe).split("\n")

    it("starts with the frame's size and how to read the positions", () => {
        expect(outline[0]).toBe("Frame 1: 1000 × 800 px, landscape. Positions are percent of the frame, x across and y down; indented items sit inside the box above them.")
    })

    it("lists the boxes in reading order, each with the label written in it", () => {
        expect(outline.slice(1)).toEqual([
            '- box "navbar", x 2–98%, y 3–10%',
            "  - circle, x 3–6%, y 4–8%",
            "- 2 columns side by side:",
            "  - column, x 3–30%:",
            '    - text "headline", at x 3%, y 15%',
            "    - scribble, x 3–30%, y 19–21%",
            '    - box "button", x 3–18%, y 38–44%',
            "  - column, x 50–96%:",
            '    - image slot (crossed box) "hero image", x 50–96%, y 14–51%',
            "- row of 3 side by side:",
            '  - box "card", x 3–33%, y 63–94%',
            '  - box "card", x 35–65%, y 63–94%',
            '  - box "card", x 67–97%, y 63–94%',
        ])
    })

    it("keeps a box's further text inside it, and leaves out the placeholder of an untouched text box", () => {
        const lines = frameOutline(frame, [rect("card", 0, 0, 400, 400), text("a", 10, 10, "card"), text("b", 10, 200, "price"), text("c", 10, 300, "Type here...")]).split("\n")
        expect(lines.slice(1)).toEqual(['- box "card", x 0–40%, y 0–50%', '  - text "price", at x 1%, y 25%'])
    })

    it("reads a hand-drawn column top to bottom, though its left edges wander", () => {
        const lines = frameOutline(frame, [
            text("headline", 34, 100, "headline"),
            rect("button", 28, 300, 120, 40),
            line("copy", 31, 200, 300, 200),
            rect("image", 500, 80, 400, 300),
        ]).split("\n")
        expect(lines.slice(1).map((line) => line.split(",")[0].trim())).toEqual([
            "- 2 columns side by side:", "- column", '- text "headline"', "- line", "- box", "- column", "- box",
        ])
        expect(lines[5]).toContain("x 3–15%")
    })

    it("doesn't group a row of boxes of different sizes", () => {
        const lines = frameOutline(frame, [rect("small", 0, 0, 100, 50), rect("big", 200, 0, 600, 400)]).split("\n")
        expect(lines).not.toContain("- row of 2 side by side:")
    })
})
