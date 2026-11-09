import { checkCredits } from "@/lib/credits";
import { generationFailed, getStyleGuide, imageParts, prepareDesign, streamDesign, styleGuideMissing } from "@/lib/generation";
import { outlineImageSlots, parseOutline } from "@/lib/wireframe-outline";
import { NextRequest, NextResponse } from "next/server";

const COST = 1

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const imageFile = formData.get('image') as File
        const projectId = formData.get('projectId') as string
        // The wireframe's boxes, labels and words, read from the canvas (src/lib/frame-outline.ts) as
        // JSON. It comes from the request, so it's checked and capped before the prompt uses it. A tab
        // opened before structured outlines still sends the old text form, which is used as it is.
        const rawOutline = String(formData.get('outline') ?? '').slice(0, 100_000)
        const structured = rawOutline.trimStart().startsWith('{')
        const outline = structured ? parseOutline(rawOutline) : null
        const legacyOutline = !structured && rawOutline ? rawOutline.slice(0, 12_000) : null

        if (!imageFile) {
            return NextResponse.json(
                { error: 'Image file is required' },
                { status: 400 }
            )
        }

        if (!imageFile.type.startsWith('image/')) {
            return NextResponse.json(
                { error: 'Invalid image file' },
                { status: 400 }
            )
        }

        if (!projectId) {
            return NextResponse.json(
                { error: 'Project ID is required' },
                { status: 400 }
            )
        }

        const creditError = await checkCredits(COST)
        if (creditError) return creditError

        const imageBuffer = await imageFile.arrayBuffer()
        const base64Image = Buffer.from(imageBuffer).toString('base64')

        const guide = await getStyleGuide(projectId)
        if (!guide) return styleGuideMissing('generating designs')

        const { contract, images, manifest } = await prepareDesign(projectId, guide, outline ? outlineImageSlots(outline) : [])

        return streamDesign({
            request,
            cost: COST,
            design: { mode: 'initial', contract, manifest, outline, legacyOutline, hasWireframe: true },
            attachments: [{ type: 'image', image: base64Image, mediaType: 'image/png' }, ...imageParts(images)],
        })

    } catch (error) {
        return generationFailed('Failed to generate design', error)
    }
}
