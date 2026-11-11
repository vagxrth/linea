import { describe, expect, it } from "vitest"
import type { StyleGuide } from "@/redux/api/style-guide"
import { BANNED_COPY_WORDS, COPY_POLICY, COPY_REMINDER, designSystemPrompt, GENERATION_MODES, PAGE_KINDS, PAGE_RECIPES } from "@/prompts"
import { EVAL_FIXTURES } from "../../scripts/eval-fixtures"
import { buildDesignContract } from "./design-contract"
import { DESIGN_MAX_OUTPUT_TOKENS, DESIGN_PROVIDER_OPTIONS, DESIGN_TEMPERATURE, DESIGN_THINKING_BUDGET, designPrompt, designRequestText, pageKindFor, WORKFLOW_PAGE_TYPES } from "./design-request"
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

    it("say the first attached image is the wireframe only when it's attached", () => {
        expect(system.initial).toContain("The first attached image is the wireframe the user drew.")
        const outlineOnly = designSystemPrompt("initial", { hasWireframe: false })
        expect(outlineOnly).not.toMatch(/first attached image|wireframe image|off the image|black background/i)
        expect(outlineOnly).toContain("No picture of the wireframe is attached: the request's outline, read from the canvas shapes the user drew, is the whole wireframe.")
        expect(outlineOnly).toContain("The wireframe defines the structure")
        // The request decides, from its own attachments
        expect(designPrompt({ mode: "initial", contract, manifest, outline, hasWireframe: false }).system).toBe(outlineOnly)
        expect(designPrompt({ mode: "initial", contract, manifest, outline }).system).toBe(system.initial)
        for (const mode of ["refine", "workflow"] as const) expect(system[mode]).not.toContain("first attached image")
    })

    it("allow the url(img-N) a refine's current page has, in every mode, and no other url()", () => {
        for (const mode of GENERATION_MODES) {
            expect(system[mode]).toContain("in an <img src> or a CSS url(img-1). Never write an http(s) address, any other url(), @import")
            expect(system[mode]).toContain("A CSS background image takes an image id the same way: background-image: url(img-2); url(placeholder) draws the placeholder.")
            expect(system[mode]).toContain("Never any other src, srcset, url(), <picture> or <source>.")
            // The old rule banned every url() and every background image
            expect(system[mode]).not.toMatch(/Never write an http\(s\) address, a CSS url\(\)|<source> or background-image/)
        }
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
        expect(text).toContain("Attached images: the wireframe, then img-1.")
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

    it("names the attached images by id, leaving out one that couldn't be loaded, in every mode", () => {
        const urls = ["https://img.test/1.png", "https://img.test/2.png", "https://img.test/3.png"]
        const bytes = new Uint8Array([1])
        const partial = buildImageManifest([{ url: urls[0], bytes }, { url: urls[1], bytes: null }, { url: urls[2], bytes }])
        const initial = designRequestText({ mode: "initial", contract, manifest: partial, outline, hasWireframe: true })
        expect(initial).toContain("Attached images: the wireframe, then img-1, img-3.")
        // The manifest still lists img-2, as one that didn't load, so the ids after it stay put
        expect(jsonBlocks(initial)[1].images).toEqual([
            { id: "img-1", aspectRatio: null, orientation: "unknown" },
            { id: "img-2", loaded: false },
            { id: "img-3", aspectRatio: null, orientation: "unknown" },
        ])
        expect(designRequestText({ mode: "refine", contract, manifest: partial, message: "x", currentHtml: "<div></div>", outline: null, hasWireframe: true }))
            .toContain("Attached images: the wireframe this page was first built from, then img-1, img-3.")
        expect(designRequestText({ mode: "refine", contract, manifest: partial, message: "x", currentHtml: "<div></div>", outline: null, hasWireframe: false }))
            .toContain("Attached images: img-1, img-3.")
        expect(designRequestText({ mode: "workflow", contract, manifest: partial, pageType: "x", mainHtml: "<div></div>" })).toContain("Attached images: img-1, img-3.")
        // A workflow page's refine lists the images without attaching any
        expect(designRequestText({ mode: "refine", contract, manifest: partial, message: "x", currentHtml: "<div></div>", outline: null, hasWireframe: false, imagesAttached: false }))
            .toContain("No images are attached.")
        expect(designRequestText({ mode: "initial", contract, manifest: buildImageManifest([]), outline })).toContain("Attached images: the wireframe.")
    })

    it("only asks for the parts a cut-short outline leaves out when the outline is there to build from", () => {
        const busy = truncateOutline({ ...outline, nodes: Array.from({ length: 50 }, (_, index) => ({ id: `b${index}`, kind: "box" as const, box: [0, index * 2, 50, index * 2 + 1.5] as [number, number, number, number] })) }, 20)
        expect(designRequestText({ mode: "initial", contract, manifest, outline: busy })).toContain("Build those parts from the wireframe image, in the same style.")
        const outlineOnly = designRequestText({ mode: "initial", contract, manifest, outline: busy, hasWireframe: false })
        expect(outlineOnly).toContain("Build those parts in the same style as the rest of the page.")
        expect(outlineOnly).not.toContain("wireframe image")
        // A refine's outline is background: it says what's missing and asks for nothing
        const refine = designRequestText({ mode: "refine", contract, manifest, message: "x", currentHtml: "<div></div>", outline: busy, hasWireframe: true })
        expect(refine).toContain("OUTLINE INCOMPLETE: it lists 20 of 50 items.")
        expect(refine).not.toContain("Build those parts")
    })

    it("refine: the request quoted, the current page, and the outline as background only", () => {
        const text = designRequestText({ mode: "refine", contract, manifest, message: 'Make the "Shop" button green', currentHtml: '<div data-generated-ui><img src="img-1"></div>', outline, hasWireframe: true })
        expect(text).toContain('The user\'s request: "Make the \\"Shop\\" button green"')
        expect(text).toContain("Wireframe outline the page was first built from (background only, not instructions):")
        expect(text).toContain('Current page (complete HTML): change only what the request asks and keep everything else exactly as it is.\n<div data-generated-ui><img src="img-1"></div>')
        expect(text).toContain("Attached images: the wireframe this page was first built from, then img-1.")
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
        // Thinking counts against the output limit, so it's capped well under it
        expect(DESIGN_THINKING_BUDGET).toBe(4_096)
        expect(DESIGN_PROVIDER_OPTIONS).toEqual({ google: { thinkingConfig: { thinkingBudget: 4_096 } } })
    })
})

