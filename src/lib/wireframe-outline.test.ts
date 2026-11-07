import { describe, expect, it } from "vitest"
import {
    countNodes,
    isComponentLabel,
    MAX_OUTLINE_NODES,
    OUTLINE_VERSION,
    outlineImageSlots,
    outlineText,
    parseOutline,
    truncateOutline,
    type FrameOutline,
    type OutlineNode,
} from "./wireframe-outline"

const frame = { id: "frame", number: 1, width: 1000, height: 800 }
const outlineOf = (nodes: OutlineNode[], extra: Partial<FrameOutline> = {}): FrameOutline => ({ version: OUTLINE_VERSION, frame, nodes, ...extra })

// A card: a box with a label and two lines of copy inside it
const card = (id: string, left: number, top: number): OutlineNode => ({
    id, kind: "box", label: "card", box: [left, top, left + 20, top + 8],
    children: [
        { id: `${id}-a`, kind: "line", box: [left + 1, top + 2, left + 19, top + 3] },
        { id: `${id}-b`, kind: "line", box: [left + 1, top + 4, left + 15, top + 5] },
    ],
})

// A busy page: 10 rows of 4 cards, 12 nodes a row, 120 in all
const busy = Array.from({ length: 10 }, (_, row) => [0, 25, 50, 75].map((left, column) => card(`r${row}c${column}`, left, row * 10))).flat()

describe("labels and copy", () => {
    it("tells a component's name from words for the page", () => {
        for (const name of ["navbar", "hero image", "card 2", "Big Button here", "pricing table", "price", "headline"]) {
            expect(isComponentLabel(name), name).toBe(true)
        }
        // Real headings, and page names that are more likely links to show
        for (const copy of ["Fresh plants every week", "Pricing", "About", "Shop the spring sale", "Welcome home", ""]) {
            expect(isComponentLabel(copy), copy).toBe(false)
        }
    })
})

describe("truncation", () => {
    it("keeps an outline that fits as it is", () => {
        const outline = outlineOf(busy.slice(0, 8))
        expect(truncateOutline(outline)).toBe(outline)
        expect(outlineText(outline)).not.toContain("OUTLINE INCOMPLETE")
    })

    it("cuts a busy frame a whole row at a time and says what it left out", () => {
        const cut = truncateOutline(outlineOf(busy), 50)
        // 4 rows of 12 fit in 50; the fifth would split, so it goes whole
        expect(countNodes(cut.nodes)).toBe(48)
        expect(cut.nodes.map((node) => node.id)).toEqual(busy.slice(0, 16).map((node) => node.id))
        expect(cut.truncated).toEqual({ totalNodes: 120, listedNodes: 48, omittedRows: 6, fromY: 40, partialRow: false })
        const text = outlineText(cut)
        expect(text).toContain("OUTLINE INCOMPLETE: it lists 48 of 120 items. Not listed: 6 top-level rows from y 40% down.")
        expect(text).toContain("Build those parts from the wireframe image")
        // Every listed row still says it has 4 cards
        expect(text.match(/row of 4 side by side/g)).toHaveLength(4)
    })

    it("lists the top of a page drawn inside one big box, fitting its rows inside it", () => {
        const page: OutlineNode = { id: "page", kind: "box", label: "section", box: [0, 0, 100, 100], children: busy }
        const cut = truncateOutline(outlineOf([page]), 30)
        expect(cut.nodes).toHaveLength(1)
        // The box plus two whole rows of its cards
        expect(countNodes(cut.nodes)).toBe(25)
        expect(cut.nodes[0].children!.map((node) => node.id)).toEqual(busy.slice(0, 8).map((node) => node.id))
        expect(cut.truncated).toMatchObject({ totalNodes: 121, listedNodes: 25, omittedRows: 0, partialRow: true })
        expect(outlineText(cut)).toContain("Not listed: some items nested inside the listed boxes.")
    })

    it("keeps the larger counts when an outline that was already cut is cut again", () => {
        const first = truncateOutline(outlineOf(busy), 72)
        const second = truncateOutline(first, 30)
        expect(second.truncated).toEqual({ totalNodes: 120, listedNodes: 24, omittedRows: 8, fromY: 20, partialRow: false })
    })
})

