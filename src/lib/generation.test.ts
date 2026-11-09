import { streamText } from "ai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ConsumeCreditsQuery, InspirationImagesQuery, StyleGuideQuery } from "@/convex/query.config"
import { designSystemPrompt } from "@/prompts"
import type { StyleGuide } from "@/redux/api/style-guide"
import { EVAL_FIXTURES } from "../../scripts/eval-fixtures"
import { buildDesignContract } from "./design-contract"
import { DESIGN_MAX_OUTPUT_TOKENS, designPrompt, type DesignRequest } from "./design-request"
import { DESIGN_STREAM_HEADERS, finalDesign, readDesignStream, REPLACEMENT_MARK } from "./design-stream"
import { DASHBOARD_FAILING, DASHBOARD_PASSING } from "./design-validator.fixtures"
import {
    designContractFor,
    generationFailed,
    getInspirationImageUrls,
    getStyleGuide,
    imageParts,
    IncompleteDesignError,
    prepareDesign,
    streamDesign,
    styleGuideMissing,
} from "./generation"
import { buildImageManifest, designHtmlForPrompt, resolveDesignHtml } from "./image-manifest"

// The real queries call Convex with the signed-in user's token. Nothing here reaches the model,
// Convex or the network.
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
        { title: "Primary Colors", swatches: [{ name: "Background", hexColor: "#ffffff", description: "page" }, { name: "Foreground", hexColor: "#1F2933" }, { name: "Primary", hexColor: "#F2C14E", description: "buttons" }, { name: "Primary Foreground", hexColor: "#FFFFFF" }] },
        { title: "Status & Feedback Colors", swatches: [{ name: "Destructive", hexColor: "#b01f2a", description: "errors" }] },
    ],
    typographySections: [
        { title: "Headings", styles: [{ name: "H1", description: "page title", fontFamily: "Inter", fontWeight: "700", fontSize: "32px", lineHeight: "40px" }] },
    ],
} as unknown as StyleGuide

const imageUrl = "https://img.test/1.png"
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 120, 0, 0, 0, 80])

const styleGuideIs = (value: unknown) =>
    vi.mocked(StyleGuideQuery).mockResolvedValue({ styleGuide: value } as Awaited<ReturnType<typeof StyleGuideQuery>>)

// What the AI SDK's streamText returns, as far as streamDesign reads it
const modelResult = (chunks: string[], finishReason: string) => ({
    textStream: (async function* () { yield* chunks })(),
    finishReason: Promise.resolve(finishReason),
    totalUsage: Promise.resolve({ inputTokens: 1200, outputTokens: 900, totalTokens: 2100, reasoningTokens: 300 }),
}) as unknown as ReturnType<typeof streamText>

const modelReturns = (chunks: string[], finishReason: string) => vi.mocked(streamText).mockReturnValue(modelResult(chunks, finishReason))

// The model's answers to successive calls: the design, then the repair
const modelAnswers = (...answers: [chunks: string[], finishReason: string][]) => {
    for (const [chunks, finishReason] of answers) vi.mocked(streamText).mockReturnValueOnce(modelResult(chunks, finishReason))
}

// A design split into chunks as a model streams it, cut mid-tag
const inChunks = (html: string, size = 700) => html.match(new RegExp(`[\\s\\S]{1,${size}}`, "g"))!

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "info").mockImplementation(() => {})
})

