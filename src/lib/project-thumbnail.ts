// Projects created before November 2026 were each given a random bright gradient as their thumbnail:
// an SVG, base64 in a data URL, whose gradient is named "grad". Those are placeholders, not pictures
// of the project, so the dashboard shows them as it shows a project with no thumbnail: the dark
// sketch placeholder. Any other thumbnail (a real image or address) still shows.
const SVG_DATA_URL = "data:image/svg+xml;base64,"

export const isGradientPlaceholder = (thumbnail: string) => {
    if (!thumbnail.startsWith(SVG_DATA_URL)) return false
    try {
        return atob(thumbnail.slice(SVG_DATA_URL.length)).includes('<linearGradient id="grad"')
    } catch {
        return false
    }
}

// The thumbnail worth showing for a project, or null for the sketch placeholder
export const projectThumbnail = (thumbnail: string | null | undefined) =>
    thumbnail && !isGradientPlaceholder(thumbnail) ? thumbnail : null
