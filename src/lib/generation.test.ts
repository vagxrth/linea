import { streamText } from "ai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ConsumeCreditsQuery, InspirationImagesQuery, StyleGuideQuery } from "@/convex/query.config"
import { prompts } from "@/prompts"
import type { StyleGuide } from "@/redux/api/style-guide"
import {
    colorsText,
    generationFailed,
    getInspirationImageUrls,
    getStyleGuide,
    imageParts,
    streamDesign,
    styleGuideMissing,
    styleGuideSections,
    typographyText,
} from "./generation"

// The real queries call Convex with the signed-in user's token
vi.mock("@/convex/query.config", () => ({
    ConsumeCreditsQuery: vi.fn(),
    InspirationImagesQuery: vi.fn(),
    StyleGuideQuery: vi.fn(),
}))
vi.mock("@ai-sdk/google", () => ({ google: (modelId: string) => ({ modelId }) }))
vi.mock("ai", () => ({ streamText: vi.fn() }))

const guide = {
    theme: "Calm",
    description: "Soft and clear",
    colorSections: [
        { title: "Primary Colors", swatches: [{ name: "Background", hexColor: "#ffffff", description: "page" }, { name: "Primary", hexColor: "#1c5dc2", description: "buttons" }] },
        { title: "Status & Feedback Colors", swatches: [{ name: "Destructive", hexColor: "#b01f2a", description: "errors" }] },
    ],
    typographySections: [
        { title: "Headings", styles: [{ name: "H1", description: "page title", fontFamily: "Inter", fontWeight: "700", fontSize: "32px", lineHeight: "40px" }] },
    ],
} as unknown as StyleGuide

const styleGuideIs = (value: unknown) =>
    vi.mocked(StyleGuideQuery).mockResolvedValue({ styleGuide: value } as Awaited<ReturnType<typeof StyleGuideQuery>>)

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("style guide text", () => {
    it("lists every swatch and type style", () => {
        expect(colorsText(guide)).toBe("Background: #ffffff, page, Primary: #1c5dc2, buttons, Destructive: #b01f2a, errors")
        expect(typographyText(guide)).toBe("H1: page title, Inter, 700, 32px, 40px")
    })

    it("adds a section for colors and one for typography, and leaves out empty ones", () => {
        expect(styleGuideSections(guide)).toBe(
            `\n\nStyle Guide Colors:\n${colorsText(guide)}\n\nTypography:\n${typographyText(guide)}`
        )
        const empty = { ...guide, colorSections: [], typographySections: [] } as unknown as StyleGuide
        expect(styleGuideSections(empty)).toBe("")
    })
})

describe("getStyleGuide", () => {
    it("returns the project's style guide", async () => {
        styleGuideIs(guide)
        expect(await getStyleGuide("p1")).toBe(guide)
        expect(StyleGuideQuery).toHaveBeenCalledWith("p1")
    })

    it("returns null when the project has no style guide, or one without sections", async () => {
        styleGuideIs(null)
        expect(await getStyleGuide("p1")).toBeNull()
        styleGuideIs({ theme: "Calm" })
        expect(await getStyleGuide("p1")).toBeNull()
    })

    it("explains what to do when the style guide is missing", async () => {
        const response = styleGuideMissing("redesigning")
        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            error: "Style guide not found",
            details: "Please generate a style guide first before redesigning. Go to the Style Guide tab and create one from your moodboard images.",
        })
    })
})

describe("inspiration images", () => {
    it("keeps the order and drops images without a URL", async () => {
        vi.mocked(InspirationImagesQuery).mockResolvedValue({
            images: [{ url: "https://img.test/1.png" }, { url: "" }, { url: "https://img.test/2.png" }],
        } as unknown as Awaited<ReturnType<typeof InspirationImagesQuery>>)

        const urls = await getInspirationImageUrls("p1")

        expect(urls).toEqual(["https://img.test/1.png", "https://img.test/2.png"])
        expect(imageParts(urls)).toEqual([
            { type: "image", image: "https://img.test/1.png" },
            { type: "image", image: "https://img.test/2.png" },
        ])
    })
})

describe("streamDesign", () => {
    it("asks the model with the design instructions and streams its output, charging the cost", async () => {
        vi.mocked(streamText).mockReturnValue({
            textStream: (async function* () { yield "<div>"; yield "</div>" })(),
        } as unknown as ReturnType<typeof streamText>)
        vi.mocked(ConsumeCreditsQuery).mockResolvedValue({ ok: true, balance: 3 } as Awaited<ReturnType<typeof ConsumeCreditsQuery>>)
        const content = [{ type: "text" as const, text: "Make a page" }, ...imageParts(["https://img.test/1.png"])]

        const response = await streamDesign(new Request("http://localhost/api/generate", { method: "POST" }), 4, content)

        expect(vi.mocked(streamText).mock.calls[0][0]).toMatchObject({
            model: { modelId: "gemini-2.5-flash" },
            system: prompts.generatedUi.system,
            temperature: 0.7,
            messages: [{ role: "user", content }],
        })
        expect(await response.text()).toBe("<div></div>")
        expect(ConsumeCreditsQuery).toHaveBeenCalledWith({ amount: 4 })
    })
})

describe("generationFailed", () => {
    it("logs the error and returns it as a 500", async () => {
        const response = generationFailed("Failed to generate design", new Error("model unavailable"))

        expect(response.status).toBe(500)
        expect(await response.json()).toEqual({ error: "Failed to generate design", details: "model unavailable" })
        expect(console.error).toHaveBeenCalledWith("Failed to generate design:", expect.any(Error))
    })
})