afterEach(() => {
    vi.unstubAllGlobals()
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

describe("the design's inputs", () => {
    it("logs each color the contract had to correct for contrast", () => {
        const contract = designContractFor(guide, "p1")
        expect(contract.colors.primaryForeground).not.toBe("#FFFFFF")
        expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/^\[design-contract\] project p1: primaryForeground #FFFFFF on primary #F2C14E is 1\.\d+:1; using #[0-9A-F]{6} \(4\.\d+:1\)$/))
    })

    it("keeps the inspiration images in order and drops images without a URL", async () => {
        vi.mocked(InspirationImagesQuery).mockResolvedValue({
            images: [{ url: "https://img.test/1.png" }, { url: "" }, { url: "https://img.test/2.png" }],
        } as unknown as Awaited<ReturnType<typeof InspirationImagesQuery>>)
        expect(await getInspirationImageUrls("p1")).toEqual(["https://img.test/1.png", "https://img.test/2.png"])
    })

    it("loads the project's images into a manifest, with the outline's slots, and attaches the same bytes", async () => {
        vi.mocked(InspirationImagesQuery).mockResolvedValue({ images: [{ url: imageUrl }] } as unknown as Awaited<ReturnType<typeof InspirationImagesQuery>>)
        const fetcher = vi.fn(async () => new Response(png, { headers: { "content-type": "image/png" } }))
        vi.stubGlobal("fetch", fetcher)
        const { contract, images, manifest } = await prepareDesign("p1", guide, [{ node: "hero", aspectRatio: 1.5, box: [0, 0, 50, 50] }])
        expect(fetcher).toHaveBeenCalledWith(imageUrl, expect.anything())
        expect(contract.version).toBe(1)
        expect(manifest.images).toEqual([{ id: "img-1", url: imageUrl, width: 120, height: 80, loaded: true }])
        expect(manifest.slots).toEqual([{ id: "slot-1", node: "hero", aspectRatio: 1.5, image: "img-1" }])
        expect(imageParts(images)).toEqual([{ type: "image", image: png, mediaType: "image/png" }])
    })

    it("keeps img-3 as img-3 when image 2 fails to load, in an initial design and in a refine", async () => {
        const urls = ["https://img.test/1.png", "https://img.test/2.png", "https://img.test/3.png"]
        vi.mocked(InspirationImagesQuery).mockResolvedValue({ images: urls.map((url) => ({ url })) } as unknown as Awaited<ReturnType<typeof InspirationImagesQuery>>)
        vi.stubGlobal("fetch", vi.fn(async (url: string) =>
            url === urls[1] ? new Response("gone", { status: 404 }) : new Response(png, { headers: { "content-type": "image/png" } })))
        const colors = { fill: "#EEEEEE", ink: "#333333" }
        const { contract, images, manifest } = await prepareDesign("p1", guide, [{ node: "hero", aspectRatio: 1.5, box: [0, 0, 50, 50] }, { node: "card", aspectRatio: 1, box: [60, 60, 70, 70] }])

        expect(manifest.images.map((image) => [image.id, image.url, image.loaded])).toEqual([["img-1", urls[0], true], ["img-2", urls[1], false], ["img-3", urls[2], true]])
        // The slots skip the image that's missing
        expect(manifest.slots.map((slot) => slot.image)).toEqual(["img-1", "img-3"])
        // Only the two that loaded are attached, and the request names them
        expect(imageParts(images)).toEqual([{ type: "image", image: png, mediaType: "image/png" }, { type: "image", image: png, mediaType: "image/png" }])
        const initial = designPrompt({ mode: "initial", contract, manifest, outline: null, hasWireframe: true }).text
        expect(initial).toContain("Attached images: the wireframe, then img-1, img-3.")
        expect(resolveDesignHtml('<img src="img-3" alt="c"><img src="img-2" alt="b">', manifest, colors)).toMatch(new RegExp(`^<img src="${urls[2]}" alt="c"><img src="data:image/svg\\+xml,[^"]+" data-placeholder="true" alt="b">$`))

        // A refine of a design saved when all three loaded: the same ids, the same attachments
        const saved = `<img src="${urls[0]}" alt="a"><img src="${urls[1]}" alt="b"><img src="${urls[2]}" alt="c">`
        const refine = designPrompt({ mode: "refine", contract, manifest, message: "Make it green", currentHtml: designHtmlForPrompt(saved, manifest), outline: null, hasWireframe: true }).text
        expect(refine).toContain('<img src="img-1" alt="a"><img src="img-2" alt="b"><img src="img-3" alt="c">')
        expect(refine).toContain("Attached images: the wireframe this page was first built from, then img-1, img-3.")
        expect(resolveDesignHtml('<img src="img-3" alt="c">', manifest, colors)).toBe(`<img src="${urls[2]}" alt="c">`)
    })
})

describe("streamDesign", () => {
    const contract = buildDesignContract(guide)
    const manifest = buildImageManifest([{ url: imageUrl, width: 120, height: 80 }])
    const design: DesignRequest = { mode: "refine", contract, manifest, message: "Make the button green", currentHtml: '<div data-generated-ui><img src="img-1"></div>', outline: null, hasWireframe: false }
    const request = () => new Request("http://localhost/api/generate/redesign", { method: "POST" })

    it("asks the model with the mode's instructions at temperature 0.2 and an output limit, and streams the design with its images resolved", async () => {
        modelReturns(['<div data-generated-ui><img src="im', 'g-1" alt="Pots"></div>'], "stop")
        vi.mocked(ConsumeCreditsQuery).mockResolvedValue({ ok: true, balance: 3 } as Awaited<ReturnType<typeof ConsumeCreditsQuery>>)

        const response = await streamDesign({ request: request(), cost: 1, design, attachments: [{ type: "image", image: png, mediaType: "image/png" }] })

        const call = vi.mocked(streamText).mock.calls[0][0]
        expect(call).toMatchObject({
            model: { modelId: "gemini-2.5-flash" },
            system: designSystemPrompt("refine"),
            temperature: 0.2,
            maxOutputTokens: DESIGN_MAX_OUTPUT_TOKENS,
            // Thinking counts against the limit, so it's capped
            providerOptions: { google: { thinkingConfig: { thinkingBudget: 4096 } } },
        })
        const [message] = call.messages!
        expect(message.role).toBe("user")
        expect(message.content).toEqual([{ type: "text", text: expect.stringContaining('The user\'s request: "Make the button green"') }, { type: "image", image: png, mediaType: "image/png" }])
        expect(await response.text()).toBe(`<div data-generated-ui><img src="${imageUrl}" alt="Pots"></div>`)
        expect(ConsumeCreditsQuery).toHaveBeenCalledWith({ amount: 1 })
        // How it finished, and the tokens it took, thinking included
        expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/^\[design\] \{"mode":"refine","attempt":1,"finishReason":"stop","usage":\{"inputTokens":1200,"outputTokens":900,"totalTokens":2100,"reasoningTokens":300\},"ms":\d+\}$/))
    })

    it("breaks the stream off when the model stopped before finishing, so the client doesn't keep it", async () => {
        modelReturns(['<div data-generated-ui><section id="hero">', "<h1>Plants"], "length")
        vi.mocked(ConsumeCreditsQuery).mockResolvedValue({ ok: true, balance: 3 } as Awaited<ReturnType<typeof ConsumeCreditsQuery>>)

        const response = await streamDesign({ request: request(), cost: 1, design, attachments: [] })

        await expect(response.text()).rejects.toThrow()
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"finishReason":"length"'))
        expect(console.error).toHaveBeenCalledWith("Generation ended incomplete:", expect.any(IncompleteDesignError))
    })

    it("charges nothing when the model returns no output at all", async () => {
        modelReturns([], "length")
        const response = await streamDesign({ request: request(), cost: 1, design, attachments: [] })
        expect(response.status).toBe(502)
        expect(ConsumeCreditsQuery).not.toHaveBeenCalled()
    })
})

