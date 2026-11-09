import { describe, expect, it } from "vitest"
import type { FrameShape, Shape } from "@/redux/slice/shapes"
import { frameOutline } from "./frame-outline"
import { MAX_OUTLINE_NODES, countNodes, outlineImageSlots, outlineText, parseOutline } from "./wireframe-outline"

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
    const outline = frameOutline(frame, wireframe)
    const lines = outlineText(outline).split("\n")

    it("is versioned, names its frame, and isn't cut when it fits", () => {
        expect(outline.version).toBe(1)
        expect(outline.frame).toEqual({ id: "f", number: 1, width: 1000, height: 800 })
        expect(outline.truncated).toBeUndefined()
        expect(lines[0]).toBe("Frame 1: 1000 × 800 px, landscape. Positions are percent of the frame, x across and y down; indented items sit inside the box above them. [id] is the canvas shape each item comes from.")
    })

    it("lists the boxes in reading order with their shape ids and the label written in each", () => {
        expect(lines.slice(1)).toEqual([
            '- box "navbar" [nav], x 2–98%, y 3–10%',
            "  - circle [logo], x 3–6%, y 4–8%",
            "- 2 columns side by side:",
            "  - column, x 3–30%:",
            '    - text "headline" [headline] (a component\'s name), at x 3%, y 15%',
            "    - scribble [scribble], x 3–30%, y 19–21%",
            '    - box "button" [button], x 3–18%, y 38–44%',
            "  - column, x 50–96%:",
            '    - image slot "hero image" [image], x 50–96%, y 14–51%, aspect 1.54',
            "- row of 3 side by side:",
            '  - box "card" [card-1], x 3–33%, y 63–94%',
            '  - box "card" [card-2], x 35–65%, y 63–94%',
            '  - box "card" [card-3], x 67–97%, y 63–94%',
        ])
    })

    it("still produces an outline when a navbar is drawn past both sides of the frame", () => {
        // From x -80 to 1080 in the 1000px frame: -8% to 108%, clamped to just outside the frame
        const wide = frameOutline(frame, [rect("nav", -80, 20, 1160, 60), text("nav-label", 80, 35, "navbar"), rect("card", 30, 500, 300, 250)])
        expect(wide.nodes[0]).toEqual({ id: "nav", kind: "box", label: "navbar", box: [-5, 2.5, 105, 10] })
        // And the server takes it as it is
        expect(parseOutline(JSON.stringify(wide))).toEqual(wide)
    })

    it("gives the crossed box to the image slots, with its shape", () => {
        // From the box as the outline rounds it, to a tenth of a percent
        expect(outlineImageSlots(outline)).toEqual([{ node: "image", label: "hero image", aspectRatio: 1.54, box: [50, 13.8, 96, 51.2] }])
    })

    it("keeps a heading written on the canvas as copy rather than taking it for the box's label", () => {
        const hero = frameOutline(frame, [rect("hero", 0, 0, 1000, 400), text("title", 40, 40, "Fresh plants every week"), text("cta", 40, 300, "button")])
        expect(hero.nodes).toEqual([{
            id: "hero", kind: "box", box: [0, 0, 100, 50],
            children: [
                { id: "title", kind: "text", text: "Fresh plants every week", box: expect.any(Array) },
                { id: "cta", kind: "text", label: "button", box: expect.any(Array) },
            ],
        }])
        expect(outlineText(hero)).toContain('  - copy "Fresh plants every week" [title], at x 4%, y 5%')
    })

    it("takes only the first text, from the top left, as the label, and only when it names a component", () => {
        const lines = outlineText(frameOutline(frame, [rect("card", 0, 0, 400, 400), text("b", 10, 200, "price"), text("a", 10, 10, "card"), text("c", 10, 300, "Type here...")])).split("\n")
        expect(lines.slice(1)).toEqual(['- box "card" [card], x 0–40%, y 0–50%', '  - text "price" [b] (a component\'s name), at x 1%, y 25%'])
    })

    it("nests boxes inside boxes, however deep", () => {
        const nested = frameOutline(frame, [
            rect("sidebar", 0, 0, 200, 800), text("side-label", 10, 10, "sidebar"),
            rect("nav-1", 10, 60, 180, 40), text("nav-1-text", 20, 70, "Orders"),
            rect("nav-2", 10, 110, 180, 40), text("nav-2-text", 20, 120, "Customers"),
            rect("main", 220, 0, 780, 800),
            rect("panel", 240, 20, 740, 300), text("panel-label", 250, 30, "chart"),
            rect("bar", 260, 100, 40, 200),
        ])
        expect(nested.nodes.map((node) => node.id)).toEqual(["sidebar", "main"])
        const [sidebar, main] = nested.nodes
        expect(sidebar.label).toBe("sidebar")
        expect(sidebar.children!.map((node) => [node.id, node.children?.[0].text])).toEqual([["nav-1", "Orders"], ["nav-2", "Customers"]])
        expect(main.children![0]).toMatchObject({ id: "panel", label: "chart", children: [{ id: "bar", kind: "box" }] })
        expect(outlineText(nested)).toContain('    - box [bar], x 26–30%, y 13–38%')
    })

    it("cuts a busy frame down to the limit a whole row at a time", () => {
        // 30 rows of 4 labelled cards, each with two lines: 360 nodes
        const shapes = Array.from({ length: 30 }, (_, row) => [0, 250, 500, 750].flatMap((x, column) => {
            const id = `c${row}-${column}`
            return [rect(id, x + 5, row * 26 + 2, 240, 22), text(`${id}-t`, x + 10, row * 26 + 3, "card"), line(`${id}-l1`, x + 10, row * 26 + 12, x + 200, row * 26 + 12), line(`${id}-l2`, x + 10, row * 26 + 18, x + 150, row * 26 + 18)]
        })).flat()
        const busy = frameOutline(frame, shapes)
        expect(countNodes(busy.nodes)).toBeLessThanOrEqual(MAX_OUTLINE_NODES)
        // Whole rows of 4 cards, each a box with its two lines
        expect(busy.nodes).toHaveLength(40)
        expect(busy.truncated).toEqual({ totalNodes: 360, listedNodes: 120, omittedRows: 20, fromY: 32.8, partialRow: false })
        expect(outlineText(busy)).toContain("OUTLINE INCOMPLETE: it lists 120 of 360 items. Not listed: 20 top-level rows from y 33% down.")
    })

    it("shortens long shape ids to 8 characters, and keeps whole ones that would clash", () => {
        const long = frameOutline({ ...frame, id: "FRAME-ID-0123456789" }, [rect("V1StGXR8_Z5jdHi6B-myT", 0, 0, 100, 100), rect("abcdefgh-one-1234567", 200, 0, 100, 100), rect("abcdefgh-two-1234567", 400, 0, 100, 100)])
        expect(long.frame.id).toBe("FRAME-ID")
        expect(long.nodes.flatMap((node) => [node.id, ...(node.children ?? []).map((child) => child.id)])).toEqual(["V1StGXR8", "abcdefgh-one-1234567", "abcdefgh-two-1234567"])
    })

    it("reads a hand-drawn column top to bottom, though its left edges wander", () => {
        const lines = outlineText(frameOutline(frame, [
            text("headline", 34, 100, "headline"),
            rect("button", 28, 300, 120, 40),
            line("copy", 31, 200, 300, 200),
            rect("image", 500, 80, 400, 300),
        ])).split("\n")
        expect(lines.slice(1).map((entry) => entry.split(",")[0].trim())).toEqual([
            "- 2 columns side by side:", "- column", '- text "headline" [headline] (a component\'s name)', "- line [copy]", "- box [button]", "- column", "- box [image]",
        ])
        expect(lines[5]).toContain("x 3–15%")
    })

    it("doesn't group a row of boxes of different sizes", () => {
        const lines = outlineText(frameOutline(frame, [rect("small", 0, 0, 100, 50), rect("big", 200, 0, 600, 400)])).split("\n")
        expect(lines).not.toContain("- row of 2 side by side:")
    })
})