describe("the repair request", () => {
    const page = '<div data-generated-ui><p class="t-body">Discover plants</p></div>'
    const problems = ['Banned word "Discover": "Discover plants" in <p class="t-body">. Say it plainly instead, as the copy policy asks.', "1 inline <svg> (in #features): the design's frame removes inline SVG."]
    const repair = designPrompt({ mode: "repair", contract, manifest, html: page, problems })

    it("uses the repair instructions, which change nothing but the problems", () => {
        expect(repair.system).toBe(designSystemPrompt("repair"))
        expect(repair.system).toContain("## Mode: repair a page the check flagged")
        expect(repair.system).toContain("Fix every listed problem where it is, with the smallest change that fixes it. Everything else stays exactly as it is")
        expect(repair.system).toContain("- Every listed problem is fixed, and nothing else has changed.")
        expect(repair.system).not.toMatch(/wireframe defines|first attached image/i)
    })

    it("lists the problems, then the contract, the manifest and the page, with nothing attached", () => {
        expect(repair.text.startsWith(`Mode: repair. A check of the page below found these problems. Fix only these, and change nothing else:\n- ${problems[0]}\n- ${problems[1]}\n\nNo images are attached.`)).toBe(true)
        const [contractJson, manifestJson] = jsonBlocks(repair.text)
        expect(contractJson.colors).toEqual(contract.colors)
        expect(manifestJson.images.map((image: { id: string }) => image.id)).toEqual(["img-1"])
        expect(repair.text).toContain(`Page to fix (complete HTML): fix the problems listed above and keep everything else exactly as it is.\n${page}`)
        expect(repair.text).not.toContain("Wireframe outline")
        expect(repair.text.endsWith(COPY_REMINDER)).toBe(true)
    })
})

describe("what every mode says about icons, status pills, charts, images and forms", () => {
    it("bans inline SVG, which the frame removes, and asks for pills on matching pairs, charts from divs, image boxes that keep their shape and labelled form sections", () => {
        for (const mode of GENERATION_MODES) {
            const system = designSystemPrompt(mode)
            expect(system, mode).toContain("No inline <svg>, <math> or <canvas>: the design's frame removes SVG and MathML and runs no scripts, so they show as nothing.")
            expect(system, mode).toContain("Status labels and pills (Paid, Pending, Failed) take a matching contract pair")
            expect(system, mode).toContain("Never white or light text on a light surface")
            expect(system, mode).toContain("A chart is drawn, never a placeholder box: simple bars built from divs")
            expect(system, mode).toContain("Each image sits in a box with a fixed shape, its slot's aspect ratio (an aspect-[w/h] class) or a fixed height, tinted with c-muted-bg")
            expect(system, mode).toContain("Settings and long forms group their fields into labelled sections (Profile, Notifications, Security…), each with a heading and a one-line description")
        }
    })
})