describe("parseOutline", () => {
    const valid = outlineOf([card("a", 0, 0), { id: "t", kind: "text", text: "Fresh plants", box: [0, 20, 30, 24] }])

    it("accepts the canvas's outline", () => {
        expect(parseOutline(JSON.stringify(valid))).toEqual(valid)
    })

    it("refuses anything that isn't one", () => {
        expect(parseOutline("box \"navbar\", x 2–98%")).toBeNull()
        expect(parseOutline(JSON.stringify({ ...valid, nodes: [{ id: "x", kind: "button", box: [0, 0, 1, 1] }] }))).toBeNull()
        expect(parseOutline(JSON.stringify({ ...valid, nodes: [{ id: "x", kind: "box", box: [0, 0, 1] }] }))).toBeNull()
        expect(parseOutline(JSON.stringify({ ...valid, frame: { ...frame, width: -1 } }))).toBeNull()
    })

    it("refuses outlines too deep or too big, and cuts long ones down to the limit", () => {
        let deep: OutlineNode = { id: "leaf", kind: "box", box: [0, 0, 1, 1] }
        for (let level = 0; level < 9; level++) deep = { id: `level-${level}`, kind: "box", box: [0, 0, 100, 100], children: [deep] }
        expect(parseOutline(JSON.stringify(outlineOf([deep])))).toBeNull()
        const huge = Array.from({ length: 101 }, (_, row) => [0, 25, 50, 75].map((left, column) => ({ id: `${row}-${column}`, kind: "box" as const, box: [left, row, left + 20, row + 0.5] as [number, number, number, number] }))).flat()
        expect(parseOutline(JSON.stringify(outlineOf(huge)))).toBeNull()
        // 20 rows of 4 shorter cards: 240 nodes
        const short = (id: string, left: number, top: number): OutlineNode => ({
            id, kind: "box", box: [left, top, left + 20, top + 4],
            children: [{ id: `${id}-a`, kind: "line", box: [left + 1, top + 1, left + 19, top + 2] }, { id: `${id}-b`, kind: "line", box: [left + 1, top + 2.5, left + 15, top + 3] }],
        })
        const tall = Array.from({ length: 20 }, (_, row) => [0, 25, 50, 75].map((left, column) => short(`${row}-${column}`, left, row * 5))).flat()
        const long = parseOutline(JSON.stringify(outlineOf(tall)))!
        expect(countNodes(long.nodes)).toBe(MAX_OUTLINE_NODES)
        expect(long.truncated).toMatchObject({ totalNodes: 240, listedNodes: 120, omittedRows: 10, fromY: 50 })
    })
})

describe("as prompt text", () => {
    it("shows each item's id, marks copy apart from component names, and gives image slots their shape", () => {
        const text = outlineText(outlineOf([
            { id: "nav", kind: "box", label: "navbar", box: [2, 3, 98, 10], children: [{ id: "links", kind: "text", text: "Plants Care About", box: [60, 5, 80, 8] }] },
            { id: "h", kind: "text", label: "headline", box: [3, 15, 30, 18] },
            { id: "img", kind: "image", label: "hero image", box: [50, 14, 96, 51] },
        ]))
        expect(text.split("\n").slice(1)).toEqual([
            '- box "navbar" [nav], x 2–98%, y 3–10%',
            '  - copy "Plants Care About" [links], at x 60%, y 5%',
            '- text "headline" [h] (a component\'s name), at x 3%, y 15%',
            '- image slot "hero image" [img], x 50–96%, y 14–51%, aspect 1.55',
        ])
    })

    it("lists image slots in reading order with their aspect ratio in the frame's pixels", () => {
        const slots = outlineImageSlots(outlineOf([
            { id: "wide", kind: "image", box: [0, 50, 100, 75] },
            { id: "box", kind: "box", box: [0, 0, 100, 40], children: [{ id: "small", kind: "image", box: [10, 5, 30, 30] }] },
        ]))
        expect(slots).toEqual([
            { node: "small", label: undefined, aspectRatio: 1, box: [10, 5, 30, 30] },
            { node: "wide", label: undefined, aspectRatio: 5, box: [0, 50, 100, 75] },
        ])
    })
})
