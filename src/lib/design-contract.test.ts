import { describe, expect, it } from "vitest"
import type { StyleGuide } from "@/redux/api/style-guide"
import {
    buildDesignContract,
    colorRoleOf,
    contractCorrections,
    contrastRatio,
    correctedForeground,
    DESIGN_CONTRACT_VERSION,
    LARGE_TEXT_CONTRAST,
    NORMAL_TEXT_CONTRAST,
    normalizeHex,
    typeRoleOf,
} from "./design-contract"

const swatch = (name: string, hexColor: string, description = "") => ({ name, hexColor, description })

// A guide as the style guide route writes them since PR #163: every swatch named after its role
const guide = {
    theme: "Organic Warmth",
    description: "Earthy and calm",
    colorSections: [
        { title: "Primary Colors", swatches: [swatch("Background", "#eaded3"), swatch("Foreground", "#343036"), swatch("Primary", "#C58066"), swatch("Primary Foreground", "#1F1B1D")] },
        { title: "Secondary & Accent Colors", swatches: [swatch("Secondary", "#5F9873"), swatch("Secondary Foreground", "#FFFFFF"), swatch("Accent", "#E4B77C"), swatch("Accent Foreground", "#343036")] },
        { title: "UI Component Colors", swatches: [swatch("Card", "#E3D6C9"), swatch("Card Foreground", "#343036"), swatch("Popover", "#E3D6C9"), swatch("Popover Foreground", "#343036"), swatch("Muted", "#DCCFC2"), swatch("Muted Foreground", "#5C5557")] },
        { title: "Utility & Form Colors", swatches: [swatch("Border", "#CBBBAB"), swatch("Input", "#E3D6C9"), swatch("Ring", "#C58066")] },
        { title: "Status & Feedback Colors", swatches: [swatch("Destructive", "#B3261E"), swatch("Destructive Foreground", "#FFFFFF")] },
    ],
    typographySections: [
        { title: "Headings", styles: [
            { name: "H1", fontFamily: "Lato, sans-serif", fontSize: "3rem", fontWeight: "700", lineHeight: "1.15", letterSpacing: "-0.02em" },
            { name: "H2", fontFamily: "Lato", fontSize: "2.25rem", fontWeight: "Bold", lineHeight: "tight" },
            { name: "H3", fontFamily: "Lato", fontSize: "24", fontWeight: "600", lineHeight: "32px" },
        ] },
        { title: "Body", styles: [
            { name: "Body", fontFamily: "Source Sans Pro", fontSize: "1rem", fontWeight: "regular", lineHeight: "1.6" },
            { name: "Small", fontFamily: "Source Sans Pro", fontSize: "0.875rem", fontWeight: "400", lineHeight: "1.5", letterSpacing: "0.01em" },
        ] },
        { title: "UI Elements", styles: [
            { name: "Button", fontFamily: "Source Sans Pro", fontSize: "1rem", fontWeight: "Semi Bold", lineHeight: "1", letterSpacing: "wide" },
            { name: "Label", fontFamily: "Source Sans Pro", fontSize: "0.875rem", fontWeight: "500", lineHeight: "1.4" },
        ] },
    ],
} as unknown as StyleGuide

describe("contrast", () => {
    it("computes WCAG ratios", () => {
        expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5)
        expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBe(1)
        expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2)
        // Order doesn't matter
        expect(contrastRatio("#FFFFFF", "#777777")).toBe(contrastRatio("#777777", "#FFFFFF"))
    })

    it("moves a failing text color just far enough, keeping the background", () => {
        const corrected = correctedForeground("#FFFFFF", "#999999")
        expect(contrastRatio("#FFFFFF", corrected)).toBeGreaterThanOrEqual(NORMAL_TEXT_CONTRAST)
        // Darker grey, not black: the smallest move that passes
        expect(corrected).not.toBe("#000000")
        expect(contrastRatio("#FFFFFF", corrected)).toBeLessThan(4.8)
    })

    it("turns the other way when the text's own direction can't reach 4.5:1", () => {
        // White text on yellow can't get lighter, so it goes dark
        const corrected = correctedForeground("#F2C14E", "#FFFFFF")
        expect(contrastRatio("#F2C14E", corrected)).toBeGreaterThanOrEqual(NORMAL_TEXT_CONTRAST)
        expect(contrastRatio(corrected, "#000000")).toBeLessThan(contrastRatio("#FFFFFF", "#000000"))
    })
})

