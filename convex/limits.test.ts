import { describe, expect, it } from "vitest"
import { convexSize, tooLargeForDocument } from "./limits"

// An object with `count` small entries
const entries = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`s${i}`, 1]))

describe("convexSize", () => {
    it("counts values the way Convex does", () => {
        expect(convexSize(null)).toBe(1)
        expect(convexSize(true)).toBe(1)
        expect(convexSize(3.5)).toBe(9)
        expect(convexSize(BigInt(10))).toBe(9)
        expect(convexSize("abc")).toBe(5)
        // Strings count their UTF-8 bytes
        expect(convexSize("é")).toBe(4)
        expect(convexSize("😀")).toBe(6)
        expect(convexSize([1, "a"])).toBe(2 + 9 + 3)
        expect(convexSize({ x: 1, label: "a" })).toBe(2 + (1 + 1 + 9) + (5 + 1 + 3))
        // A field set to undefined isn't stored
        expect(convexSize({ x: 1, y: undefined })).toBe(2 + (1 + 1 + 9))
    })

    it("counts objects and arrays longer than Convex allows as too large", () => {
        expect(convexSize(entries(1024))).toBeLessThan(Infinity)
        expect(convexSize(entries(1025))).toBe(Infinity)
        expect(convexSize(new Array(8192).fill(0))).toBeLessThan(Infinity)
        expect(convexSize(new Array(8193).fill(0))).toBe(Infinity)
    })
})

describe("tooLargeForDocument", () => {
    it("allows up to 1 MiB, counting the _id and _creationTime Convex adds", () => {
        // Besides the text: the object (2), the key "text" (4 + 1), the string (2) and the system fields (61)
        const room = (1 << 20) - 2 - 5 - 2 - 61
        expect(tooLargeForDocument({ text: "a".repeat(room) })).toBe(false)
        expect(tooLargeForDocument({ text: "a".repeat(room + 1) })).toBe(true)
    })

    it("refuses an object with too many entries, however small", () => {
        expect(tooLargeForDocument({ shapes: entries(1024) })).toBe(false)
        expect(tooLargeForDocument({ shapes: entries(1025) })).toBe(true)
    })
})
