import { describe, expect, it, vi } from "vitest"
import { livePlan, repairOutcome } from "../../scripts/eval-generation"
import { validate, type Issue } from "./design-validator"
import { buildDesignContract } from "./design-contract"
import { keepsContent, MIN_REPAIR_LENGTH, validationContextFor, withCarriedProblems } from "./design-generation"
import { DASHBOARD_INITIAL, DASHBOARD_REPAIRED } from "./design-validator.fixtures"
import { EVAL_FIXTURES } from "../../scripts/eval-fixtures"
import { buildImageManifest } from "./image-manifest"
import { OUTLINE_VERSION, type FrameOutline } from "./wireframe-outline"

// The real check, which a test can make throw
vi.mock("./design-validator", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./design-validator")>()
    return { ...actual, validate: vi.fn(actual.validate) }
})
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

describe("withCarriedProblems, when it can't check", () => {
    it("sends the refine as it was, with a warning, when the check throws", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
        vi.mocked(validate).mockImplementationOnce(() => {
            throw new Error("The check broke")
        })
        const design = { mode: "refine" as const, contract: buildDesignContract(EVAL_FIXTURES[1].guide), manifest, message: EVAL_FIXTURES[1].refine, currentHtml: DASHBOARD_INITIAL, outline: null, hasWireframe: false }
        expect(withCarriedProblems(design)).toBe(design)
        expect(warn).toHaveBeenCalledWith("[design-check] Checking the current page failed, so the refine goes without it:", expect.objectContaining({ message: "The check broke" }))
        warn.mockRestore()
    })

    it("runs the refine's own checks: a near-duplicate column in the touched table is carried", () => {
        const page = `<div data-generated-ui><section><table><thead><tr><th>Status</th><th>Order status</th></tr></thead></table></section></div>`
        const { alsoFix } = withCarriedProblems({ mode: "refine" as const, contract, manifest, message: "Add a column to the table", currentHtml: page, outline: null, hasWireframe: false }) as { alsoFix?: string[] }
        expect(alsoFix).toEqual([expect.stringContaining('has the columns "Status" and "Order status"')])
    })
})

describe("the eval's outcomes", () => {
    const issue = (severity: Issue["severity"]): Issue => ({ kind: "copy", severity, key: `copy|${severity}`, count: 1, message: "m" })

    it("calls a kept repair that still has errors residual, and one without kept", () => {
        expect(repairOutcome({ mode: "initial", before: [issue("error"), issue("error")], after: [issue("error")], repair: "kept" }, true)).toMatchObject({ residual: true, outcome: "residual", shown: "residual" })
        expect(repairOutcome({ mode: "initial", before: [issue("error")], after: [issue("warning")], repair: "kept" }, true)).toMatchObject({ residual: false, outcome: "kept" })
        // A discarded repair leaves the first design's errors, which aren't residual
        expect(repairOutcome({ mode: "initial", before: [issue("error")], after: [issue("error")], repair: "discarded" }, true)).toMatchObject({ residual: false, outcome: "discarded", after: [issue("error")] })
        expect(repairOutcome({ mode: "initial", before: [issue("error")], after: null, repair: "not-sent" }, false).shown).toBe("not-made (cap)")
        expect(repairOutcome(null, true).outcome).toBe("not-needed")
    })

    it("plans initial, workflow and refine designs within the cap", () => {
        expect(livePlan(3, 1, 9)).toBe("Planned: 9 designs (9 a run × 1 run: initial, then workflow, then refine), one model call each or 2 with a repair: 9 to 18 calls. Cap: 9, so at most 9 calls are made; designs past the cap are skipped, and a repair that wouldn't fit isn't made.")
        expect(livePlan(3, 1, 30)).toBe("Planned: 9 designs (9 a run × 1 run: initial, then workflow, then refine), one model call each or 2 with a repair: 9 to 18 calls. Cap: 30, so at most 18 calls are made.")
        expect(livePlan(3, 2, 30)).toContain("18 designs (9 a run × 2 runs")
    })
})
