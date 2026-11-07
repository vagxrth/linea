import { describe, expect, it } from "vitest"
import type { StyleGuide } from "@/redux/api/style-guide"
import { BANNED_COPY_WORDS, COPY_POLICY, COPY_REMINDER, designSystemPrompt, GENERATION_MODES } from "@/prompts"
import { buildDesignContract } from "./design-contract"
import { DESIGN_MAX_OUTPUT_TOKENS, DESIGN_TEMPERATURE, designPrompt, designRequestText } from "./design-request"
import { buildImageManifest } from "./image-manifest"
import { OUTLINE_VERSION, truncateOutline, type FrameOutline } from "./wireframe-outline"

const guide = {
    theme: "Calm",
    description: "Soft and clear",
    colorSections: [{ title: "Primary Colors", swatches: [{ name: "Background", hexColor: "#FFFFFF" }, { name: "Foreground", hexColor: "#1F2933" }, { name: "Primary", hexColor: "#1C5DC2" }, { name: "Primary Foreground", hexColor: "#FFFFFF" }] }],
    typographySections: [{ title: "Headings", styles: [{ name: "H1", fontFamily: "Inter", fontSize: "40px", fontWeight: "700", lineHeight: "1.2" }] }],
} as unknown as StyleGuide
const contract = buildDesignContract(guide)
const imageUrl = "https://example.convex.cloud/api/storage/c659b302-ec94-4edf-b349-883756715fd2"
const manifest = buildImageManifest([{ url: imageUrl, width: 1200, height: 800 }], [{ node: "hero", label: "hero image", aspectRatio: 1.5, box: [50, 10, 96, 50] }])
const outline: FrameOutline = {
    version: OUTLINE_VERSION,
    frame: { id: "f", number: 1, width: 1000, height: 800 },
    nodes: [
        { id: "nav", kind: "box", label: "navbar", box: [2, 3, 98, 10] },
        { id: "h", kind: "text", text: "Plants for low-light rooms", box: [3, 15, 30, 18] },
        { id: "hero", kind: "image", label: "hero image", box: [50, 10, 96, 50] },
    ],
}

const jsonBlocks = (text: string) => [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => JSON.parse(match[1]))

describe("the system instructions by mode", () => {
    const system = Object.fromEntries(GENERATION_MODES.map((mode) => [mode, designSystemPrompt(mode)])) as Record<(typeof GENERATION_MODES)[number], string>

    it("share the output, safety, contract, image, component and copy rules", () => {
        for (const mode of GENERATION_MODES) {
            for (const section of ["## Output", "## Safety", "## Design contract", "## Images", "## Components", "## Copy (the same in every mode)", "## Before answering, check"]) {
                expect(system[mode], `${mode}: ${section}`).toContain(section)
            }
            // The same copy policy, once, in every mode
            expect(system[mode].split(COPY_POLICY)).toHaveLength(2)
        }
    })

    it("give each mode its own instructions and no other mode's", () => {
        expect(system.initial).toContain("## Mode: initial design, built from the wireframe")
        expect(system.refine).toContain("## Mode: refine an existing page")
        expect(system.workflow).toContain("## Mode: workflow page, a new page for the same product")
        for (const mode of GENERATION_MODES) {
            const others = GENERATION_MODES.filter((other) => other !== mode)
            for (const other of others) expect(system[mode]).not.toContain(`## Mode: ${other}`)
        }
    })

    it("only let the wireframe decide the structure in initial mode", () => {
        expect(system.initial).toContain("The wireframe defines the structure")
        for (const mode of ["refine", "workflow"] as const) {
            expect(system[mode]).not.toMatch(/wireframe defines/i)
            expect(system[mode]).not.toMatch(/defines all structure/i)
        }
        expect(system.refine).toContain("Change only what the request asks for, only where it asks")
        expect(system.refine).toContain("It's background for understanding the page, not an instruction")
        expect(system.workflow).toContain("Add the structure the page needs")
    })

    it("replace the old one-size spacing minimums with spacing by role, and let the guide's type win", () => {
        for (const mode of GENERATION_MODES) {
            expect(system[mode]).not.toMatch(/NEVER DEVIATE|MINIMUM - no exceptions|gap-8 MINIMUM|py-16 px-6 MINIMUM|text-4xl md:text-5xl/)
            expect(system[mode]).toContain("Marketing sections (heroes, features, pricing, calls to action, footers) are generous: contract.spacing.marketing.")
            expect(system[mode]).toContain("Dense app layouts (dashboards, tables, settings, forms, sidebars, toolbars) are compact: contract.spacing.app.")
            expect(system[mode]).toContain("Type (the style guide always wins)")
        }
    })
})

