import { describe, expect, it } from "vitest"
import { buildDesignContract } from "./design-contract"
import { validationContextFor } from "./design-generation"
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
        expect(refine("Add a status column")).toEqual({ mode: "refine", suppliedText: "Add a status column", previousHtml: "<div data-generated-ui></div>", colorRequested: false, width: undefined })
        for (const message of ["Give the hero a soft sage green background", "Make the buttons darker", "Use #1C5DC2 for links", "Change the colour of the footer"]) expect(refine(message).colorRequested, message).toBe(true)
    })

    it("gives a workflow page its main page, whose problems are its own to keep", () => {
        expect(validationContextFor({ mode: "workflow", contract, manifest, pageType: "Settings", mainHtml: "<div data-generated-ui>main</div>" })).toEqual({ mode: "workflow", previousHtml: "<div data-generated-ui>main</div>" })
    })
})
