import type { UnknownAction } from "@reduxjs/toolkit"
import { describe, expect, it } from "vitest"
import reducer, {
    handToolDisable,
    handToolEnable,
    panEnd,
    panMove,
    panStart,
    screenToWorld,
    setScale,
    setTranslate,
    wheelZoom,
    worldToScreen,
    zoomBy,
    zoomToFit,
    type Point,
} from "./index"

type ViewportState = ReturnType<typeof reducer>

// Applies the actions in order, starting from the default view
const run = (actions: UnknownAction[], state: ViewportState = reducer(undefined, { type: "init" })) =>
    actions.reduce(reducer, state)

const worldAt = (state: ViewportState, screen: Point) => screenToWorld(screen, state.translate, state.scale)

// A view that is already panned and zoomed
const panned = run([setTranslate({ x: 40, y: -20 }), setScale({ scale: 1.5 })])

describe("coordinates", () => {
    it("converts between screen and world points both ways", () => {
        const world = { x: 120, y: -35 }
        const screen = worldToScreen(world, panned.translate, panned.scale)
        expect(worldAt(panned, screen)).toEqual(world)
    })
})

describe("zooming", () => {
    it("keeps the drawing under the origin in place", () => {
        const center = { x: 512, y: 384 }
        const before = worldAt(panned, center)

        const zoomed = run([setScale({ scale: 2.5, originScreen: center })], panned)

        expect(zoomed.scale).toBe(2.5)
        const after = worldAt(zoomed, center)
        expect(after.x).toBeCloseTo(before.x)
        expect(after.y).toBeCloseTo(before.y)
    })

    it("keeps the top-left corner in place when no origin is given", () => {
        const zoomed = run([setScale({ scale: 2.5 })], panned)
        expect(zoomed.translate).toEqual(panned.translate)
    })

    it("stays within the zoom limits", () => {
        expect(run([setScale({ scale: 100 })]).scale).toBe(8)
        expect(run([setScale({ scale: 0.001 })]).scale).toBe(0.1)
    })

    it("keeps the drawing under the pointer in place when zooming with the wheel", () => {
        const pointer = { x: 300, y: 200 }
        const before = worldAt(panned, pointer)

        const zoomed = run([wheelZoom({ deltaY: -120, originScreen: pointer })], panned)

        expect(zoomed.scale).toBeGreaterThan(panned.scale)
        const after = worldAt(zoomed, pointer)
        expect(after.x).toBeCloseTo(before.x)
        expect(after.y).toBeCloseTo(before.y)
    })

    it("keeps the origin in place when zooming by a factor, up to the limit", () => {
        const origin = { x: 100, y: 100 }
        const before = worldAt(panned, origin)

        const zoomed = run([zoomBy({ factor: 1000, originScreen: origin })], panned)

        expect(zoomed.scale).toBe(8)
        expect(worldAt(zoomed, origin).x).toBeCloseTo(before.x)
    })

    it("fits a rectangle in the middle of the view", () => {
        const fitted = run([
            zoomToFit({ bounds: { x: 0, y: 0, width: 400, height: 200 }, viewportPx: { width: 1000, height: 800 }, padding: 100 }),
        ])

        expect(fitted.scale).toBe(2)
        // The rectangle's center lands on the view's center
        expect(worldToScreen({ x: 200, y: 100 }, fitted.translate, fitted.scale)).toEqual({ x: 500, y: 400 })
    })
})

describe("panning", () => {
    it("moves the view with the pointer and stops at pan end", () => {
        const moved = run([panStart({ screen: { x: 100, y: 100 } }), panMove({ x: 130, y: 90 })], panned)
        expect(moved.translate).toEqual({ x: 70, y: -30 })

        const ended = run([panEnd(), panMove({ x: 500, y: 500 })], moved)
        expect(ended.mode).toBe("idle")
        expect(ended.translate).toEqual({ x: 70, y: -30 })
    })

    it("ends a Space pan when Space is let go before the mouse button", () => {
        const moved = run(
            [handToolEnable(), panStart({ screen: { x: 100, y: 100 }, mode: "spacePanning" }), panMove({ x: 130, y: 90 })],
            panned
        )
        // Holding Space again and moving the pointer without a click leaves the view where it is
        const state = run([handToolDisable(), handToolEnable(), panMove({ x: 300, y: 300 })], moved)
        expect(state.translate).toEqual({ x: 70, y: -30 })
    })
})
