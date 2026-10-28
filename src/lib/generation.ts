import { google } from "@ai-sdk/google"
import { streamText, type UserContent } from "ai"
import { NextResponse } from "next/server"
import { InspirationImagesQuery, StyleGuideQuery } from "@/convex/query.config"
import { prompts } from "@/prompts"
import type { StyleGuide } from "@/redux/api/style-guide"
import { chargedGeneration } from "./credits"

// The model every generate route asks
export const model = google('gemini-2.5-flash')

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

// Images to attach after the prompt text
export const imageParts = (images: string[]) => images.map((image) => ({ type: 'image' as const, image }))

// The style guide's swatches and type styles as comma-separated text for a prompt
export const colorsText = (guide: StyleGuide) =>
    guide.colorSections
        .map((section) => section.swatches.map((swatch) => `${swatch.name}: ${swatch.hexColor}, ${swatch.description}`).join(", "))
        .join(", ")

export const typographyText = (guide: StyleGuide) =>
    guide.typographySections
        .map((section) =>
            section.styles
                .map((style) => `${style.name}: ${style.description}, ${style.fontFamily}, ${style.fontWeight}, ${style.fontSize}, ${style.lineHeight}`)
                .join(", ")
        )
        .join(", ")

// The style guide as the sections the redesign and workflow prompts end with
export const styleGuideSections = (guide: StyleGuide) =>
    (guide.colorSections.length > 0 ? `\n\nStyle Guide Colors:\n${colorsText(guide)}` : '') +
    (guide.typographySections.length > 0 ? `\n\nTypography:\n${typographyText(guide)}` : '')

// Streams an HTML design from the model, charging `cost` credits once output starts
export const streamDesign = (request: Request, cost: number, content: UserContent) => {
    const generation = chargedGeneration(request, cost)
    const result = streamText({
        model,
        messages: [{ role: 'user', content }],
        system: prompts.generatedUi.system,
        temperature: 0.7,
        abortSignal: generation.abortSignal,
        onError: generation.onError,
    })
    return generation.respond(result.textStream)
}

// Logs a request that threw and returns the 500 response the client shows
export const generationFailed = (message: string, error: unknown) => {
    console.error(`${message}:`, error)
    return NextResponse.json(
        { error: message, details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
    )
}
