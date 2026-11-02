import { describe, expect, it } from "vitest"
import { isGradientPlaceholder, projectThumbnail } from "./project-thumbnail"

// What the old createProject stored: a random gradient with a white circle and square on it
const oldGradientThumbnail = (from: string, to: string) => `data:image/svg+xml;base64,${btoa(`
      <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${from}" />
            <stop offset="100%" style="stop-color:${to}" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
        <circle cx="150" cy="100" r="30" fill="white" opacity="0.8" />
        <path d="M140 90 L160 90 L160 110 L140 110 Z" fill="white" opacity="0.6" />
      </svg>
    `)}`

describe("projectThumbnail", () => {
    it("treats the old random gradients as no thumbnail", () => {
        for (const [from, to] of [["#667eea", "#764ba2"], ["#f093fb", "#f5576c"], ["#ffecd2", "#fcb69f"]]) {
            const thumbnail = oldGradientThumbnail(from, to)
            expect(isGradientPlaceholder(thumbnail)).toBe(true)
            expect(projectThumbnail(thumbnail)).toBeNull()
        }
    })

    it("shows real thumbnails, SVG ones included", () => {
        const real = [
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>')}`,
            "https://usable-panda-151.convex.cloud/api/storage/abc",
        ]
        for (const thumbnail of real) expect(projectThumbnail(thumbnail)).toBe(thumbnail)
    })

    it("gives null without a thumbnail, and keeps one it can't decode", () => {
        expect(projectThumbnail(undefined)).toBeNull()
        expect(projectThumbnail(null)).toBeNull()
        expect(projectThumbnail("")).toBeNull()
        expect(projectThumbnail("data:image/svg+xml;base64,%%%not-base64")).toBe("data:image/svg+xml;base64,%%%not-base64")
    })
})
