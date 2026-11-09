import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"
import { FRAME_BACKDROP, FRAME_TEXT, LINEA_THEME_COLORS, TAILWIND_PALETTE, TAILWIND_SHADES, colorsIn, oklchToRgb, over, parseColor, tailwindColor, toHex } from "./design-colors"

const hex = (value: string) => {
    const color = parseColor(value)
    return color && toHex(color)
}

describe("the palettes a design's frame uses", () => {
    it("are Tailwind's own, as the installed theme.css writes them", () => {
        const theme = readFileSync(createRequire(import.meta.url).resolve("tailwindcss/theme.css"), "utf8")
        const written = new Map([...theme.matchAll(/--color-([a-z]+-\d+):\s*oklch\(([^)]*)\);/g)].map((match) => [match[1], match[2]]))
        const ours = Object.entries(TAILWIND_PALETTE).flatMap(([name, shades]) => shades.map((value, index) => [`${name}-${TAILWIND_SHADES[index]}`, value] as const))
        expect(ours).toHaveLength(written.size)
        for (const [name, value] of ours) expect(value, name).toBe(written.get(name))
    })

    it("are Linea's dark theme colors, as globals.css writes them", () => {
        const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
        const dark = /\.dark\s*\{([^}]*)\}/.exec(globals)![1]
        const written = Object.fromEntries([...dark.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]))
        expect(LINEA_THEME_COLORS).toEqual(written)
    })

    it("show a design with no colors of its own in the app's text on the canvas", () => {
        expect(toHex(FRAME_TEXT)).toBe("#FAFAFA")
        // The canvas (#0A0A0A) under the design shape's 5% white
        expect(toHex(FRAME_BACKDROP)).toBe("#161616")
    })
})

describe("parseColor", () => {
    it("reads hex, rgb(), hsl(), oklch() and names", () => {
        expect(hex("#fff")).toBe("#FFFFFF")
        expect(hex("#0f766e")).toBe("#0F766E")
        expect(parseColor("#0f766e80")!.a).toBeCloseTo(0.5, 2)
        expect(hex("rgb(15, 118, 110)")).toBe("#0F766E")
        expect(parseColor("rgb(15 118 110 / 50%)")).toEqual({ r: 15, g: 118, b: 110, a: 0.5 })
        expect(parseColor("rgba(0,0,0,.1)")).toEqual({ r: 0, g: 0, b: 0, a: 0.1 })
        expect(hex("hsl(210 40% 98%)")).toBe("#F8FAFC")
        expect(hex("hsl(0, 100%, 50%)")).toBe("#FF0000")
        expect(hex("oklch(0.985 0 0)")).toBe("#FAFAFA")
        expect(hex("White")).toBe("#FFFFFF")
        expect(hex("rebeccapurple")).toBe("#663399")
        expect(parseColor("transparent")!.a).toBe(0)
    })

    it("returns null for what it can't know", () => {
        for (const value of ["currentColor", "var(--brand)", "color-mix(in oklab, red, blue)", "inherit", "#12345", "nonsense"]) expect(parseColor(value), value).toBeNull()
    })

    it("converts OKLCH as Tailwind's own sRGB fallbacks have it", () => {
        expect(toHex(oklchToRgb(1, 0, 0))).toBe("#FFFFFF")
        expect(toHex(oklchToRgb(0, 0, 0))).toBe("#000000")
        expect(toHex(oklchToRgb(0.637, 0.237, 25.331))).toBe("#FB2C36")
    })

    it("draws a see-through color over another", () => {
        expect(toHex(over({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 }))).toBe("#808080")
    })
})

describe("tailwindColor", () => {
    it("resolves palette, white and black, with an opacity", () => {
        expect(toHex(tailwindColor("red-500")!.color)).toBe("#FB2C36")
        expect(toHex(tailwindColor("green-100")!.color)).toBe("#DCFCE7")
        expect(toHex(tailwindColor("green-800")!.color)).toBe("#016630")
        expect(tailwindColor("white/80")!.color).toEqual({ r: 255, g: 255, b: 255, a: 0.8 })
        expect(tailwindColor("black/[0.35]")!.color.a).toBeCloseTo(0.35)
        expect(tailwindColor("red-550")).toBeNull()
        expect(tailwindColor("center")).toBeNull()
    })

    it("marks Linea's own theme colors, which are the app's dark ones in a frame", () => {
        expect(tailwindColor("primary")).toEqual({ color: { r: 229, g: 229, b: 229, a: 1 }, theme: true })
        expect(toHex(tailwindColor("muted-foreground")!.color)).toBe("#A1A1A1")
        expect(tailwindColor("teal-600")!.theme).toBe(false)
    })

    it("reads arbitrary values and variables, and a slash inside brackets isn't the opacity's", () => {
        expect(toHex(tailwindColor("[#0F766E]")!.color)).toBe("#0F766E")
        expect(tailwindColor("[rgb(0_0_0/0.5)]")!.color).toEqual({ r: 0, g: 0, b: 0, a: 0.5 })
        expect(tailwindColor("[#0F766E]/50")!.color.a).toBe(0.5)
        expect(toHex(tailwindColor("(--brand)", (name) => (name === "--brand" ? "#C58066" : null))!.color)).toBe("#C58066")
        expect(toHex(tailwindColor("[color:var(--brand)]", (name) => (name === "--brand" ? "#C58066" : null))!.color)).toBe("#C58066")
        expect(tailwindColor("[14px]")).toBeNull()
    })
})

describe("colorsIn", () => {
    it("finds every literal color in a value", () => {
        expect(colorsIn("1px solid #E2E8F0").map((found) => found.text)).toEqual(["#E2E8F0"])
        expect(colorsIn("linear-gradient(to right, #fff, rgb(0 0 0 / 5%)) , red").map((found) => found.text)).toEqual(["#fff", "rgb(0 0 0 / 5%)", "red"])
    })

    it("skips a variable's name and an address", () => {
        expect(colorsIn("var(--brand-red)")).toEqual([])
        expect(colorsIn("url(#fade)")).toEqual([])
        expect(colorsIn("solid transparent")).toEqual([])
    })
})
