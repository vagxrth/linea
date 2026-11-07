// Designs made before the image manifest (src/lib/image-manifest.ts) hold the project's image
// addresses themselves, copied by the model, which now and then dropped or swapped a character of
// their long ids. When such a design is refined, each address that's only a few characters off one of
// the project's images is read as that image, so it keeps its picture.

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
