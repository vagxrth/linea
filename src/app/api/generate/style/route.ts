import { CreditsBalanceQuery, MoodboardImagesQuery } from "@/convex/query.config";
import { MoodboardImage } from "@/hooks/use-styles";
import { prompts } from "@/prompts";
import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google"
import z from "zod";

const ColorSwatchSchema = z.object({
    name: z.string(),
    hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Hex color must be in the format #RRGGBB'),
    description: z.string().optional(),
})

const PrimaryColorsSchema = z.object({
    title: z.literal('Primary Colors'),
    swatches: z.array(ColorSwatchSchema).length(4),
})

const SecondaryColorsSchema = z.object({
    title: z.literal('Secondary & Accent Colors'),
    swatches: z.array(ColorSwatchSchema).length(4),
})

const UIComponentColorsSchema = z.object({
    title: z.literal('UI Component Colors'),
    swatches: z.array(ColorSwatchSchema).length(6),
})

const UtilityColorsSchema = z.object({
    title: z.literal('Utility & Form Colors'),
    swatches: z.array(ColorSwatchSchema).length(3),
})

const StatusColorsSchema = z.object({
    title: z.literal('Status & Feedback Colors'),
    swatches: z.array(ColorSwatchSchema).length(2),
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
    styles: z.array(TypographyStyleSchema),
})

const StyleGuideSchema = z.object({
    theme: z.string(),
    description: z.string(),
    colorSection: z.tuple([
        PrimaryColorsSchema,
        SecondaryColorsSchema,
        UIComponentColorsSchema,
        UtilityColorsSchema,
        StatusColorsSchema,
    ]),
    typographySections: z.array(TypographySectionSchema).length(3),
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

        const systemPrompt = prompts.styleGuide.system

        const userPrompt = `Analyze these ${imageUrls.length} mood board images and generate a design system:
        Extract colors that work harmoniously together and create typography that matches the aesthetic. 
        Return ONLY the JSON object matching the exact schema structure above.`;

        const result = await generateObject({
            model: google('gemini-2.0-flash'),
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

    } catch (error) {

    }
}