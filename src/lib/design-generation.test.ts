import { describe, expect, it } from "vitest"
import { buildDesignContract } from "./design-contract"
import { keepsContent, MIN_REPAIR_LENGTH, validationContextFor, withCarriedProblems } from "./design-generation"
import { DASHBOARD_INITIAL, DASHBOARD_REPAIRED } from "./design-validator.fixtures"
import { EVAL_FIXTURES } from "../../scripts/eval-fixtures"
import { buildImageManifest } from "./image-manifest"
import { OUTLINE_VERSION, type FrameOutline } from "./wireframe-outline"
import type { StyleGuide } from "@/redux/api/style-guide"

const contract = buildDesignContract({ colorSections: [], typographySections: [] } as unknown as StyleGuide)
const manifest = buildImageManifest([])
const outline: FrameOutline = {
    version: OUTLINE_VERSION,
    frame: { id: "f", number: 1, width: 940, height: 600 },
    nodes: [{ id: "h", kind: "text", text: "Explore the menu", box: [3, 5, 30, 8] }, { id: "c", kind: "box", label: "card", box: [3, 20, 30, 40], children: [{ id: "t", kind: "text", text: "Dr. Maria Lopez", box: [4, 21, 20, 23] }] }],
}

describe("validationContextFor", () => {
    it("gives an initial design the wireframe's own words, and the frame's width", () => {
        const context = validationContextFor({ mode: "initial", contract, manifest, outline, hasWireframe: true })
        expect(context).toEqual({ mode: "initial", suppliedText: "Explore the menu\nDr. Maria Lopez", width: 940 })
        // A phone-sized wireframe still makes a frame 400px wide
        expect(validationContextFor({ mode: "initial", contract, manifest, outline: { ...outline, frame: { ...outline.frame, width: 320 } } }).width).toBe(400)
        expect(validationContextFor({ mode: "initial", contract, manifest, outline: null, legacyOutline: "headline: Fresh plants" }).suppliedText).toBe("headline: Fresh plants")
    })

    it("gives a refine the user's request, the page it changes, and whether it asks for a color", () => {
        const refine = (message: string) => validationContextFor({ mode: "refine", contract, manifest, message, currentHtml: "<div data-generated-ui></div>", outline: null, hasWireframe: false })
        expect(refine("Add a status column")).toEqual({ mode: "refine", suppliedText: "Add a status column", previousHtml: "<div data-generated-ui></div>", colorRequested: false, width: undefined, request: "Add a status column" })
        for (const message of ["Give the hero a soft sage green background", "Make the buttons darker", "Use #1C5DC2 for links", "Change the colour of the footer"]) expect(refine(message).colorRequested, message).toBe(true)
    })

    it("gives a workflow page its main page, whose problems are its own to keep", () => {
        expect(validationContextFor({ mode: "workflow", contract, manifest, pageType: "Settings", mainHtml: "<div data-generated-ui>main</div>" })).toEqual({ mode: "workflow", previousHtml: "<div data-generated-ui>main</div>" })
    })
})

describe("keepsContent: a repair may fix things, never drop them", () => {
    it("keeps a repair as long as the first design or longer, with every data-node", () => {
        expect(keepsContent(DASHBOARD_REPAIRED, DASHBOARD_INITIAL)).toBe(true)
    })

    it("drops one that lost a section, however long it still is", () => {
        const withoutStats = DASHBOARD_REPAIRED.replace(/<!-- Stats Row -->[\s\S]*?<\/section>/, "")
        expect(withoutStats.length / DASHBOARD_INITIAL.length).toBeGreaterThan(MIN_REPAIR_LENGTH)
        expect(keepsContent(withoutStats, DASHBOARD_INITIAL)).toBe(false)
    })

    it("drops one under 85% of the first design's length, even with every data-node", () => {
        // The first design without its <style> block: 72% as long
        const withoutStyles = DASHBOARD_INITIAL.replace(/<style>[\s\S]*?<\/style>/, "")
        expect(keepsContent(withoutStyles, DASHBOARD_INITIAL)).toBe(false)
    })

    it("doesn't count re-indenting as dropping, and needs every id too", () => {
        const flattened = DASHBOARD_REPAIRED.replace(/\n\s*/g, "")
        expect(keepsContent(flattened, DASHBOARD_INITIAL)).toBe(true)
        expect(keepsContent(DASHBOARD_REPAIRED.replace('id="search-input"', 'id="search"'), DASHBOARD_INITIAL)).toBe(false)
        expect(keepsContent("<p>Fixed</p>", DASHBOARD_INITIAL)).toBe(false)
    })
})

describe("withCarriedProblems", () => {
    const dashboard = buildDesignContract(EVAL_FIXTURES[1].guide)
    const refine = (message: string) => withCarriedProblems({ mode: "refine" as const, contract: dashboard, manifest, message, currentHtml: DASHBOARD_INITIAL, outline: null, hasWireframe: false })

    it("adds the current page's errors in the part the request changes, and only those", () => {
        const { alsoFix } = refine(EVAL_FIXTURES[1].refine) as { alsoFix?: string[] }
        expect(alsoFix?.map((line) => line.split(" ")[0])).toEqual(["Contrast", "Made-up"])
    })

    it("adds nothing when the request touches no part with errors, and leaves other modes alone", () => {
        expect(refine("Change the font of the footer")).not.toHaveProperty("alsoFix")
        const initial = { mode: "initial" as const, contract, manifest, outline: null }
        expect(withCarriedProblems(initial)).toBe(initial)
    })
})