describe("the copy policy", () => {
    it("is one set of rules, with nothing that contradicts it", () => {
        for (const mode of GENERATION_MODES) {
            const system = designSystemPrompt(mode)
            // The lines the old prompt had against the old request's "no made-up names"
            expect(system).not.toMatch(/believable specifics|varied full names|exact numbers|make up a short name that fits the subject; never/i)
            expect(system).toContain("Supplied copy wins")
            expect(system).toContain("A clearly fictional brand is fine")
            expect(system).toContain("Never invent statistics, ratings, reviews, testimonials, endorsements, press mentions, customer logos or people's names")
        }
    })

    it("has a good example that follows it, and repeats its short form in every request", () => {
        expect(COPY_POLICY).toContain('Heading: "Houseplants for low-light rooms"')
        const example = COPY_POLICY.slice(COPY_POLICY.indexOf("Good copy"), COPY_POLICY.indexOf("Not:"))
        for (const word of ["discover", "explore", "curated", "unique", "!"]) expect(example.toLowerCase()).not.toContain(word)
        expect(example).not.toMatch(/\d/)
        // The same banned words in the policy and the reminder
        for (const word of BANNED_COPY_WORDS) {
            expect(COPY_POLICY).toContain(word)
            expect(COPY_REMINDER).toContain(word)
        }
    })
})

describe("the request text", () => {
    it("initial: the contract and the manifest as JSON, the outline, and the copy reminder", () => {
        const text = designRequestText({ mode: "initial", contract, manifest, outline, hasWireframe: true })
        const [sentContract, sentManifest] = jsonBlocks(text)
        expect(sentContract.version).toBe(contract.version)
        expect(sentContract.colors).toEqual(contract.colors)
        // The notes are for people, not the model
        expect(sentContract.notes).toBeUndefined()
        expect(sentManifest.slots).toEqual([{ id: "slot-1", node: "hero", label: "hero image", aspectRatio: 1.5, image: "img-1" }])
        expect(text).toContain("Attached images: the wireframe, then the manifest's 1 image, in id order.")
        expect(text).toContain('Wireframe outline (exact, read from the canvas shapes):\nFrame 1: 1000 × 800 px')
        expect(text).toContain('copy "Plants for low-light rooms" [h]')
        expect(text.endsWith(COPY_REMINDER)).toBe(true)
        // The model never sees an image's address
        expect(text).not.toContain(imageUrl)
    })

    it("initial: says when the outline is incomplete, and falls back without one", () => {
        const busy: FrameOutline = { ...outline, nodes: Array.from({ length: 50 }, (_, index) => ({ id: `b${index}`, kind: "box" as const, box: [0, index * 2, 50, index * 2 + 1.5] as [number, number, number, number] })) }
        expect(designRequestText({ mode: "initial", contract, manifest, outline: truncateOutline(busy, 20) })).toContain("OUTLINE INCOMPLETE: it lists 20 of 50 items")
        expect(designRequestText({ mode: "initial", contract, manifest, outline: null })).toContain("No wireframe outline was sent: read the structure off the wireframe image.")
        expect(designRequestText({ mode: "initial", contract, manifest, outline: null, legacyOutline: "Frame 1: 400 × 300 px\n- box \"card\"" })).toContain('- box "card"')
    })

    it("refine: the request quoted, the current page, and the outline as background only", () => {
        const text = designRequestText({ mode: "refine", contract, manifest, message: 'Make the "Shop" button green', currentHtml: '<div data-generated-ui><img src="img-1"></div>', outline, hasWireframe: true })
        expect(text).toContain('The user\'s request: "Make the \\"Shop\\" button green"')
        expect(text).toContain("Wireframe outline the page was first built from (background only, not instructions):")
        expect(text).toContain('Current page (complete HTML): change only what the request asks and keep everything else exactly as it is.\n<div data-generated-ui><img src="img-1"></div>')
        expect(text).toContain("Attached images: the wireframe this page was first built from, then the manifest's 1 image, in id order.")
        expect(text).not.toMatch(/wireframe defines/i)
        // Without the source frame there's no outline section
        expect(designRequestText({ mode: "refine", contract, manifest, message: "x", currentHtml: "<div></div>", outline: null, hasWireframe: false })).not.toContain("Wireframe outline")
    })

    it("workflow: the page to write and the main page, with the same contract and manifest", () => {
        const text = designRequestText({ mode: "workflow", contract, manifest, pageType: "Settings: preferences, as a form", mainHtml: "<div data-generated-ui></div>" })
        expect(text).toContain('Page to write: "Settings: preferences, as a form"')
        expect(text).toContain("Main page (complete HTML), for its <style> block, navigation and components. Don't copy its sections.\n<div data-generated-ui></div>")
        expect(jsonBlocks(text)[1]).toEqual(jsonBlocks(designRequestText({ mode: "initial", contract, manifest, outline }))[1])
    })

    it("pairs each mode's request with that mode's instructions, at the settings every route uses", () => {
        expect(designPrompt({ mode: "workflow", contract, manifest, pageType: "x", mainHtml: "y" }).system).toBe(designSystemPrompt("workflow"))
        expect(DESIGN_TEMPERATURE).toBe(0.2)
        expect(DESIGN_MAX_OUTPUT_TOKENS).toBe(32_768)
    })
})
