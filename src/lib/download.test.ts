import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { downloadBlob } from "./download"

// The tests run without a browser, so the page is a stand-in with just what the download needs
const link = { href: "", download: "", click: vi.fn() }

beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal("document", { createElement: () => link, body: { appendChild: vi.fn(), removeChild: vi.fn() } })
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe("downloading a file", () => {
    it("clicks a link to the file under its name", () => {
        downloadBlob(new Blob(["frame"]), "frame-1-snapshot.png")

        expect(link.click).toHaveBeenCalled()
        expect(link.download).toBe("frame-1-snapshot.png")
        expect(link.href).toMatch(/^blob:/)
    })

    it("keeps the file's address until the browser has had time to start the download", () => {
        const revoke = vi.spyOn(URL, "revokeObjectURL")

        downloadBlob(new Blob(["frame"]), "frame-1-snapshot.png")

        expect(revoke).not.toHaveBeenCalled()
        vi.advanceTimersByTime(39_999)
        expect(revoke).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1)
        expect(revoke).toHaveBeenCalledWith(link.href)
    })
})
