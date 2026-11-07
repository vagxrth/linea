import { checkCredits } from "@/lib/credits";
import { generationFailed, getStyleGuide, prepareDesign, streamDesign, styleGuideMissing } from "@/lib/generation";
import { designHtmlForPrompt } from "@/lib/image-manifest";
import { NextRequest, NextResponse } from "next/server";

const COST = 1

// A chat request to change a workflow page: refine mode, like any other design. Workflow pages have
// no wireframe of their own, so there's no outline or wireframe image. The images aren't attached
// either, but the manifest still lists them, so the page's images keep their ids.
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { userMessage, generatedUIId, currentHTML, projectId } = body

        if (!userMessage || !generatedUIId || typeof currentHTML !== 'string' || !currentHTML || !projectId) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            )
        }

        const creditError = await checkCredits(COST)
        if (creditError) return creditError

        const guide = await getStyleGuide(projectId)
        if (!guide) return styleGuideMissing('redesigning workflow')

        const { contract, manifest } = await prepareDesign(projectId, guide)

        return streamDesign({
            request,
            cost: COST,
            design: {
                mode: 'refine',
                contract,
                manifest,
                message: String(userMessage).slice(0, 4_000),
                currentHtml: designHtmlForPrompt(currentHTML, manifest),
                outline: null,
                hasWireframe: false,
                imagesAttached: false,
            },
            attachments: [],
        })

    } catch (error) {
        return generationFailed('Failed to process workflow redesign request', error)
    }
}
