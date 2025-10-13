import { addArrow, addEllipse, addFrame, addFreeDrawShape, addGeneratedUI, addLine, addRect, addText, clearSelection, FrameShape, removeShape, selectShape, setTool, Shape, Tool, updateShape } from "@/redux/slice/shapes"
import { handToolDisable, handToolEnable, panEnd, panMove, panStart, Point, screenToWorld, wheelPan, wheelZoom } from "@/redux/slice/viewport"
import { AppDispatch, useAppDispatch, useAppSelector } from "@/redux/store"
import { nanoid } from "@reduxjs/toolkit"
import { useEffect, useRef, useState } from "react"
import { useDispatch } from "react-redux"
import { toast } from "sonner"

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
            draftShapeRef.current.current = world
            requestRender()
        } else if (currentTool === 'freedraw') {
            freeDrawPointRef.current.push(world)
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

    const onKeyDown = (e: KeyboardEvent): void => {
        if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
            e.preventDefault()
            spacePress.current = true
            dispatch(handToolEnable());
        }
    }

    const onKeyUp = (e: KeyboardEvent): void => {
        if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight')) {
            e.preventDefault()
            spacePress.current = false
            dispatch(handToolDisable());
        }
    }

    useEffect(() => {
        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('keyup', onKeyUp)

        return () => {
            document.removeEventListener('keydown', onKeyDown)
            document.removeEventListener('keyup', onKeyUp)
            if (freehandRef.current) window.cancelAnimationFrame(freehandRef.current)
            if (panRef.current) window.cancelAnimationFrame(panRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const handleResizeStart = (e: CustomEvent) => {
            const { shapeId, corner, bounds } = e.detail
            resizingRef.current = true
            resizingDataRef.current = { shapeId, corner, initialBounds: bounds, startPoint: { x: e.detail.clientX || 0, y: e.detail.clientY || 0 } }
        }

        const handleResizeMove = (e: CustomEvent) => {
            if (!resizingRef.current || !resizingDataRef.current) return
            const { shapeId, corner, initialBounds } = resizingDataRef.current
            const { clientX, clientY } = e.detail

            const canvasElement = canvasRef.current
            if (!canvasElement) return

            const rect = canvasElement.getBoundingClientRect()
            const localX = clientX - rect.left
            const localY = clientY - rect.top

            const world = screenToWorld({ x: localX, y: localY }, viewport.translate, viewport.scale)

            const shape = entityState.entities[shapeId]
            if (!shape) return

            const newBounds = { ...initialBounds }

            switch (corner) {
                case 'nw':
                    newBounds.w = Math.max(10, initialBounds.w + (initialBounds.x - world.x))
                    newBounds.h = Math.max(10, initialBounds.h + (initialBounds.y - world.y))
                    newBounds.x = world.x
                    newBounds.y = world.y
                    break

                case 'ne':
                    newBounds.w = Math.max(10, world.x - initialBounds.x)
                    newBounds.h = Math.max(10, initialBounds.h + (initialBounds.y - world.y))
                    newBounds.y = world.y
                    break

                case 'sw':
                    newBounds.w = Math.max(10, initialBounds.w + (initialBounds.x - world.x))
                    newBounds.h = Math.max(10, world.y - initialBounds.y)
                    newBounds.x = world.x
                    break

                case 'se':
                    newBounds.w = Math.max(10, world.x - initialBounds.x)
                    newBounds.h = Math.max(10, world.y - initialBounds.y)
                    break
            }

            if (
                shape.type === 'frame' ||
                shape.type === 'rect' ||
                shape.type === 'ellipse'
            ) {
                dispatch(updateShape({ id: shapeId, patch: { x: newBounds.x, y: newBounds.y, w: newBounds.w, h: newBounds.h } }))
            } else if (shape.type === 'freedraw') {
                const xs = shape.points.map((p: { x: number; y: number }) => p.x)
                const ys = shape.points.map((p: { x: number; y: number }) => p.y)

                const actualMinX = Math.min(...xs)
                const actualMaxX = Math.max(...xs)
                const actualMinY = Math.min(...ys)
                const actualMaxY = Math.max(...ys)

                const actualWidth = actualMaxX - actualMinX
                const actualHeight = actualMaxY - actualMinY

                const newActualX = newBounds.x + 5
                const newActualY = newBounds.y + 5
                const newActualWidth = Math.max(10, newBounds.w - 10)
                const newActualHeight = Math.max(10, newBounds.h - 10)

                const scaleX = actualWidth > 0 ? newActualWidth / actualWidth : 1
                const scaleY = actualHeight > 0 ? newActualHeight / actualHeight : 1

                const scaledPoints = shape.points.map((point: { x: number; y: number }) => ({
                    x: newActualX + (point.x - actualMinX) * scaleX,
                    y: newActualY + (point.y - actualMinY) * scaleY,
                }))

                dispatch(updateShape({ id: shapeId, patch: { points: scaledPoints } }))
            } else if (shape.type === 'arrow' || shape.type === 'line') {
                const actualMinX = Math.min(shape.startX, shape.endX)
                const actualMaxX = Math.max(shape.startX, shape.endX)
                const actualMinY = Math.min(shape.startY, shape.endY)
                const actualMaxY = Math.max(shape.startY, shape.endY)

                const actualWidth = actualMaxX - actualMinX
                const actualHeight = actualMaxY - actualMinY

                const newActualX = newBounds.x + 5
                const newActualY = newBounds.y + 5
                const newActualWidth = Math.max(10, newBounds.w - 10)
                const newActualHeight = Math.max(10, newBounds.h - 10)

                let newStartX, newStartY, newEndX, newEndY

                if (actualWidth === 0) {
                    newStartX = newActualX + newActualWidth / 2
                    newEndX = newActualX + newActualWidth / 2
                    newStartY = shape.startY < shape.endY ? newActualY : newActualY + newActualHeight
                    newEndY = shape.startY < shape.endY ? newActualY + newActualHeight : newActualY
                } else if (actualHeight === 0) {
                    newStartY = newActualY + newActualHeight / 2
                    newEndY = newActualY + newActualHeight / 2
                    newStartX = shape.startX < shape.endX ? newActualX : newActualX + newActualWidth
                    newEndX = shape.startX < shape.endX ? newActualX + newActualWidth : newActualX
                } else {
                    const scaleX = newActualWidth / actualWidth
                    const scaleY = newActualHeight / actualHeight

                    newStartX = newActualX + (shape.startX - actualMinX) * scaleX
                    newStartY = newActualY + (shape.startY - actualMinY) * scaleY
                    newEndX = newActualX + (shape.endX - actualMinX) * scaleX
                    newEndY = newActualY + (shape.endY - actualMinY) * scaleY
                }

                dispatch(updateShape({ id: shapeId, patch: { startX: newStartX, startY: newStartY, endX: newEndX, endY: newEndY } }))
            }
        }

        const handleResizeEnd = () => {
            resizingRef.current = false
            resizingDataRef.current = null
        }

        window.addEventListener('shape-resize-start', handleResizeStart as EventListener)
        window.addEventListener('shape-resize-move', handleResizeMove as EventListener)
        window.addEventListener('shape-resize-end', handleResizeEnd as EventListener)

        return () => {
            window.removeEventListener('shape-resize-start', handleResizeStart as EventListener)
            window.removeEventListener('shape-resize-move', handleResizeMove as EventListener)
            window.removeEventListener('shape-resize-end', handleResizeEnd as EventListener)
        }
    }, [dispatch, entityState.entities, viewport.translate, viewport.scale])

    const attachCanvasRef = (ref: HTMLDivElement | null): void => {
        if (canvasRef.current) {
            canvasRef.current.removeEventListener('wheel', onWheel)
        }
        canvasRef.current = ref

        if (ref) {
            ref.addEventListener('wheel', onWheel, { passive: false })
        }
    }

    const selectTool = (tool: Tool): void => {
        dispatch(setTool(tool))
    }

    const getDraftShapes = (): DraftShape | null => draftShapeRef.current
    const getFreeDrawPoints = (): ReadonlyArray<Point> => freeDrawPointRef.current

    return {
        viewport,
        shapes: shapeList,
        currentTool,
        selectedShapes,

        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,

        attachCanvasRef,
        selectTool,
        getDraftShapes,
        getFreeDrawPoints,

        sidebarOpen,
        setSidebarOpen,
        selectedText,
    }
}

export const isShapeInsideFrame = (shape: Shape, frame: FrameShape): boolean => {
    const frameLeft = frame.x
    const frameTop = frame.y
    const frameRight = frame.x + frame.w
    const frameBottom = frame.y + frame.h

    switch (shape.type) {
        case 'rect':
        case 'ellipse':
        case 'frame':
            const centerX = shape.x + shape.w / 2
            const centerY = shape.y + shape.h / 2

            return (
                centerX >= frameLeft &&
                centerX <= frameRight &&
                centerY >= frameTop &&
                centerY <= frameBottom
            )

        case 'text':
            return (
                shape.x >= frameLeft &&
                shape.x <= frameRight &&
                shape.y >= frameTop &&
                shape.y <= frameBottom
            )

        case 'freedraw':
            return shape.points.some(
                (point) =>
                    point.x >= frameLeft &&
                    point.x <= frameRight &&
                    point.y >= frameTop &&
                    point.y <= frameBottom
            )

        case 'line':
        case 'arrow':
            const startInside =
                shape.startX >= frameLeft &&
                shape.startX <= frameRight &&
                shape.startY >= frameTop &&
                shape.startY <= frameBottom

            const endInside =
                shape.endX >= frameLeft &&
                shape.endX <= frameRight &&
                shape.endY >= frameTop &&
                shape.endY <= frameBottom

            return startInside || endInside

        default:
            return false
    }
}

export const getShapesInsideFrame = (shapes: Shape[], frame: FrameShape): Shape[] => {
    const shapesInFrame = shapes.filter((shape) => shape.id !== frame.id && isShapeInsideFrame(shape, frame))
    return shapesInFrame
}

const renderShapeOnCanvas = (ctx: CanvasRenderingContext2D, shape: Shape, frameX: number, frameY: number) => {
    ctx.save()
    switch (shape.type) {
        case 'rect':
        case 'ellipse':
        case 'frame':
            const relativeX = shape.x - frameX
            const relativeY = shape.y - frameY

            if (shape.type === 'rect' || shape.type === 'frame') {
                ctx.strokeStyle = shape.stroke && shape.stroke !== 'transparent' ? shape.stroke : '#ffffff'
                ctx.lineWidth = shape.strokeWidth || 2

                const borderRadius = shape.type === 'rect' ? 8 : 0;

                ctx.beginPath()
                ctx.roundRect(relativeX, relativeY, shape.w, shape.h, borderRadius)
                ctx.stroke()
            } else if (shape.type === 'ellipse') {
                ctx.strokeStyle = shape.stroke && shape.stroke !== 'transparent' ? shape.stroke : '#ffffff'
                ctx.lineWidth = shape.strokeWidth || 2
                ctx.beginPath()
                ctx.ellipse(
                    relativeX + shape.w / 2,
                    relativeY + shape.h / 2,
                    shape.w / 2,
                    shape.h / 2,
                    0,
                    0,
                    2 * Math.PI
                )
                ctx.stroke()
            }
            break

        case 'text':
            const textRelativeX = shape.x - frameX
            const textRelativeY = shape.y - frameY
            ctx.fillStyle = shape.fill || '#ffffff'
            ctx.font = `${shape.fontSize}px ${shape.fontFamily || 'Inter, sans-serif'}`
            ctx.textBaseline = 'top'
            ctx.fillText(shape.text, textRelativeX, textRelativeY)
            break

        case 'freedraw':
            if (shape.points.length > 1) {
                ctx.strokeStyle = shape.stroke || '#ffffff'
                ctx.lineWidth = shape.strokeWidth || 2
                ctx.lineCap = 'round'
                ctx.lineJoin = 'round'
                ctx.beginPath()
                const firstPoint = shape.points[0]
                ctx.moveTo(firstPoint.x - frameX, firstPoint.y - frameY)
                for (let i = 1; i < shape.points.length; i++) {
                    const point = shape.points[i]
                    ctx.lineTo(point.x - frameX, point.y - frameY)
                }
                ctx.stroke()
            }
            break

        case 'line':
            ctx.strokeStyle = shape.stroke || '#ffffff'
            ctx.lineWidth = shape.strokeWidth || 2
            ctx.beginPath()
            ctx.moveTo(shape.startX - frameX, shape.startY - frameY)
            ctx.lineTo(shape.endX - frameX, shape.endY - frameY)
            ctx.stroke()
            break

        case 'arrow':
            ctx.strokeStyle = shape.stroke || '#ffffff'
            ctx.lineWidth = shape.strokeWidth || 2
            ctx.beginPath()
            ctx.moveTo(shape.startX - frameX, shape.startY - frameY)
            ctx.lineTo(shape.endX - frameX, shape.endY - frameY)
            ctx.stroke()

            const headLength = 10
            const angle = Math.atan2(shape.endY - shape.startY, shape.endX - shape.startX)
            ctx.fillStyle = shape.stroke || '#ffffff'
            ctx.beginPath()
            ctx.moveTo(shape.endX - frameX, shape.endY - frameY)
            ctx.lineTo(
                shape.endX - frameX - headLength * Math.cos(angle - Math.PI / 6),
                shape.endY - frameY - headLength * Math.sin(angle - Math.PI / 6)
            )
            ctx.lineTo(
                shape.endX - frameX - headLength * Math.cos(angle - Math.PI / 6),
                shape.endY - frameY - headLength * Math.sin(angle - Math.PI / 6)
            )
            ctx.closePath()
            ctx.fill()
            break
    }
    ctx.restore()
}

const generateFrameSnapshot = async (frame: FrameShape, allShapes: Shape[]): Promise<Blob> => {
    const shapesInFrame = getShapesInsideFrame(allShapes, frame)
    const canvas = document.createElement('canvas')
    canvas.width = frame.w
    canvas.height = frame.h

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get canvas context')

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, canvas.width, canvas.height)
    ctx.clip()

    shapesInFrame.forEach((shape) => {
        renderShapeOnCanvas(ctx, shape, frame.x, frame.y)
    })
    ctx.restore()

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Failed to create blob'))
            }
        }, 'image/png', 1.0)
    })
}

