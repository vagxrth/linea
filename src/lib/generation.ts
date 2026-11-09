import { google } from "@ai-sdk/google"
import { NextResponse } from "next/server"
import { InspirationImagesQuery, StyleGuideQuery } from "@/convex/query.config"
import type { StyleGuide } from "@/redux/api/style-guide"
import { chargedGeneration } from "./credits"
import { buildDesignContract, contractCorrections, type DesignContract } from "./design-contract"
import { generateDesign, type DesignAttachment } from "./design-generation"
import { DESIGN_MODEL_ID, type DesignRequest } from "./design-request"
import { acceptsReplacement } from "./design-stream"
import { buildImageManifest, loadImages, type ImageManifest, type LoadedImage } from "./image-manifest"
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

// The project's images that loaded, as attachments in manifest order, from the bytes already
// loaded. The request text names them ("then img-1, img-3"), so one that failed is skipped without
// the ones after it changing places.
export const imageParts = (images: LoadedImage[]) =>
    images.flatMap((image) => (image.bytes ? [{ type: 'image' as const, image: image.bytes, ...(image.mediaType ? { mediaType: image.mediaType } : {}) }] : []))

type StreamDesignOptions = {
    request: Request
    // Credits charged once the model's output starts
    cost: number
    design: Exclude<DesignRequest, { mode: "repair" }>
    // Images after the request's text: the wireframe first, when there is one, then the manifest's
    attachments: DesignAttachment[]
}

// Streams an HTML design from the model with the mode's instructions (src/lib/design-generation.ts),
// charging `cost` credits once output starts: once per design, the repair call included. Image ids are
// swapped for the project's image addresses as it streams, and when the model didn't finish the
// response breaks off, so the client knows not to keep what it got. A client that reads replacements
// gets the repaired design after the first when the check found errors and the repair has fewer.
export const streamDesign = ({ request, cost, design, attachments }: StreamDesignOptions) => {
    const generation = chargedGeneration(request, cost)
    return generation.respond(generateDesign({
        model,
        design,
        attachments,
        abortSignal: generation.abortSignal,
        onError: generation.onError,
        repair: acceptsReplacement(request),
    }))
}

// Logs a request that threw and returns the 500 response the client shows
export const generationFailed = (message: string, error: unknown) => {
    console.error(`${message}:`, error)
    return NextResponse.json(
        { error: message, details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
    )
}

export { IncompleteDesignError } from "./design-generation"
export type { DesignAttachment, DesignRequest, ImageManifest }