describe("the check, and its one repair", () => {
    const contract = buildDesignContract(EVAL_FIXTURES[1].guide)
    const manifest = buildImageManifest([])
    const colors = { fill: contract.colors.muted, ink: contract.colors.mutedForeground }
    const design: DesignRequest = { mode: "initial", contract, manifest, outline: null, hasWireframe: true }
    // A tab that reads replacements, as the app's own does
    const request = (headers: Record<string, string> = DESIGN_STREAM_HEADERS) => new Request("http://localhost/api/generate", { method: "POST", headers })
    const failing = resolveDesignHtml(DASHBOARD_FAILING, manifest, colors)
    const passing = resolveDesignHtml(DASHBOARD_PASSING, manifest, colors)
    const charged = () => vi.mocked(ConsumeCreditsQuery).mockResolvedValue({ ok: true, balance: 3 } as Awaited<ReturnType<typeof ConsumeCreditsQuery>>)
    const checkLine = () => vi.mocked(console.info).mock.calls.map(([line]) => String(line)).find((line) => line.startsWith("[design-check]"))

    it("repairs a design the check finds errors in with one more call, sends the repair after the first, and charges one credit", async () => {
        charged()
        modelAnswers([inChunks(DASHBOARD_FAILING), "stop"], [inChunks(DASHBOARD_PASSING), "stop"])

        const response = await streamDesign({ request: request(), cost: 1, design, attachments: [{ type: "image", image: png, mediaType: "image/png" }] })
        const text = await response.text()

        // The first design streamed as it came, then the mark, then the repaired one
        expect(text).toBe(`${failing}${REPLACEMENT_MARK}${passing}`)
        expect(finalDesign(text)).toBe(passing)
        expect(streamText).toHaveBeenCalledTimes(2)
        expect(ConsumeCreditsQuery).toHaveBeenCalledTimes(1)
        expect(ConsumeCreditsQuery).toHaveBeenCalledWith({ amount: 1 })

        // The repair: the repair instructions, the errors listed, the page with its images as ids, nothing attached
        const repair = vi.mocked(streamText).mock.calls[1][0]
        expect(repair.system).toBe(designSystemPrompt("repair"))
        const [message] = repair.messages!
        expect(message.content).toEqual([{ type: "text", text: expect.any(String) }])
        const repairText = (message.content as { text: string }[])[0].text
        expect(repairText).toContain("Mode: repair. A check of the page below found these problems. Fix only these, and change nothing else:\n- Contrast 1.00:1, under 4.5:1")
        expect(repairText).toContain("- Placeholder text \"Chart placeholder\"")
        expect(repairText).toContain("- Made-up people's names: \"Alice Smith\"")
        expect(repairText).toContain("No images are attached.")
        expect(repairText).toContain(`Page to fix (complete HTML): fix the problems listed above and keep everything else exactly as it is.\n${failing}`)
        expect(checkLine()).toBe('[design-check] {"mode":"initial","errors":3,"warnings":0,"kinds":{"contrast":1,"placeholder":1,"name":1},"after":{"errors":0,"warnings":0,"kinds":{}},"repair":"kept"}')
        expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/^\[design\] \{"mode":"repair","attempt":2,"finishReason":"stop"/))
    })

    it("keeps the first design when the repair is no better, and never tries a second repair", async () => {
        charged()
        vi.mocked(streamText).mockImplementation(() => modelResult(inChunks(DASHBOARD_FAILING), "stop"))

        const text = await (await streamDesign({ request: request(), cost: 1, design, attachments: [] })).text()

        expect(text).toBe(`${failing}${REPLACEMENT_MARK}`)
        expect(finalDesign(text)).toBe(failing)
        // The repair still had errors, and that's the end of it: one design, one repair
        expect(streamText).toHaveBeenCalledTimes(2)
        expect(ConsumeCreditsQuery).toHaveBeenCalledTimes(1)
        expect(checkLine()).toContain('"repair":"discarded"')
    })

    it("keeps the first design when the repair stops before it's finished", async () => {
        charged()
        modelAnswers([inChunks(DASHBOARD_FAILING), "stop"], [['<div data-generated-ui><section id="hero">'], "length"])

        const response = await streamDesign({ request: request(), cost: 1, design, attachments: [] })

        expect(await readDesignStream(response)).toBe(failing)
        expect(streamText).toHaveBeenCalledTimes(2)
        expect(ConsumeCreditsQuery).toHaveBeenCalledTimes(1)
        expect(checkLine()).toContain('"repair":"failed"')
    })

    it("doesn't repair for a tab that can't take a replacement", async () => {
        charged()
        modelAnswers([inChunks(DASHBOARD_FAILING), "stop"])

        const text = await (await streamDesign({ request: request({}), cost: 1, design, attachments: [] })).text()

        expect(text).toBe(failing)
        expect(streamText).toHaveBeenCalledTimes(1)
        expect(checkLine()).toBe('[design-check] {"mode":"initial","errors":3,"warnings":0,"kinds":{"contrast":1,"placeholder":1,"name":1},"repair":"not-sent"}')
    })

    it("sends a design without errors as it is, after one call", async () => {
        charged()
        modelAnswers([inChunks(DASHBOARD_PASSING), "stop"])

        const text = await (await streamDesign({ request: request(), cost: 1, design, attachments: [] })).text()

        expect(text).toBe(passing)
        expect(streamText).toHaveBeenCalledTimes(1)
        expect(checkLine()).toContain('"repair":"not-needed"')
    })

    it("breaks off a first design that didn't finish, without checking or repairing it", async () => {
        charged()
        modelAnswers([inChunks(DASHBOARD_FAILING).slice(0, 2), "length"])

        const response = await streamDesign({ request: request(), cost: 1, design, attachments: [] })

        await expect(response.text()).rejects.toThrow()
        expect(streamText).toHaveBeenCalledTimes(1)
        expect(checkLine()).toBeUndefined()
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
