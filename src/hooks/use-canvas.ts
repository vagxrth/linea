import { Shape } from "@/redux/slice/shapes"
import { panMove, Point } from "@/redux/slice/viewport"
import { AppDispatch, useAppSelector } from "@/redux/store"
import { useEffect, useRef, useState } from "react"
import { useDispatch } from "react-redux"

interface TouchPointer {
    id: number
    p: Point
}

interface DraftShape {
    type: 'frame' | 'rect' | 'ellipse' | 'arrow' | 'line'
    start: Point
    current: Point
}

export const useCanvas = () => {
    const dispatch = useDispatch<AppDispatch>()

    const viewport = useAppSelector((state) => state.viewport)
    const entityState = useAppSelector((state) => state.shapes.shapes)

    const shapeList: Shape[] = entityState.ids
        .map((id: string) => entityState.entities[id])
        .filter((s: Shape | undefined): s is Shape => Boolean(s))

    const currentTool = useAppSelector((state) => state.shapes.tool)
    const selectedShapes = useAppSelector((state) => state.shapes.selected)

    const [sidebarOpen, setSidebarOpen] = useState(false)

    const shapeEntities = useAppSelector((state) => state.shapes.shapes.entities)

    const selectedText = Object.keys(selectedShapes).some((id) => {
        const shape = shapeEntities[id]
        return shape?.type === "text"
    })

    useEffect(() => {
        if (selectedText && !sidebarOpen) {
            setSidebarOpen(true)
        } else if (!selectedText) {
            setSidebarOpen(false)
        }
    }, [selectedText, sidebarOpen])

    const canvasRef = useRef<HTMLDivElement | null>(null)
    const touchMapRef = useRef<Map<number, TouchPointer>>(new Map())

    const draftShapeRef = useRef<DraftShape | null>(null)
    const freeDrawPointRef = useRef<Point[]>([])

    const spacePress = useRef(false)
    const drawingRef = useRef(false)
    const movingRef = useRef(false)
    const moveStartRef = useRef<Point | null>(null)

    const initialShapePositionRef = useRef<
        Record<
            string, {
                x?: number
                y?: number
                points?: Point[]
                startX?: number
                startY?: number
                endX?: number
                endY?: number
            }
        >
    >({})

    const erasingRef = useRef(false)
    const erasedShapeRef = useRef<Set<string>>(new Set())
    const resizingRef = useRef(false)
    const resizingDataRef = useRef<{
        shapeId: string
        corner: string
        initialBounds: { x: number; y: number; w: number; h: number }
        startPoint: { x: number; y: number }
    } | null>(null)


    const lastFreehandFrameRef = useRef(0)
    const freehandRef = useRef<number | null>(null)
    const panRef = useRef<number | null>(null)
    const pendingPanPointRef = useRef<Point | null>(null)

    const [, force] = useState(0);
    const requestRender = (): void => {
        force((n) => (n + 1) | 0)
    }

    const localPointFromClient = (clientX: number, clientY: number): Point => {
        const element = canvasRef.current;
        if (!element) return { x: clientX, y: clientY }
        const r = element.getBoundingClientRect()
        return { x: clientX - r.left, y: clientY - r.top }
    }

    const blurActiveTextInput = () => {
        const activeElement = document.activeElement
        if (activeElement && activeElement.tagName === 'INPUT') {
            (activeElement as HTMLInputElement).blur()
        }
    }

    type withClientXY = { clientX: number; clientY: number }

    const getLocalPoint = (e: withClientXY): Point => localPointFromClient(e.clientX, e.clientY)

    const lineSegmentDistance = (point: Point, lineStart: Point, lineEnd: Point): number => {
        const a = point.x - lineStart.x
        const b = point.y - lineStart.y
        const c = lineEnd.x - lineStart.x
        const d = lineEnd.y - lineStart.y

        const dot = a * c + b * d
        const len_sq = c * c + d * d

        let param = -1
        if (len_sq !== 0) param = dot / len_sq

        let xx, yy;

        if (param < 0) {
            xx = lineStart.x
            yy = lineStart.y
        } else if (param > 1) {
            xx = lineEnd.x
            yy = lineEnd.y
        } else {
            xx = lineStart.x + param * c
            yy = lineStart.y + param * d
        }

        const dx = point.x - xx
        const dy = point.y - yy

        return Math.sqrt(dx * dx + dy * dy)
    }

    const pointInShape = (point: Point, shape: Shape): boolean => {
        switch (shape.type) {
            case 'frame':
            case 'rect':
            case 'ellipse':
            case 'generatedui':
                return (
                    point.x >= shape.x &&
                    point.x <= shape.x + shape.w &&
                    point.y >= shape.y &&
                    point.y <= shape.y + shape.h
                )
            case 'freedraw':
                const threshold = 5
                for (let i = 0; i < shape.points.length - 1; i++) {
                    const p1 = shape.points[i]
                    const p2 = shape.points[i + 1]
                    if (lineSegmentDistance(point, p1, p2) <= threshold) {
                        return true
                    }
                }
                return false
            case 'arrow':
            case 'line':
                const lineThreshold = 8
                return (
                    lineSegmentDistance(
                        point,
                        { x: shape.startX, y: shape.startY },
                        { x: shape.endX, y: shape.endY }
                    ) <= lineThreshold
                )
            case 'text':
                const textWidth = Math.max(shape.text.length * (shape.fontSize * 0.6), 100)
                const textHeight = shape.fontSize * 1.2
                const padding = 8
                return (
                    point.x >= shape.x - 2 &&
                    point.x <= shape.x + textWidth + padding + 2 &&
                    point.y >= shape.y - 2 &&
                    point.y <= shape.y + textHeight + padding + 2
                )
            default:
                return false
        }
    }

    const getShapesAtPoint = (worldPoint: Point): Shape | null => {
        for (let i = shapeList.length - 1; i >= 0; i--) {
            const shape = shapeList[i]
            if (pointInShape(worldPoint, shape)) {
                return shape
            }
        }
        return null
    }

    const schedulePanMove = (p: Point) => {
        pendingPanPointRef.current = p
        if (panRef.current != null) return
        panRef.current = window.requestAnimationFrame(() => {
            panRef.current = null
            const next = pendingPanPointRef.current
            if (next) dispatch(panMove(next))
        })
    }

}