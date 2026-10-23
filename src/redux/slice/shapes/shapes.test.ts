import type { EntityState, UnknownAction } from "@reduxjs/toolkit"
import { describe, expect, it } from "vitest"
import reducer, {
    addFrame,
    addFreeDrawShape,
    addRect,
    clearSelection,
    deleteSelected,
    loadProject,
    recordHistory,
    redo,
    removeShape,
    selectAll,
    selectShape,
    setSelection,
    setTool,
    undo,
    updateShape,
    updateShapes,
    type Shape,
    type ShapesState,
} from "./index"

// Applies the actions in order, starting from an empty canvas or from `state`
const run = (actions: UnknownAction[], state: ShapesState = reducer(undefined, { type: "init" })) =>
    actions.reduce(reducer, state)

const ids = (state: ShapesState) => state.shapes.ids as string[]
const frameLabels = (state: ShapesState) =>
    Object.values(state.shapes.entities).flatMap((shape) => (shape?.type === "frame" ? [shape.frameNumber] : []))
const frameId = (state: ShapesState, frameNumber: number) =>
    ids(state).find((id) => {
        const shape = state.shapes.entities[id]
        return shape?.type === "frame" && shape.frameNumber === frameNumber
    })!

const frame = { x: 0, y: 0, w: 100, h: 80 }
const rect = { x: 10, y: 10, w: 40, h: 30 }

describe("frame numbers", () => {
    it("numbers new frames 1, 2, 3", () => {
        const state = run([addFrame(frame), addFrame(frame), addFrame(frame)])
        expect(frameLabels(state)).toEqual([1, 2, 3])
    })

    it("doesn't reuse a number after a frame is erased", () => {
        const three = run([addFrame(frame), addFrame(frame), addFrame(frame)])
        const state = run([removeShape(frameId(three, 1)), addFrame(frame)], three)
        expect(frameLabels(state)).toEqual([2, 3, 4])
    })

    it("doesn't reuse a number after frames are deleted with the Delete key", () => {
        const three = run([addFrame(frame), addFrame(frame), addFrame(frame)])
        const state = run([selectShape(frameId(three, 3)), deleteSelected(), addFrame(frame)], three)
        expect(frameLabels(state)).toEqual([1, 2, 4])
    })

    it("raises a saved project's counter to its highest frame number", () => {
        // A project saved while erasing a frame lowered the counter: Frames 2 and 3, counter 2
        const saved = run([addFrame(frame), addFrame(frame), addFrame(frame)])
        const shapes = run([removeShape(frameId(saved, 1))], saved).shapes
        const state = run([loadProject({ shapes, frameCounter: 2 }), addFrame(frame)])
        expect(frameLabels(state)).toEqual([2, 3, 4])
    })

    it("puts the counter back when undoing a new frame", () => {
        const state = run([addFrame(frame), addFrame(frame), undo(), addFrame(frame)])
        expect(frameLabels(state)).toEqual([1, 2])
    })
})

describe("undo and redo", () => {
    it("undoes the last shape and redoes it", () => {
        const added = run([addRect(rect), addRect(rect)])
        const undone = run([undo()], added)
        expect(ids(undone)).toEqual(ids(added).slice(0, 1))
        expect(ids(run([redo()], undone))).toEqual(ids(added))
    })

    it("adds no undo step for an update marked skipHistory", () => {
        const added = run([addRect(rect)])
        const id = ids(added)[0]
        const state = run([updateShape({ id, patch: { x: 50 }, skipHistory: true })], added)
        expect(state.past).toHaveLength(added.past.length)
    })

    it("undoes a whole drag in one step", () => {
        const added = run([addRect(rect), addRect({ ...rect, x: 100 })])
        const [a, b] = ids(added)
        // A drag records one step when it starts, then moves without history
        const dragged = run(
            [
                recordHistory(),
                updateShapes({ updates: [{ id: a, changes: { x: 20 } }, { id: b, changes: { x: 110 } }], skipHistory: true }),
                updateShapes({ updates: [{ id: a, changes: { x: 30 } }, { id: b, changes: { x: 120 } }], skipHistory: true }),
            ],
            added
        )
        const undone = run([undo()], dragged)
        expect(undone.shapes.entities[a]).toMatchObject({ x: 10 })
        expect(undone.shapes.entities[b]).toMatchObject({ x: 100 })
    })

    it("deletes several selected shapes in one step, and undo brings them all back", () => {
        const added = run([addRect(rect), addRect(rect), addRect(rect)])
        const deleted = run([selectAll(), deleteSelected()], added)
        expect(ids(deleted)).toEqual([])
        expect(ids(run([undo()], deleted))).toEqual(ids(added))
    })

    it("clears redo when a new edit is made", () => {
        const state = run([addRect(rect), undo(), addRect(rect)])
        expect(state.future).toEqual([])
    })

    it("keeps at most 100 undo steps", () => {
        const state = run(Array.from({ length: 105 }, () => addRect(rect)))
        expect(state.past).toHaveLength(100)
        const undoneAll = run(Array.from({ length: 105 }, () => undo()), state)
        expect(ids(undoneAll)).toHaveLength(5)
    })
})

describe("pencil strokes", () => {
    it("doesn't keep a click that didn't move, or add an undo step for it", () => {
        const state = run([addFreeDrawShape({ points: [{ x: 5, y: 5 }] })])
        expect(ids(state)).toEqual([])
        expect(state.past).toEqual([])
    })

    it("keeps a stroke that moved", () => {
        const state = run([addFreeDrawShape({ points: [{ x: 0, y: 0 }, { x: 10, y: 5 }] })])
        expect(ids(state)).toHaveLength(1)
    })

    it("drops clicks a project saved before, and leaves the saved data as it was", () => {
        const stroke = (id: string, points: { x: number; y: number }[]): Shape =>
            ({ id, type: "freedraw", points, stroke: "#fff", strokeWidth: 2, fill: null }) as Shape
        const shapes: EntityState<Shape, string> = {
            ids: ["click", "line"],
            entities: { click: stroke("click", [{ x: 1, y: 1 }]), line: stroke("line", [{ x: 0, y: 0 }, { x: 9, y: 9 }]) },
        }

        const state = run([loadProject({ shapes, frameCounter: 0 })])

        expect(ids(state)).toEqual(["line"])
        expect(shapes.ids).toEqual(["click", "line"])
    })
})

describe("opening a project", () => {
    it("starts with the select tool and nothing selected, even when an older save stored them", () => {
        const saved = run([addRect(rect)])
        // Projects saved before autosave stopped storing the tool and selection still hold them
        const olderSave = { shapes: saved.shapes, frameCounter: 0, tool: "eraser" as const, selected: { [ids(saved)[0]]: true as const } }

        const state = run([setTool("rect"), loadProject(olderSave)])

        expect(state.tool).toBe("select")
        expect(state.selected).toEqual({})
        expect(ids(state)).toEqual(ids(saved))
    })
})

describe("selection", () => {
    it("selects every shape, replaces the selection, and clears it", () => {
        const added = run([addRect(rect), addRect(rect)])
        const [a, b] = ids(added)
        expect(run([selectAll()], added).selected).toEqual({ [a]: true, [b]: true })
        expect(run([selectAll(), setSelection([b])], added).selected).toEqual({ [b]: true })
        expect(run([selectAll(), clearSelection()], added).selected).toEqual({})
    })

    it("clears the selection when a drawing tool is picked", () => {
        const selected = run([addRect(rect), selectAll()])
        expect(run([setTool("rect")], selected).selected).toEqual({})
        expect(run([setTool("select")], selected).selected).toEqual(selected.selected)
    })
})
