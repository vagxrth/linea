import { InspirationImagesQuery, StyleGuideQuery } from "@/convex/query.config";
import { chargedGeneration, checkCredits } from "@/lib/credits";
import { prompts } from "@/prompts";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { userMessage, generatedUIId, currentHTML, wireframeSnapshot, projectId } = body
        // The client sends null when the source frame is gone or the snapshot failed
        const hasWireframe = typeof wireframeSnapshot === 'string' && wireframeSnapshot.length > 0

        if (!userMessage || !generatedUIId || !projectId) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            )
        }

        const creditError = await checkCredits(1)
        if (creditError) return creditError

        const styleGuide = await StyleGuideQuery(projectId)
        const styleGuideData = styleGuide.styleGuide._valueJSON as unknown as {
            colorSections: unknown[]
            typographySections: unknown[]
        } | null

        // Check if style guide exists
        if (!styleGuideData || !styleGuideData.colorSections || !styleGuideData.typographySections) {
            return NextResponse.json(
                { 
                    error: 'Style guide not found', 
                    details: 'Please generate a style guide first before redesigning. Go to the Style Guide tab and create one from your moodboard images.' 
                },
                { status: 400 }
            )
        }

        const inspirationResult = await InspirationImagesQuery(projectId)
        const images = inspirationResult.images._valueJSON as unknown as {
            url: string
        }[]

        const imageUrls = images.map((img) => img.url).filter(Boolean)

        const colors = styleGuideData.colorSections || []
        const typography = styleGuideData.typographySections || []

        let userPrompt = `Please redesign this UI based on my request: "${userMessage}"`

        if (currentHTML) {
            userPrompt += `\n\nCurrent HTML for reference:\n${currentHTML.substring(0, 1000)}...`
        }

        if (hasWireframe) {
            userPrompt += `\n\nWireframe Context: I'm providing a wireframe image that shows the EXACT original design layout and structure that this UI was generated from. This wireframe represents the specific frame that was used to create the current design. Please use this as visual context to understand the intended layout, structure, and design elements when making improvements. The wireframe shows the original wireframe/mockup that the user drew or created.`
        } else {
            console.log('No wireframe context provided for redesign')
        }

        if (colors.length > 0) {
            userPrompt += `\n\nStyle Guide Colors:\n${(
                colors as Array<{
                    swatches: Array<{
                        name: string;
                        hexColor: string;
                        description: string;
                    }>;
                }>
            )
                .map((color) =>
                    color.swatches
                        .map(
                            (swatch) =>
                                `${swatch.name}: ${swatch.hexColor}, ${swatch.description}`
                        )
                        .join(", ")
                )
                .join(", ")}`
        }

        if (typography.length > 0) {
            userPrompt += `\n\nTypography:\n${(
                typography as Array<{
                    styles: Array<{
                        name: string;
                        description: string;
                        fontFamily: string;
                        fontWeight: string;
                        fontSize: string;
                        lineHeight: string;
                    }>;
                }>
            )
                .map((typo) =>
                    typo.styles
                        .map(
                            (style) =>
                                `${style.name}: ${style.description}, ${style.fontFamily}, ${style.fontWeight}, ${style.fontSize}, ${style.lineHeight}`
                        )
                        .join(", ")
                )
                .join(", ")}`
        }

        if (imageUrls.length > 0) {
            userPrompt += `\n\nInspiration Images Available: ${imageUrls.length} reference images for visual style and inspiration.`
        }

        userPrompt += `\n\nPlease generate a professional redesigned UI based on my request while following the style guide, maintaining professional quality, and considering the wireframe context for layout understanding.`

        const generation = chargedGeneration(request, 1)
        const result = streamText({
            model: google('gemini-2.5-flash'),
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: userPrompt,
                        },
                        ...(hasWireframe ? [{ type: 'image' as const, image: wireframeSnapshot as string }] : []),
                        ...imageUrls.map((url) => ({
                            type: 'image' as const,
                            image: url,
                        })),
                    ],
                }
            ],
            system: prompts.generatedUi.system,
            temperature: 0.7,
            abortSignal: generation.abortSignal,
            onError: generation.onError,
        })

        return generation.respond(result.textStream)

    } catch (error) {
        console.error('Redesign failed: ', error)
        return NextResponse.json(
            { error: 'Failed to process redesign request', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )   
    }
}