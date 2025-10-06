import { addArrow, addEllipse, addFrame, addFreeDrawShape, addLine, addRect, addText, clearSelection, removeShape, selectShape, setTool, Shape, updateShape } from "@/redux/slice/shapes"
import { panEnd, panMove, panStart, Point, screenToWorld, wheelPan, wheelZoom } from "@/redux/slice/viewport"
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

const INTERVAL_MS = 8

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

    const freehandTick = (): void => {
        const now = performance.now()

        if (now - lastFreehandFrameRef.current >= INTERVAL_MS) {
            if (freeDrawPointRef.current.length > 0) requestRender()
            lastFreehandFrameRef.current = now
        }

        if (drawingRef.current) {
            freehandRef.current = window.requestAnimationFrame(freehandTick)
        }
    }

    const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        const originScreen = localPointFromClient(e.clientX, e.clientY)
        if (e.ctrlKey || e.metaKey) {
            dispatch(wheelZoom({ deltaY: e.deltaY, originScreen }))
        } else {
            const dx = e.shiftKey ? e.deltaY : e.deltaX
            const dy = e.shiftKey ? 0 : e.deltaY
            dispatch(wheelPan({ dx: -dx, dy: -dy }))
        }
    }

    const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
        const target = e.target as HTMLElement
        const isButton = target.tagName === 'BUTTON' || target.closest('button') || target.classList.contains('pointer-events-auto') || target.closest('.pointer-events-auto')

        if (!isButton) {
            e.preventDefault()
        } else {
            console.log('Clicked on interactive element: ', target)
            return
        }

        const local = getLocalPoint(e.nativeEvent)
        const world = screenToWorld(local, viewport.translate, viewport.scale)

        if (touchMapRef.current.size <= 1) {
            canvasRef.current?.setPointerCapture?.(e.pointerId)
            const isPanButton = e.button === 1 || e.button === 2
            const panByShift = spacePress.current && e.button === 0

            if (isPanButton || panByShift) {
                const mode = spacePress.current ? 'shiftPanning' : 'panning'
                dispatch(panStart({ screen: local, mode }))
                return
            }

            if (e.button === 0) {
                if (currentTool === 'select') {
                    const hitShape = getShapesAtPoint(world)
                    if (hitShape) {
                        const isSelected = selectedShapes[hitShape.id]
                        if (!isSelected) {
                            if (!e.shiftKey) dispatch(clearSelection())
                            dispatch(selectShape(hitShape.id))
                        }
                        movingRef.current = true
                        moveStartRef.current = world

                        initialShapePositionRef.current = {}
                        Object.keys(selectedShapes).forEach((id) => {
                            const shape = entityState.entities[id]
                            if (shape) {
                                if (
                                    shape.type === 'frame' ||
                                    shape.type === 'rect' ||
                                    shape.type === 'ellipse' ||
                                    shape.type === 'generatedui'
                                ) {
                                    initialShapePositionRef.current[id] = {
                                        x: shape.x,
                                        y: shape.y,
                                    }
                                } else if (shape.type === 'freedraw') {
                                    initialShapePositionRef.current[id] = {
                                        points: [...shape.points],
                                    }
                                } else if (shape.type === 'arrow' || shape.type === 'line') {
                                    initialShapePositionRef.current[id] = {
                                        startX: shape.startX,
                                        startY: shape.startY,
                                        endX: shape.endX,
                                        endY: shape.endY,
                                    }
                                } else if (shape.type === 'text') {
                                    initialShapePositionRef.current[id] = {
                                        x: shape.x,
                                        y: shape.y,
                                    }
                                }
                            }
                        })
                        if (
                            hitShape.type === 'frame' ||
                            hitShape.type === 'rect' ||
                            hitShape.type === 'ellipse' ||
                            hitShape.type === 'generatedui'
                        ) {
                            initialShapePositionRef.current[hitShape.id] = {
                                x: hitShape.x,
                                y: hitShape.y,
                            }
                        } else if (hitShape.type === 'freedraw') {
                            initialShapePositionRef.current[hitShape.id] = {
                                points: [...hitShape.points],
                            }
                        } else if (hitShape.type === 'arrow' || hitShape.type === 'line') {
                            initialShapePositionRef.current[hitShape.id] = {
                                startX: hitShape.startX,
                                startY: hitShape.startY,
                                endX: hitShape.endX,
                                endY: hitShape.endY,
                            }
                        } else if (hitShape.type === 'text') {
                            initialShapePositionRef.current[hitShape.id] = {
                                x: hitShape.x,
                                y: hitShape.y,
                            }
                        }
                    } else {
                        if (!e.shiftKey) {
                            dispatch(clearSelection())
                            blurActiveTextInput()
                        }
                    }
                } else if (currentTool === 'eraser') {
                    erasingRef.current = true
                    erasedShapeRef.current.clear()
                    const hitShape = getShapesAtPoint(world)
                    if (hitShape) {
                        dispatch(removeShape(hitShape.id))
                        erasedShapeRef.current.add(hitShape.id)
                    } else {
                        blurActiveTextInput()
                    }
                } else if (currentTool === 'text') {
                    dispatch(addText({ x: world.x, y: world.y }))
                    dispatch(setTool('select'))
                } else {
                    drawingRef.current = true
                    if (
                        currentTool === 'frame' ||
                        currentTool === 'rect' ||
                        currentTool === 'ellipse' ||
                        currentTool === 'arrow' ||
                        currentTool === 'line'
                    ) {
                        console.log('Starting to draw: ', currentTool, 'at: ', world)
                        draftShapeRef.current = {
                            type: currentTool,
                            start: world,
                            current: world,
                        }
                        requestRender()
                    } else if (currentTool === 'freedraw') {
                        freeDrawPointRef.current = [world]
                        lastFreehandFrameRef.current = performance.now()
                        freehandRef.current = window.requestAnimationFrame(freehandTick)
                        requestRender()
                    }
                }
            }
        }
    }

    const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
        const local = getLocalPoint(e.nativeEvent)
        const world = screenToWorld(local, viewport.translate, viewport.scale)

        if (viewport.mode === 'panning' || viewport.mode === 'shiftPanning') {
            schedulePanMove(local)
            return
        }

        if (erasingRef.current && currentTool === 'eraser') {
            const hitShape = getShapesAtPoint(world)
            if (hitShape && !erasedShapeRef.current.has(hitShape.id)) {
                dispatch(removeShape(hitShape.id))
                erasedShapeRef.current.add(hitShape.id)
            }
        }

        if (
            movingRef.current &&
            moveStartRef.current &&
            currentTool === 'select'
        ) {
            const deltaX = world.x - moveStartRef.current.x
            const deltaY = world.y - moveStartRef.current.y

            Object.keys(initialShapePositionRef.current).forEach((id) => {
                const initialPostion = initialShapePositionRef.current[id]
                const shape = entityState.entities[id]

                if (shape && initialPostion) {
                    if (
                        shape.type === 'frame' ||
                        shape.type === 'rect' ||
                        shape.type === 'ellipse' ||
                        shape.type === 'text' ||
                        shape.type === 'generatedui'
                    ) {
                        if (
                            typeof initialPostion.x === 'number' &&
                            typeof initialPostion.y === 'number'
                        ) {
                            dispatch(
                                updateShape({
                                    id,
                                    patch: {
                                        x: initialPostion.x + deltaX,
                                        y: initialPostion.y + deltaY,
                                    }
                                })
                            )
                        }
                    } else if (shape.type === 'freedraw') {
                        const initialPoints = initialPostion.points
                        if (initialPoints) {
                            const newPoints = initialPoints.map((point) => ({
                                x: point.x + deltaX,
                                y: point.y + deltaY,
                            }))
                            dispatch(
                                updateShape({
                                    id,
                                    patch: {
                                        points: newPoints,
                                    }
                                })
                            )
                        }
                    } else if (shape.type === 'arrow' || shape.type === 'line') {
                        if (
                            typeof initialPostion.startX === 'number' &&
                            typeof initialPostion.startY === 'number' &&
                            typeof initialPostion.endX === 'number' &&
                            typeof initialPostion.endY === 'number'
                        ) {
                            dispatch(
                                updateShape({
                                    id,
                                    patch: {
                                        startX: initialPostion.startX + deltaX,
                                        startY: initialPostion.startY + deltaY,
                                        endX: initialPostion.endX + deltaX,
                                        endY: initialPostion.endY + deltaY,
                                    }
                                })
                            )
                        }
                    }
                }
            })
        }
        if (draftShapeRef.current) {
            if (draftShapeRef.current) {
                draftShapeRef.current.current = world
                requestRender()
            } else if (currentTool === 'freedraw') {
                freeDrawPointRef.current.push(world)
            }
        }
    }

    const finalizeDrawing = (): void => {
        if (!drawingRef.current) return
        drawingRef.current = false

        if (freehandRef.current) {
            window.cancelAnimationFrame(freehandRef.current)
            freehandRef.current = null
        }

        const draft = draftShapeRef.current
        if (draft) {
            const x = Math.min(draft.start.x, draft.current.x)
            const y = Math.min(draft.start.y, draft.current.y)
            const w = Math.abs(draft.current.x - draft.start.x)
            const h = Math.abs(draft.current.y - draft.start.y)

            if (w > 1 && h > 1) {
                if (draft.type === 'frame') {
                    dispatch(addFrame({ x, y, w, h }))
                } else if (draft.type === 'rect') {
                    dispatch(addRect({ x, y, w, h }))
                } else if (draft.type === 'ellipse') {
                    dispatch(addEllipse({ x, y, w, h }))
                } else if (draft.type === 'arrow') {
                    dispatch(
                        addArrow({
                            startX: draft.start.x,
                            startY: draft.start.y,
                            endX: draft.current.x,
                            endY: draft.current.y,
                        })
                    )
                } else if (draft.type === 'line') {
                    dispatch(addLine({
                        startX: draft.start.x,
                        startY: draft.start.y,
                        endX: draft.current.x,
                        endY: draft.current.y,
                    }))
                }
            }
            draftShapeRef.current = null
        } else if (currentTool === 'freedraw') {
            const points = freeDrawPointRef.current
            if (points.length > 0) {
                dispatch(addFreeDrawShape({ points: points }))
            }
            freeDrawPointRef.current = []
        }
        requestRender()
    }

    const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
        canvasRef.current?.releasePointerCapture?.(e.pointerId)

        if (viewport.mode === 'panning' || viewport.mode === 'shiftPanning') {
            dispatch(panEnd())
        }

        if (movingRef.current) {
            movingRef.current = false
            moveStartRef.current = null
            initialShapePositionRef.current = {}
        }

        if (erasingRef.current) {
            erasingRef.current = false
            erasedShapeRef.current.clear()
        }

        finalizeDrawing()
    }

    const onPointerCancel: React.PointerEventHandler<HTMLDivElement> = (e) => {
        onPointerUp(e)
    }
}