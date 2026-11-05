import { describe, expect, it } from "vitest"
import { repairImageSrc, repairImageSrcs } from "./image-src-repair"

const images = [
    "https://example.convex.cloud/api/storage/c659b302-ec94-4edf-b349-883756715fd2",
    "https://example.convex.cloud/api/storage/2c963b29-737d-4367-b27c-fe53c4aaee0e",
]

const collect = async (stream: AsyncIterable<string>) => {
    let text = ""
    for await (const chunk of stream) text += chunk
    return text
}

async function* chunked(text: string, size: number) {
    for (let index = 0; index < text.length; index += size) yield text.slice(index, index + size)
}

describe("image src repair", () => {
    it("restores an address with a dropped character, as the model wrote one", () => {
        expect(repairImageSrc("https://example.convex.cloud/api/storage/c659b302-ec94-4edf-b349-88375671fd2", images)).toBe(images[0])
    })

    it("leaves exact addresses, and ones that aren't the project's images", () => {
        expect(repairImageSrc(images[1], images)).toBe(images[1])
        expect(repairImageSrc("https://images.example.com/photo.jpg", images)).toBe("https://images.example.com/photo.jpg")
    })

    it("repairs addresses in a streamed design, wherever the chunks split them", async () => {
        const broken = `<div><img src="${images[0].replace("715fd2", "71fd2")}" alt="Leaves"><img src="${images[1]}" alt="Pots"></div>`
        const fixed = `<div><img src="${images[0]}" alt="Leaves"><img src="${images[1]}" alt="Pots"></div>`
        for (const size of [1, 3, 7, 50, 1000]) {
            expect(await collect(repairImageSrcs(chunked(broken, size), images))).toBe(fixed)
        }
    })

    it("passes the stream through untouched when the project has no images", async () => {
        expect(await collect(repairImageSrcs(chunked('<img src="x">', 2), []))).toBe('<img src="x">')
    })
})