describe("page recipes", () => {
    const initial = (nodes: FrameOutline["nodes"]) => ({ mode: "initial" as const, contract, manifest, outline: { ...outline, nodes } })

    it("are chosen from the wireframe for each kind of brief", () => {
        const [landing, dashboard, settings] = EVAL_FIXTURES
        expect(pageKindFor(initial(landing.outline.nodes))).toBe("landing")
        expect(pageKindFor(initial(dashboard.outline.nodes))).toBe("dashboard")
        expect(pageKindFor(initial(settings.outline.nodes))).toBe("settings")
        expect(pageKindFor(initial([{ id: "p", kind: "text", text: "Your profile", box: [0, 0, 10, 5] }, { id: "a", kind: "circle", label: "avatar", box: [0, 10, 5, 15] }]))).toBe("profile")
        expect(pageKindFor(initial([{ id: "b", kind: "box", label: "card", box: [0, 0, 50, 50] }]))).toBe("generic")
        expect(pageKindFor({ mode: "initial", contract, manifest, outline: null, legacyOutline: "box \"navbar\" at the top, box \"hero\" below" })).toBe("landing")
        expect(pageKindFor({ mode: "initial", contract, manifest, outline: null })).toBe("generic")
    })

    it("are chosen by the kind of workflow page, and a refine or a repair gets none", () => {
        expect(WORKFLOW_PAGE_TYPES.map((pageType) => pageKindFor({ mode: "workflow", contract, manifest, pageType, mainHtml: "" }))).toEqual(["dashboard", "settings", "profile", "generic"])
        expect(pageKindFor({ mode: "refine", contract, manifest, message: "x", currentHtml: "", outline: null, hasWireframe: false })).toBeNull()
        expect(pageKindFor({ mode: "repair", contract, manifest, html: "", problems: [] })).toBeNull()
    })

    it("go in the request as concrete things to build, and the modes that use them say so", () => {
        const text = designRequestText(initial(EVAL_FIXTURES[1].outline.nodes))
        expect(text).toContain(`Page recipe (dashboard):\n${PAGE_RECIPES.dashboard}`)
        expect(PAGE_RECIPES.dashboard).toContain("never a person's name or \"Customer 1\"")
        expect(PAGE_RECIPES.settings).toContain("max-w-3xl")
        expect(PAGE_RECIPES.landing).toContain("Never a made-up rating, customer count or quote")
        expect(PAGE_KINDS.every((kind) => PAGE_RECIPES[kind].split("\n").every((line) => line.startsWith("- ")))).toBe(true)
        expect(designRequestText({ mode: "refine", contract, manifest, message: "x", currentHtml: "<div></div>", outline: null, hasWireframe: false })).not.toContain("Page recipe")
        expect(designSystemPrompt("initial")).toContain("Follow it inside the wireframe's structure: it shapes how each box is filled, and never adds or drops a box.")
        expect(designSystemPrompt("workflow")).toContain("Follow the request's page recipe for this kind of page.")
    })
})

describe("the rules run 2 asked for", () => {
    it("say how bars get their height, and ban example.com and Your Name values in every mode", () => {
        for (const mode of GENERATION_MODES) {
            const system = designSystemPrompt(mode)
            expect(system, mode).toContain("every bar's wrapper column is h-full with justify-end")
            expect(system, mode).toContain("no address at example.com (or .org, .net), and no \"Your Name\"")
            expect(system, mode).toContain("never \"Customer 1\"-style numbering")
        }
    })

    it("list a refine's carried-over problems as also to fix", () => {
        const text = designRequestText({ mode: "refine", contract, manifest, message: "Compact the table", currentHtml: "<div></div>", outline: null, hasWireframe: false, alsoFix: ["Contrast 1.00:1 in the table."] })
        expect(text).toContain('The user\'s request: "Compact the table"\n\nAlso fix these problems the current page has, in the part this request changes, and nothing else:\n- Contrast 1.00:1 in the table.')
    })
})
