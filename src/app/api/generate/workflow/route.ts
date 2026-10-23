import { checkCredits } from "@/lib/credits";
import { generationFailed, getInspirationImageUrls, getStyleGuide, imageParts, streamDesign, styleGuideMissing, styleGuideSections } from "@/lib/generation";
import { NextRequest, NextResponse } from "next/server";

// Per page; the client requests four pages
const COST = 1

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { generatedUIId, currentHTML, projectId, pageIndex } = body

        if (
            !generatedUIId ||
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

        const imageUrls = await getInspirationImageUrls(projectId)

        const pageTypes = [
            'Dashboard/Analytics page with charts, metrics, and KPIs',
            'Settings/Configuration page with preferences, settings, and account management',
            'User Profile page with personal information, preferences, and activity',
            'Data Listing/Table page with pagination, seaching, and filtering',
        ]

        const selectedPageType = pageTypes[pageIndex] || pageTypes[0]

        let userPrompt = `You are tasked with creating a workflow page that complements the provided main page design. 

            MAIN PAGE REFERENCE (for design consistency): ${currentHTML}
            WORKFLOW PAGE TO GENERATE: Create a "${selectedPageType}" that would logically complement the main page shown above.
            DYNAMIC PAGE REQUIREMENTS:
                1. Analyze the main page design and determine what type of application this appears to be
                2. Based on that analysis, create a fitting ${selectedPageType} that would make sense in this application context
                3. The page should feel like a natural extension of the main page's functionality
                4. Use your best judgment to determine appropriate content, features, and layout for this page type
            DESIGN CONSISTENCY REQUIREMENTS:
                1. Use the EXACT same visual style, color scheme, and typography as the main page
                2. Maintain identical component styling (buttons, cards, forms, navigation, etc.)
                3. Keep the same overall layout structure and spacing patterns  
                4. Use similar UI patterns and component hierarchy
                5. Ensure the page feels like it belongs to the same application - perfect visual consistency
            TECHNICAL REQUIREMENTS:
                1. Generate clean, semantic HTML with Tailwind CSS classes matching the main page
                2. Copy the main page's <style> block and use the same .c-* color classes as the main page
                3. Include responsive design considerations
                4. Add proper accessibility attributes (aria-labels, semantic HTML)
                5. Create a functional, production-ready page layout
                6. Include realistic content and data that fits the page type and application context
            CONTENT GUIDELINES:
                1. Generate realistic, contextually appropriate content (don't use Lorem Ipsum)
                2. Create functional UI elements appropriate for the page type
                3. Include proper navigation elements if they exist in the main page
                4. Add interactive elements like buttons, forms, tables, etc. as appropriate for the page type

            Please generate a complete, professional HTML page that serves as a ${selectedPageType} while maintaining perfect visual and functional consistency with the main design.`

        userPrompt += styleGuideSections(guide)

        if (imageUrls.length > 0) {
            userPrompt += `\n\nInspiration Images Available: ${imageUrls.length} reference images for visual style and inspiration.`
        }

        userPrompt += `\n\nPlease generate a professional ${selectedPageType} that maintains complete design consistency with the main page while serving its specific functional purpose. Be creative and contextually appropriate.`;

        return streamDesign(request, COST, [
            { type: 'text', text: userPrompt },
            ...imageParts(imageUrls),
        ])
    } catch (error) {
        return generationFailed('Failed to process workflow generation request', error)
    }
}