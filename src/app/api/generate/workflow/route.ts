import { checkCredits } from "@/lib/credits";
import { generationFailed, getStyleGuide, imageParts, prepareDesign, streamDesign, styleGuideMissing } from "@/lib/generation";
import { WORKFLOW_PAGE_TYPES } from "@/lib/design-request";
import { designHtmlForPrompt } from "@/lib/image-manifest";
import { NextRequest, NextResponse } from "next/server";

// Per page; the client requests four pages
const COST = 1

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { generatedUIId, currentHTML, projectId, pageIndex } = body

        if (
            !generatedUIId ||
            typeof currentHTML !== 'string' ||
            !currentHTML ||
            !projectId ||
            pageIndex === undefined
        ) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            )
        }

        const creditError = await checkCredits(COST)
        if (creditError) return creditError

        const guide = await getStyleGuide(projectId)
        if (!guide) return styleGuideMissing('generating workflow designs')

        const { contract, images, manifest } = await prepareDesign(projectId, guide)

        return streamDesign({
            request,
            cost: COST,
            design: {
                mode: 'workflow',
                contract,
                manifest,
                pageType: WORKFLOW_PAGE_TYPES[pageIndex] ?? WORKFLOW_PAGE_TYPES[0],
                mainHtml: designHtmlForPrompt(currentHTML, manifest),
            },
            attachments: imageParts(images),
        })
    } catch (error) {
        return generationFailed('Failed to process workflow generation request', error)
    }
}
