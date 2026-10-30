import { describe, expect, it } from "vitest"
import { tooLargeForDocument } from "./limits"

// An object with `count` small entries
const entries = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`s${i}`, 1]))

describe("tooLargeForDocument", () => {
    it("allows up to 1 MiB, counting the _id and _creationTime Convex adds", () => {
        // Besides the text: the object (2), the key "text" (4 + 1), the string (2) and the system fields (61)
        const room = (1 << 20) - 2 - 5 - 2 - 61
        expect(tooLargeForDocument({ text: "a".repeat(room) })).toBe(false)
        expect(tooLargeForDocument({ text: "a".repeat(room + 1) })).toBe(true)
    })

    it("counts strings in UTF-8 bytes", () => {
        // "é" is 2 bytes, so half as many fit
        const room = (1 << 20) - 2 - 5 - 2 - 61
        expect(tooLargeForDocument({ text: "é".repeat(room / 2) })).toBe(false)
        expect(tooLargeForDocument({ text: "é".repeat(room / 2 + 1) })).toBe(true)
    })

    it("refuses an object with too many entries, however small, at any depth", () => {
        expect(tooLargeForDocument({ shapes: entries(1024) })).toBe(false)
        expect(tooLargeForDocument({ shapes: entries(1025) })).toBe(true)
        expect(tooLargeForDocument({ shapes: { entities: entries(1025) } })).toBe(true)
        // A field set to undefined isn't stored, so it doesn't count
        expect(tooLargeForDocument({ shapes: { ...entries(1024), extra: undefined } })).toBe(false)
    })

    it("refuses an array with too many items, at any depth", () => {
        expect(tooLargeForDocument({ ids: new Array(8192).fill(0) })).toBe(false)
        expect(tooLargeForDocument({ ids: new Array(8193).fill(0) })).toBe(true)
        expect(tooLargeForDocument({ shapes: [{ ids: new Array(8193).fill(0) }] })).toBe(true)
    })
})
