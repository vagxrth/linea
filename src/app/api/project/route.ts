import { inngest } from "@/inngest/client";
import { NextRequest, NextResponse } from "next/server";

interface UpdateProjectRequest {
    projectId: string
    shapesData: {
        tool: string
        selected: Record<string, unknown>
        frameCounter: number
    }
    viewportData?: {
        scale: number
        translate: {
            x: number
            y: number
        }
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body: UpdateProjectRequest & { userId?: string } = await request.json()

        const { projectId, shapesData, viewportData, userId } = body

        if (!projectId || !userId || !shapesData) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const eventResult = await inngest.send({
            name: 'project/autosave.requested',
            data: {
                projectId,
                userId,
                shapesData,
                viewportData,
            }
        })

        return NextResponse.json({
            success: true,
            message: 'Project auto-save initiated',
            eventId: eventResult.ids[0],
        })

    } catch (error) {
        return NextResponse.json(
            {
                error: 'Failed to initiate autosave',
                message: error instanceof Error ? error.message : 'Unknown error',
            },
            {
                status: 500,
            }
        )
    }
}