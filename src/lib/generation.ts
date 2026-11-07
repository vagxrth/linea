import { google } from "@ai-sdk/google"
import { streamText, type UserContent } from "ai"
import { NextResponse } from "next/server"
import { InspirationImagesQuery, StyleGuideQuery } from "@/convex/query.config"
import type { StyleGuide } from "@/redux/api/style-guide"
import { chargedGeneration } from "./credits"
import { buildDesignContract, contractCorrections, type DesignContract } from "./design-contract"
import { DESIGN_MAX_OUTPUT_TOKENS, DESIGN_MODEL_ID, DESIGN_TEMPERATURE, designPrompt, type DesignRequest } from "./design-request"
import { buildImageManifest, loadImages, resolveDesignImages, type ImageManifest, type LoadedImage } from "./image-manifest"
import type { OutlineImageSlot } from "./wireframe-outline"

// The model every generate route asks
export const model = google(DESIGN_MODEL_ID)

// The project's style guide, or null when it hasn't generated one yet
export const getStyleGuide = async (projectId: string): Promise<StyleGuide | null> => {
    const { styleGuide } = await StyleGuideQuery(projectId)
    const guide: StyleGuide | null = styleGuide
    return guide?.colorSections && guide.typographySections ? guide : null
}

// The 400 response for a route that needs a style guide, where `action` finishes "before …"
export const styleGuideMissing = (action: string) =>
    NextResponse.json(
        {
            error: 'Style guide not found',
            details: `Please generate a style guide first before ${action}. Go to the Style Guide tab and create one from your moodboard images.`,
        },
        { status: 400 }
    )

// The project's inspiration image URLs, in the order the user added them
export const getInspirationImageUrls = async (projectId: string) => {
    const { images } = await InspirationImagesQuery(projectId)
    return images.map((image) => image.url).filter((url): url is string => Boolean(url))
}

// The project's style guide as a design contract. Text colors it had to correct for contrast are
// logged, since they mean the guide itself fails WCAG AA there.
export const designContractFor = (guide: StyleGuide, projectId: string): DesignContract => {
    const contract = buildDesignContract(guide)
    for (const check of contractCorrections(contract)) {
        console.warn(
            `[design-contract] project ${projectId}: ${check.foreground} ${check.corrected!.original} on ${check.background} ${check.colors[0]} ` +
            `is ${check.ratio}:1; using ${check.corrected!.foreground} (${check.corrected!.ratio}:1)`
        )
    }
    return contract
}

// What every design request starts from: the contract, and the project's images loaded into a
// manifest (with the wireframe's image slots, when there's an outline)
export const prepareDesign = async (projectId: string, guide: StyleGuide, slots: OutlineImageSlot[] = []) => {
    const contract = designContractFor(guide, projectId)
    const images = await loadImages(await getInspirationImageUrls(projectId))
    const manifest = buildImageManifest(images, slots)
    return { contract, images, manifest }
}

// The project's images as attachments, in manifest order, from the bytes already loaded
export const imageParts = (images: LoadedImage[]) =>
    images.map((image) => ({ type: 'image' as const, image: image.bytes, ...(image.mediaType ? { mediaType: image.mediaType } : {}) }))

// Thrown when the model stopped before the design was finished
export class IncompleteDesignError extends Error {
    constructor(readonly finishReason: string) {
        super(`The model stopped before the design was finished (${finishReason})`)
        this.name = 'IncompleteDesignError'
    }
}

// An attachment that follows the request's text
export type DesignAttachment = Exclude<UserContent, string>[number]

type StreamDesignOptions = {
    request: Request
    // Credits charged once the model's output starts
    cost: number
    design: DesignRequest
    // Images after the request's text: the wireframe first, when there is one, then the manifest's
    attachments: DesignAttachment[]
}

// Streams an HTML design from the model with the mode's instructions, charging `cost` credits once
// output starts. Image ids are swapped for the project's image addresses as it streams. The finish
// reason and token usage are logged; when the model didn't finish (finishReason other than "stop")
// the response breaks off, so the client knows not to keep what it got.
export const streamDesign = ({ request, cost, design, attachments }: StreamDesignOptions) => {
    const generation = chargedGeneration(request, cost)
    const startedAt = Date.now()
    const { system, text } = designPrompt(design)
    const result = streamText({
        model,
        system,
        messages: [{ role: 'user', content: [{ type: 'text', text }, ...attachments] }],
        temperature: DESIGN_TEMPERATURE,
        maxOutputTokens: DESIGN_MAX_OUTPUT_TOKENS,
        abortSignal: generation.abortSignal,
        onError: generation.onError,
    })
    const finished = (async () => {
        let finishReason: string
        try {
            finishReason = await result.finishReason
        } catch (error) {
            // No output at all (a refused key, say): logged too, so every request leaves a line
            console.info(`[design] ${JSON.stringify({ mode: design.mode, finishReason: 'no-output', ms: Date.now() - startedAt })}`)
            throw error
        }
        const usage = await result.totalUsage.catch(() => undefined)
        console.info(`[design] ${JSON.stringify({ mode: design.mode, finishReason, usage, ms: Date.now() - startedAt })}`)
        if (finishReason !== 'stop') throw new IncompleteDesignError(finishReason)
    })()
    // respond() reports a failure; this only keeps one nobody reads (an aborted request's) quiet
    finished.catch(() => {})
    const placeholderColors = { fill: design.contract.colors.muted, ink: design.contract.colors.mutedForeground }
    return generation.respond(resolveDesignImages(result.textStream, design.manifest, placeholderColors), finished)
}

// Logs a request that threw and returns the 500 response the client shows
export const generationFailed = (message: string, error: unknown) => {
    console.error(`${message}:`, error)
    return NextResponse.json(
        { error: message, details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
    )
}

export type { DesignRequest, ImageManifest }
