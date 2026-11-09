import { checkCredits } from "@/lib/credits";
import { generationFailed, getStyleGuide, imageParts, prepareDesign, streamDesign, styleGuideMissing } from "@/lib/generation";
import { designHtmlForPrompt } from "@/lib/image-manifest";
import { outlineImageSlots, parseOutline } from "@/lib/wireframe-outline";
import { NextRequest, NextResponse } from "next/server";

const COST = 1

// A chat request to change a design: refine mode, which changes only what the user asks for
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { userMessage, generatedUIId, currentHTML, wireframeSnapshot, projectId } = body
        // The client sends null when the source frame is gone or the snapshot failed
        const hasWireframe = typeof wireframeSnapshot === 'string' && wireframeSnapshot.length > 0
        // The source frame's outline, when the frame still exists: background on how the page was laid out
        const outline = body.outline ? parseOutline(JSON.stringify(body.outline).slice(0, 100_000)) : null

        if (!userMessage || !generatedUIId || !projectId || typeof currentHTML !== 'string' || !currentHTML) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            )
        }

        const creditError = await checkCredits(COST)
        if (creditError) return creditError

        const guide = await getStyleGuide(projectId)
        if (!guide) return styleGuideMissing('redesigning')

        const { contract, images, manifest } = await prepareDesign(projectId, guide, outline ? outlineImageSlots(outline) : [])

        return streamDesign({
            request,
            cost: COST,
            design: {
                mode: 'refine',
                contract,
                manifest,
                message: String(userMessage).slice(0, 4_000),
                currentHtml: designHtmlForPrompt(currentHTML, manifest),
                outline,
                hasWireframe,
            },
            attachments: [
                ...(hasWireframe ? [{ type: 'image' as const, image: wireframeSnapshot as string, mediaType: 'image/png' }] : []),
                ...imageParts(images),
            ],
        })

    } catch (error) {
        return generationFailed('Failed to process redesign request', error)
    }
}