describe("buildDesignContract", () => {
    const contract = buildDesignContract(guide)

    it("is versioned and the same every time for the same guide", () => {
        expect(contract.version).toBe(DESIGN_CONTRACT_VERSION)
        expect(buildDesignContract(guide)).toEqual(contract)
        expect(contract.theme).toEqual({ name: "Organic Warmth", description: "Earthy and calm" })
    })

    it("maps every swatch to its role, as uppercase hex", () => {
        expect(contract.colors.background).toBe("#EADED3")
        expect(contract.colors.secondary).toBe("#5F9873")
        expect(contract.colors.ring).toBe("#C58066")
        expect(contract.colors.destructiveForeground).toBe("#FFFFFF")
    })

    it("gives the heading, body and UI fonts with stacks, and the type scale with letter spacing", () => {
        expect(contract.fonts.heading).toEqual({ family: "Lato", stack: "'Lato', ui-sans-serif, system-ui, sans-serif" })
        expect(contract.fonts.body.family).toBe("Source Sans Pro")
        expect(contract.fonts.ui.family).toBe("Source Sans Pro")
        expect(contract.typeScale.h1).toEqual({ font: "heading", fontSize: "3rem", fontWeight: "700", lineHeight: "1.15", letterSpacing: "-0.02em", source: "guide" })
        // Words and bare numbers become CSS
        expect(contract.typeScale.h2).toMatchObject({ fontWeight: "700", lineHeight: "1.25", letterSpacing: "normal" })
        expect(contract.typeScale.h3).toMatchObject({ fontSize: "24px", lineHeight: "32px" })
        expect(contract.typeScale.body).toMatchObject({ font: "body", fontWeight: "400" })
        expect(contract.typeScale.small.letterSpacing).toBe("0.01em")
        // "wide" isn't a length, so it falls back
        expect(contract.typeScale.button).toMatchObject({ font: "ui", fontWeight: "600", letterSpacing: "normal" })
    })

    it("always has spacing for both densities, radius and a container width", () => {
        expect(contract.spacing.marketing.section).toContain("py-16")
        expect(contract.spacing.app.section).toContain("p-4")
        expect(contract.radius.card).toContain("rounded-xl")
        expect(contract.container.className).toBe("mx-auto max-w-7xl")
    })

    it("checks every surface and its text, and leaves the pairs that pass alone", () => {
        expect(contract.contrast.map((check) => `${check.background}/${check.foreground}`)).toEqual([
            "background/foreground", "card/cardForeground", "popover/popoverForeground", "primary/primaryForeground",
            "secondary/secondaryForeground", "muted/mutedForeground", "accent/accentForeground", "destructive/destructiveForeground",
        ])
        const body = contract.contrast[0]
        expect(body.normalText).toBe(true)
        expect(body.corrected).toBeUndefined()
        expect(contract.colors.foreground).toBe("#343036")
    })

    it("corrects a pair under 4.5:1 for normal text, documents it, and keeps the original on record", () => {
        // White on sage green is under 4.5:1
        const sage = contract.contrast.find((check) => check.background === "secondary")!
        expect(sage.ratio).toBeLessThan(NORMAL_TEXT_CONTRAST)
        expect(sage.normalText).toBe(false)
        expect(sage.largeText).toBe(sage.ratio >= LARGE_TEXT_CONTRAST)
        expect(sage.corrected!.original).toBe("#FFFFFF")
        expect(sage.corrected!.ratio).toBeGreaterThanOrEqual(NORMAL_TEXT_CONTRAST)
        // The design uses the corrected text color; the background stays the guide's
        expect(contract.colors.secondaryForeground).toBe(sage.corrected!.foreground)
        expect(contract.colors.secondary).toBe("#5F9873")
        expect(contractCorrections(contract)).toContain(sage)
        expect(contract.notes.some((note) => note.startsWith("secondaryForeground #FFFFFF on secondary #5F9873"))).toBe(true)
    })

    it("corrects a pair that fails even large text the same way", () => {
        const yellow = buildDesignContract({
            ...guide,
            colorSections: [{ title: "Primary Colors", swatches: [swatch("Background", "#FFFFFF"), swatch("Foreground", "#111111"), swatch("Primary", "#F2C14E"), swatch("Primary Foreground", "#FFFFFF")] }],
        } as unknown as StyleGuide)
        const check = yellow.contrast.find((entry) => entry.background === "primary")!
        expect(check.largeText).toBe(false)
        expect(contrastRatio(yellow.colors.primary, yellow.colors.primaryForeground)).toBeGreaterThanOrEqual(NORMAL_TEXT_CONTRAST)
    })
})

