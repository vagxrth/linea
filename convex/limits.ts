// Convex refuses to store a document over 1 MiB, an object with more than 1024 entries or an array
// with more than 8192 items. Saves check these first, so an oversized drawing gets a clear reason
// instead of a generic error.
const MAX_DOCUMENT_BYTES = 1 << 20
const MAX_OBJECT_ENTRIES = 1024
const MAX_ARRAY_ITEMS = 8192
// What Convex counts for a document's _id and _creationTime
const SYSTEM_FIELDS_BYTES = 38 + 23

const utf8Length = (text: string) => new TextEncoder().encode(text).length

// A value's size as Convex counts it, the same as getConvexSize in newer versions of convex/values,
// which can replace this after upgrading Convex. An object or array longer than Convex allows
// counts as Infinity, so it's too large however small its contents are.
export const convexSize = (value: unknown): number => {
    if (value === undefined) return 0
    if (value === null || typeof value === 'boolean') return 1
    if (typeof value === 'number' || typeof value === 'bigint') return 9
    if (typeof value === 'string') return 2 + utf8Length(value)
    if (value instanceof ArrayBuffer) return 2 + value.byteLength
    if (Array.isArray(value)) {
        if (value.length > MAX_ARRAY_ITEMS) return Infinity
        return value.reduce((size: number, item) => size + convexSize(item), 2)
    }
    // Fields set to undefined aren't stored
    const entries = Object.entries(value as Record<string, unknown>).filter(([, field]) => field !== undefined)
    if (entries.length > MAX_OBJECT_ENTRIES) return Infinity
    return entries.reduce((size, [key, field]) => size + utf8Length(key) + 1 + convexSize(field), 2)
}

// Whether Convex would refuse a document with these fields
export const tooLargeForDocument = (fields: Record<string, unknown>) =>
    convexSize(fields) + SYSTEM_FIELDS_BYTES > MAX_DOCUMENT_BYTES
