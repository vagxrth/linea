import { describe, expect, it } from "vitest"
import { repairImageSrc } from "./image-src-repair"

const images = [
    "https://example.convex.cloud/api/storage/c659b302-ec94-4edf-b349-883756715fd2",
    "https://example.convex.cloud/api/storage/2c963b29-737d-4367-b27c-fe53c4aaee0e",
]

describe("image src repair", () => {
    it("restores an address with a dropped character, as the model wrote one", () => {
        expect(repairImageSrc("https://example.convex.cloud/api/storage/c659b302-ec94-4edf-b349-88375671fd2", images)).toBe(images[0])
    })

    it("leaves exact addresses, and ones that aren't the project's images", () => {
        expect(repairImageSrc(images[1], images)).toBe(images[1])
        expect(repairImageSrc("https://images.example.com/photo.jpg", images)).toBe("https://images.example.com/photo.jpg")
    })
})
