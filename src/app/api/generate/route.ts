import { checkCredits } from "@/lib/credits";
import { colorsText, generationFailed, getInspirationImageUrls, getStyleGuide, imageParts, streamDesign, styleGuideMissing, typographyText } from "@/lib/generation";
import { NextRequest, NextResponse } from "next/server";

const COST = 1

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const imageFile = formData.get('image') as File
        const projectId = formData.get('projectId') as string

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

        const imageUrls = await getInspirationImageUrls(projectId)

        const userPrompt = `Use the user-provided styleGuide for all visual decisions: put its hex colors into the .c-* color classes of your <style> block and follow its typography. Enforce WCAG AA contrast (≥4.5:1 body, ≥3:1 large text) through the .c-* pairs you choose, and if any token is missing fall back to neutral light defaults. Never invent new tokens; keep usage consistent across components.
        The first attached image is the wireframe. Any images after it are the user's inspiration images, in the same order as the inspiration image URLs below.
        Use the inspiration images to bias choices within the existing styleGuide tokens (e.g., which primary/secondary to emphasize, where accent appears, light vs. dark sections), and place them in the wireframe's image slots by URL, as the system instructions describe.
        Do not derive new colors or fonts from images; do not create tokens that aren’t in styleGuide.
        If an inspiration image is unreachable/invalid, leave it out without degrading output quality.
        On conflicts: the styleGuide always wins over image cues.
        inspiration image URLs: ${imageUrls.length > 0 ? imageUrls.map((url, index) => `${index + 1}. ${url}`).join(', ') : 'none'}
        colors: ${colorsText(guide)}
        typography: ${typographyText(guide)}
        `;

        return streamDesign(request, COST, [
            { type: 'text', text: userPrompt },
            { type: 'image', image: base64Image },
            ...imageParts(imageUrls),
        ])

    } catch (error) {
        return generationFailed('Failed to generate design', error)
    }
}
