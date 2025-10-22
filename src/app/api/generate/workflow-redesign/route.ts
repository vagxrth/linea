/* eslint-disable @typescript-eslint/no-explicit-any */

import { ConsumeCreditsQuery, CreditsBalanceQuery, StyleGuideQuery } from "@/convex/query.config";
import { prompts } from "@/prompts";
import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { userMessage, generatedUIId, currentHTML, projectId } = body

        if (!userMessage || !generatedUIId || !currentHTML || !projectId) {
            return NextResponse.json(
                { error: 'Invalid request body' },
                { status: 400 }
            )
        }

        const { ok: balanceOk, balance: balanceAmount } = await CreditsBalanceQuery()

        if (!balanceOk || balanceAmount === 0) {
            return NextResponse.json(
                { error: 'No credits available' },
                { status: 400 }
            )
        }

        const { ok } = await ConsumeCreditsQuery({ amount: 4 })
        if (!ok) {
            return NextResponse.json(
                { error: 'Failed to consume credits' },
                { status: 400 }
            )
        }

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
                    details: 'Please generate a style guide first before redesigning workflow. Go to the Style Guide tab and create one from your moodboard images.' 
                },
                { status: 400 }
            )
        }

        let userPrompt = `CRITICAL: You are redesigning a SPECIFIC WORKFLOW PAGE, not creating a new page from scratch.
            USER REQUEST: "${userMessage}"
            CURRENT WORKFLOW PAGE HTML TO REDESIGN: ${currentHTML}
            WORKFLOW REDESIGN REQUIREMENTS:
                1. MODIFY THE PROVIDED HTML ABOVE - do not create a completely new page
                2. Apply the user's requested changes to the existing workflow page design
                3. Keep the same page type and core functionality (Dashboard, Settings, Profile, or Listing)
                4. Maintain the existing layout structure and component hierarchy
                5. Preserve all functional elements while applying visual/content changes
                6. Keep the same general organization and workflow purpose
            MODIFICATION GUIDELINES:
                1. Start with the provided HTML structure as your base
                2. Apply the requested changes (colors, layout, content, styling, etc.)
                3. Keep all existing IDs and semantic structure intact
                4. Maintain shadcn/ui component patterns and classes
                5. Preserve responsive design and accessibility features
                6. Update content, styling, or layout as requested but keep core structure

            IMPORTANT: 
                1. DO NOT generate a completely different page
                2. DO NOT revert to any "original" or "main" page design
                3. DO redesign the specific workflow page shown in the HTML above
                4. DO apply the user's changes to that specific page

            colors: ${styleGuideData.colorSections
                .map((color: any) =>
                    color.swatches
                        .map((swatch: any) => {
                            return `${swatch.name}: ${swatch.hexColor}, ${swatch.description}`;
                        })
                        .join(", ")
                )
                .join(", ")}

            typography: ${styleGuideData.typographySections
                .map((typography: any) =>
                    typography.styles
                        .map((style: any) => {
                            return `${style.name}: ${style.description}, ${style.fontFamily}, ${style.fontWeight}, ${style.fontSize}, ${style.lineHeight}`;
                        })
                        .join(", ")
                )
                .join(", ")}

            Please generate the modified version of the provided workflow page HTML with the requested changes applied.`

        userPrompt += `\n\nPlease generate a professional redesigned workflow page that incorporates the requested changes while maintaining the core functionality and design consistency.`

        const result = streamText({
            model: google('gemini-2.5-flash'),
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: userPrompt,
                        }
                    ]
                }
            ],
            system: prompts.generatedUi.system,
            temperature: 0.7,
        })

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result.textStream) {
                        const encoder = new TextEncoder()
                        controller.enqueue(encoder.encode(chunk))
                    }
                    controller.close()
                } catch (error) {
                    controller.error(error)
                }
            }
        })

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            }
        })

    } catch (error) {
        console.error('Workflow redesign failed: ', error)
        return NextResponse.json(
            { error: 'Failed to process workflow redesign request', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}