const downloadBlob = (blob: Blob, fileName: string): void => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export const useFrame = (shape: FrameShape) => {
    const dispatch = useAppDispatch();

    const [isGenerating, setIsGenerating] = useState(false)

    const allShapes = useAppSelector((state) =>
        Object.values(state.shapes.shapes?.entities || {}).filter((shape): shape is Shape => shape !== undefined)
    )

    const handleGenerateDesign = async () => {
        try {
            setIsGenerating(true)
            const snapshot = await generateFrameSnapshot(shape, allShapes)
            downloadBlob(snapshot, `frame-${shape.frameNumber}-snapshot.png`)

            const formData = new FormData()
            formData.append('image', snapshot, `frame-${shape.frameNumber}.png`)
            formData.append('frameNumber', shape.frameNumber.toString())

            const urlParams = new URLSearchParams(window.location.search)
            const projectId = urlParams.get('project')
            if (projectId) {
                formData.append('projectId', projectId)
            }

            const response = await fetch('/api/generate', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`API Request Failed: ${errorText}`)
            }

            const generatedUIPosition = {
                x: shape.x + shape.w + 50,
                y: shape.y,
                w: Math.max(400, shape.w),
                h: Math.max(300, shape.h),
            }

            const generatedUIId = nanoid()
            dispatch(
                addGeneratedUI({
                    ...generatedUIPosition,
                    id: generatedUIId,
                    uiSpecData: null,
                    sourceFrameId: shape.id,
                })
            )

            const reader = response.body?.getReader()
            const decoder = new TextDecoder()

            let accumulatedMarkup = ''
            let lastUpdateTime = 0

            const UPDATE_THROTTLE_MS = 200

            if (reader) {
                try {
                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) {
                            dispatch(
                                updateShape({
                                    id: generatedUIId,
                                    patch: {
                                        uiSpecData: accumulatedMarkup,
                                    }
                                })
                            )
                            break
                        }
                        const chunk = decoder.decode(value)
                        accumulatedMarkup += chunk

                        const now = Date.now()
                        if (now - lastUpdateTime >= UPDATE_THROTTLE_MS) {
                            dispatch(
                                updateShape({
                                    id: generatedUIId,
                                    patch: {
                                        uiSpecData: accumulatedMarkup,
                                    }
                                })
                            )
                            lastUpdateTime = now
                        }
                    }
                } finally {
                    reader.releaseLock()
                }
            }
        } catch (error) {
            toast.error(`Failed to generate design: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
            setIsGenerating(false)
        }
    }

    return {
        isGenerating,
        handleGenerateDesign,
    }
}

export const useInspiration = () => {
    const [isInspirationOpen, setIsInspirationOpen] = useState(false)

    const toggleInspiration = () => {
        setIsInspirationOpen(!isInspirationOpen)
    }

    const openInspiration = () => {
        setIsInspirationOpen(true)
    }

    const closeInspiration = () => {
        setIsInspirationOpen(false)
    }

    return {
        isInspirationOpen,
        toggleInspiration,
        openInspiration,
        closeInspiration,
    }
    
}