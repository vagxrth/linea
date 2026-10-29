// Moodboard and inspiration images go to Gemini, which reads PNG, JPEG and WebP. (It reads HEIC
// and HEIF too, but most browsers can't show those in the moodboard.)
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]

// For a file input's accept attribute
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",")

// Gemini caps a request at 20 MB, counting images as base64, which is a third larger than the
// files. A design sends the wireframe and up to 6 inspiration images, and 6 images of 2 MB come to
// 16 MB, which leaves room for the wireframe and the prompt.
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

// Why a file can't be a project image, worded to follow its name, or null when it can be
export const imageProblem = (type: string | undefined, size: number): string | null => {
    if (!type || !IMAGE_TYPES.includes(type)) return "isn't a PNG, JPEG or WebP image"
    if (size > MAX_IMAGE_BYTES) return "is over 2 MB. Use a smaller image."
    return null
}
