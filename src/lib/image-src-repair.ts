// The model copies the project's image addresses into the designs it writes, and now and then drops or
// swaps a character of their long ids, which breaks the image: the page then shows its alt text. Each
// src that isn't one of the project's images, but is only a few characters off one, gets that image's
// address back.

// How far off a copied address can be and still count as that image
const MAX_TYPOS = 4

// Levenshtein distance, giving up (returning limit + 1) once it's sure to be over the limit
const editDistance = (a: string, b: string, limit: number) => {
    if (Math.abs(a.length - b.length) > limit) return limit + 1
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
    for (let i = 1; i <= a.length; i++) {
        const current = [i]
        let rowBest = i
        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
            rowBest = Math.min(rowBest, current[j])
        }
        if (rowBest > limit) return limit + 1
        previous = current
    }
    return previous[b.length]
}

// The project image an address was meant to be, or the address as it is
export const repairImageSrc = (src: string, images: string[]) => {
    if (images.includes(src)) return src
    let best: string | undefined
    let bestDistance = MAX_TYPOS + 1
    for (const image of images) {
        const distance = editDistance(src, image, MAX_TYPOS)
        if (distance < bestDistance) {
            best = image
            bestDistance = distance
        }
    }
    return best ?? src
}

const repairAll = (html: string, images: string[]) =>
    html.replace(/src="([^"]*)"/g, (_, src: string) => `src="${repairImageSrc(src, images)}"`)

// The streamed design with its image addresses repaired. The last few characters are held back, in
// case "src=" itself is split across chunks, and so is any src=" whose closing quote isn't in what
// would be sent, so an address always goes out whole.
export async function* repairImageSrcs(chunks: AsyncIterable<string>, images: string[]): AsyncGenerator<string> {
    if (images.length === 0) {
        yield* chunks
        return
    }
    let pending = ''
    for await (const chunk of chunks) {
        pending += chunk
        let ready = Math.max(0, pending.length - 4)
        const open = ready > 0 ? pending.lastIndexOf('src="', ready - 1) : -1
        if (open !== -1) {
            const close = pending.indexOf('"', open + 5)
            if (close === -1 || close >= ready) ready = open
        }
        if (ready > 0) {
            yield repairAll(pending.slice(0, ready), images)
            pending = pending.slice(ready)
        }
    }
    if (pending) yield repairAll(pending, images)
}
