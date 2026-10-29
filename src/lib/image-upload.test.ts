import { describe, expect, it } from "vitest"
import { IMAGE_ACCEPT, imageProblem, MAX_IMAGE_BYTES } from "./image-upload"

describe("imageProblem", () => {
    it("accepts PNG, JPEG and WebP images up to 2 MB", () => {
        for (const type of ["image/png", "image/jpeg", "image/webp"]) {
            expect(imageProblem(type, 1)).toBeNull()
            expect(imageProblem(type, MAX_IMAGE_BYTES)).toBeNull()
        }
        expect(IMAGE_ACCEPT).toBe("image/png,image/jpeg,image/webp")
    })

    it("refuses other types, including images Gemini or browsers can't use", () => {
        for (const type of ["image/gif", "image/svg+xml", "image/heic", "image/avif", "application/pdf", "", undefined]) {
            expect(imageProblem(type, 1)).toBe("isn't a PNG, JPEG or WebP image")
        }
    })

    it("refuses images over 2 MB", () => {
        expect(imageProblem("image/png", MAX_IMAGE_BYTES + 1)).toBe("is over 2 MB. Use a smaller image.")
    })
})
