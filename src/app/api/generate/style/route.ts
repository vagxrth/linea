import { ConsumeCreditsQuery, CreditsBalanceQuery, MoodboardImagesQuery } from "@/convex/query.config";
import { MoodboardImage } from "@/hooks/use-styles";
import { prompts } from "@/prompts";
import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google"
import z from "zod";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";

const ColorSwatchSchema = z.object({
    name: z.string(),
    hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color must be in the format #RRGGBB'),
    description: z.string().optional(),
})

const ColorSectionSchema = z.object({
    title: z.string(),
    swatches: z.array(ColorSwatchSchema).min(2).max(6),
})

const TypographyStyleSchema = z.object({
    name: z.string(),
    fontFamily: z.string(),
    fontSize: z.string(),
    fontWeight: z.string(),
    lineHeight: z.string(),
    letterSpacing: z.string().optional(),
    description: z.string().optional(),
})

const TypographySectionSchema = z.object({
    title: z.string(),
    styles: z.array(TypographyStyleSchema).min(1).max(5),
})

const StyleGuideSchema = z.object({
    theme: z.string(),
    description: z.string(),
    colorSections: z.array(ColorSectionSchema).min(5).max(5),
    typographySections: z.array(TypographySectionSchema).min(3).max(3),
})

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { projectId } = body

        if (!projectId) {
            return NextResponse.json(
                { error: 'Project ID is required' },
                { status: 400 }
            )
        }

        const { ok: balanceOk, balance: balanceAmount } = await CreditsBalanceQuery()

        if (!balanceOk) {
            return NextResponse.json(
                { error: 'Failed to get credits balance' },
                { status: 500 }
            )
        }

        if (balanceAmount === 0) {
            return NextResponse.json(
                { error: 'No credits balance' },
                { status: 400 }
            )
        }

        const moodboardImages = await MoodboardImagesQuery(projectId)

        if (!moodboardImages || moodboardImages.images._valueJSON.length === 0) {
            return NextResponse.json(
                { error: 'No moodboard images' },
                { status: 400 }
            )
        }

        const images = moodboardImages.images._valueJSON as unknown as MoodboardImage[]
        const imageUrls = images.map((img) => img.url).filter(Boolean)

        if (imageUrls.length === 0) {
            return NextResponse.json(
                { error: 'No valid image URLs' },
                { status: 400 }
            )
        }

        const systemPrompt = prompts.styleGuide.system

        const userPrompt = `Analyze these ${imageUrls.length} mood board images and generate a design system:
        Extract colors that work harmoniously together and create typography that matches the aesthetic.
        
        IMPORTANT: Generate exactly 5 color sections with these titles in order:
        1. "Primary Colors" (4 swatches)
        2. "Secondary & Accent Colors" (4 swatches)
        3. "UI Component Colors" (6 swatches)
        4. "Utility & Form Colors" (3 swatches)
        5. "Status & Feedback Colors" (2 swatches)
        
        And exactly 3 typography sections with appropriate titles (e.g., "Headings", "Body", "UI Elements").
        
        Return ONLY the JSON object matching the exact schema structure above.`;

        const result = await generateObject({
            model: google('gemini-2.5-flash'),
            schema: StyleGuideSchema,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: userPrompt,
                        },
                        ...imageUrls.map((url) => ({
                            type: 'image' as const,
                            image: url as string
                        }))
                    ]
                }
            ]
        })
        
        // Validate the structure
        if (!result.object.colorSections || result.object.colorSections.length !== 5) {
            throw new Error('Invalid color sections structure')
        }
        if (!result.object.typographySections || result.object.typographySections.length !== 3) {
            throw new Error('Invalid typography sections structure')
        }

        const { ok, balance } = await ConsumeCreditsQuery({ amount: 1 })

        if (!ok) {
            return NextResponse.json(
                { error: 'Failed to generate style guide' },
                { status: 500 }
            )
        }

        await fetchMutation(
            api.projects.updateProjectStyleGuide,
            {
                projectId: projectId as Id<'projects'>,
                styleGuideData: result.object,
            },
            { token: await convexAuthNextjsToken() }
        )

        return NextResponse.json({
            success: true,
            styleGuide: result.object,
            message: 'Style guide generated successfully',
            balance,
        })

    } catch (error) {
        console.error('Style guide generation error:', error)
        return NextResponse.json({
            error: 'Failed to generate style guide',
            details: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
        }, {
            status: 500,
        })
    }
}