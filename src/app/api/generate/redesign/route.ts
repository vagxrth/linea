import { checkCredits } from "@/lib/credits";
import { generationFailed, getInspirationImageUrls, getStyleGuide, imageParts, streamDesign, styleGuideMissing, styleGuideSections } from "@/lib/generation";
import { NextRequest, NextResponse } from "next/server";

const COST = 1

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

        const creditError = await checkCredits(COST)
        if (creditError) return creditError

        const guide = await getStyleGuide(projectId)
        if (!guide) return styleGuideMissing('redesigning')

        const imageUrls = await getInspirationImageUrls(projectId)

        let userPrompt = `Please redesign this UI based on my request: "${userMessage}"`

        if (currentHTML) {
            userPrompt += `\n\nCurrent design (full HTML). Start from it: apply my request, keep everything my request doesn't mention (layout, content, ids and .c-* color classes) as it is, and return the complete updated HTML:\n${currentHTML}`
        }

        if (hasWireframe) {
            userPrompt += `\n\nWireframe Context: I'm providing a wireframe image that shows the EXACT original design layout and structure that this UI was generated from. This wireframe represents the specific frame that was used to create the current design. Please use this as visual context to understand the intended layout, structure, and design elements when making improvements. The wireframe shows the original wireframe/mockup that the user drew or created. The current design and my request take priority over the wireframe.`
        } else {
            console.log('No wireframe context provided for redesign')
        }

        userPrompt += styleGuideSections(guide)

        if (imageUrls.length > 0) {
            userPrompt += `\n\nInspiration Images Available: ${imageUrls.length} reference images for visual style and inspiration.`
        }

        userPrompt += `\n\nPlease generate the complete redesigned UI based on my request while following the style guide and maintaining professional quality.`

        return streamDesign(request, COST, [
            { type: 'text', text: userPrompt },
            ...(hasWireframe ? [{ type: 'image' as const, image: wireframeSnapshot as string }] : []),
            ...imageParts(imageUrls),
        ])

    } catch (error) {
        return generationFailed('Failed to process redesign request', error)
    }
}