describe("guides from before role names", () => {
    // Creative names, two sections missing, unnamed type styles
    const legacy = {
        theme: "Sunlit Studio",
        description: "",
        colorSections: [
            { title: "Primary Colors", swatches: [swatch("Warm Sand", "#F4EBDD"), swatch("Charcoal", "#222222"), swatch("Terracotta", "#B5543A", "buttons"), swatch("Cream", "#FFF8EE")] },
            { title: "Secondary & Accent Colors", swatches: [swatch("Olive", "#6B7A3A", "used for the main background of cards"), swatch("Linen", "#FAF3E6", "Text on the secondary color")] },
            { title: "Status & Feedback Colors", swatches: [swatch("Brick", "#9B2C1F", "Error states")] },
        ],
        typographySections: [
            { title: "Headings", styles: [{ name: "Display Large", fontFamily: "'Playfair Display', serif", fontSize: "56px", fontWeight: "700", lineHeight: "1.1" }, { name: "Section", fontFamily: "Playfair Display", fontSize: "32px", fontWeight: "600", lineHeight: "1.2" }] },
            { title: "Body Text", styles: [{ name: "Paragraph", fontFamily: "Karla", fontSize: "17px", fontWeight: "400", lineHeight: "1.6" }] },
            { title: "Interface", styles: [] },
        ],
    } as unknown as StyleGuide
    const contract = buildDesignContract(legacy)

    it("reads roles from each swatch's place in its section, then from descriptions", () => {
        expect(contract.colors.background).toBe("#F4EBDD")
        expect(contract.colors.foreground).toBe("#222222")
        expect(contract.colors.primary).toBe("#B5543A")
        expect(contract.colors.primaryForeground).toBe("#FFF8EE")
        // "used for the main background of cards" isn't the page's background: it goes by its place
        expect(contract.colors.secondary).toBe("#6B7A3A")
        // "Text on the secondary color" names a role outright. Linen on olive is under 4.5:1, so the
        // design gets a lighter linen, and the guide's own pair stays on record
        const secondary = contract.contrast.find((check) => check.background === "secondary")!
        expect(secondary.colors).toEqual(["#6B7A3A", "#FAF3E6"])
        expect(secondary.corrected!.original).toBe("#FAF3E6")
        expect(contract.colors.secondaryForeground).toBe(secondary.corrected!.foreground)
        expect(contract.colors.destructive).toBe("#9B2C1F")
        expect(contract.notes).toContain('Swatch "Warm Sand" read as background from its place in "Primary Colors".')
        expect(contract.notes).toContain('Swatch "Linen" read as secondaryForeground from its description.')
    })

    it("derives what the guide doesn't have from what it does, the same way every time", () => {
        expect(contract.colors.card).toBe(contract.colors.background)
        expect(contract.colors.popover).toBe(contract.colors.card)
        expect(contract.colors.ring).toBe(contract.colors.primary)
        expect(contract.colors.border).toMatch(/^#[0-9A-F]{6}$/)
        expect(contract.notes.find((note) => note.startsWith("Not in the guide, so derived"))).toContain("border")
        expect(buildDesignContract(legacy)).toEqual(contract)
    })

    it("still meets 4.5:1 on every pair after deriving", () => {
        for (const check of contract.contrast) {
            const foreground = check.corrected?.foreground ?? check.colors[1]
            expect(contrastRatio(check.colors[0], foreground)).toBeGreaterThanOrEqual(NORMAL_TEXT_CONTRAST)
        }
    })

    it("places unnamed type styles by their section, and fills the rest of the scale with defaults", () => {
        expect(contract.typeScale.h1).toMatchObject({ fontSize: "56px", source: "guide" })
        expect(contract.typeScale.h2).toMatchObject({ fontSize: "32px", source: "guide" })
        expect(contract.typeScale.h3).toMatchObject({ fontSize: "1.5rem", source: "default" })
        expect(contract.typeScale.body).toMatchObject({ fontSize: "17px", source: "guide" })
        expect(contract.typeScale.button.source).toBe("default")
        expect(contract.fonts.heading).toEqual({ family: "Playfair Display", stack: "'Playfair Display', ui-serif, Georgia, serif" })
        // With no UI styles, buttons use the body font
        expect(contract.fonts.ui.family).toBe("Karla")
    })
})

describe("duplicates and bad values", () => {
    const messy = {
        theme: " ",
        description: "",
        colorSections: [
            { title: "Primary Colors", swatches: [swatch("Background", "#fff"), swatch("primary-foreground", "#FFFFFF"), swatch("Primary", "#1C5DC2"), swatch("Primary", "#FF0000"), swatch("Foreground", "not a color")] },
        ],
        typographySections: [{ title: "Headings", styles: [{ name: "H1", fontFamily: "Inter", fontSize: "40px", fontWeight: "700", lineHeight: "1.2" }, { name: "Heading 1", fontFamily: "Inter", fontSize: "12px", fontWeight: "400", lineHeight: "1" }] }],
    } as unknown as StyleGuide
    const contract = buildDesignContract(messy)

    it("keeps the first of two swatches for the same role and notes the other", () => {
        expect(contract.colors.primary).toBe("#1C5DC2")
        expect(contract.notes).toContain('Duplicate primary swatch "Primary" (#FF0000) ignored; the first one (#1C5DC2) is used.')
    })

    it("keeps the first of two type styles for the same role", () => {
        expect(contract.typeScale.h1.fontSize).toBe("40px")
        expect(contract.notes).toContain('Duplicate h1 type style "Heading 1" ignored; the first one is used.')
    })

    it("ignores a swatch without a valid hex color and derives the role instead", () => {
        expect(contract.notes).toContain('Swatch "Foreground" has no valid hex color ("not a color"); ignored.')
        expect(contract.colors.foreground).toBe("#111111")
        expect(contract.theme.name).toBe("Untitled")
    })
})

describe("names", () => {
    it("reads swatch names as roles", () => {
        expect(colorRoleOf("Primary Foreground")).toBe("primaryForeground")
        expect(colorRoleOf("primary-foreground")).toBe("primaryForeground")
        expect(colorRoleOf("Text on Primary")).toBe("primaryForeground")
        expect(colorRoleOf("Card FG")).toBe("cardForeground")
        expect(colorRoleOf("Main Background")).toBe("background")
        expect(colorRoleOf("Foreground")).toBe("foreground")
        expect(colorRoleOf("Focus Ring")).toBe("ring")
        expect(colorRoleOf("Error")).toBe("destructive")
        expect(colorRoleOf("Sage Green")).toBeNull()
    })

    it("reads type style names as roles", () => {
        expect(typeRoleOf("H1")).toBe("h1")
        expect(typeRoleOf("Heading 2")).toBe("h2")
        expect(typeRoleOf("Body Text")).toBe("body")
        expect(typeRoleOf("Caption")).toBe("small")
        expect(typeRoleOf("Button")).toBe("button")
        expect(typeRoleOf("Form Label")).toBe("label")
        expect(typeRoleOf("Fancy")).toBeNull()
    })

    it("normalizes hex colors", () => {
        expect(normalizeHex("#abc")).toBe("#AABBCC")
        expect(normalizeHex("12345678")).toBe("#123456")
        expect(normalizeHex("#12345")).toBeNull()
        expect(normalizeHex(undefined)).toBeNull()
    })
})
