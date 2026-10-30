import { getDocumentSize, type Value } from "convex/values"

// Convex refuses to store a document over 1 MiB, an object with more than 1024 entries or an array
// with more than 8192 items. Saves check these first, so an oversized drawing gets a clear reason
// instead of a generic error.
const MAX_DOCUMENT_BYTES = 1 << 20
const MAX_OBJECT_ENTRIES = 1024
const MAX_ARRAY_ITEMS = 8192

// Whether an object or array anywhere in the value is longer than Convex allows. Convex's
// getDocumentSize only counts bytes, so lengths are checked here.
const tooLong = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.length > MAX_ARRAY_ITEMS || value.some(tooLong)
    if (value === null || typeof value !== 'object' || value instanceof ArrayBuffer) return false
    // Fields set to undefined aren't stored
    const fields = Object.values(value).filter((field) => field !== undefined)
    return fields.length > MAX_OBJECT_ENTRIES || fields.some(tooLong)
}

// Whether Convex would refuse a document with these fields. getDocumentSize also counts the _id
// and _creationTime that Convex adds.
export const tooLargeForDocument = (fields: Record<string, Value>) =>
    tooLong(fields) || getDocumentSize(fields) > MAX_DOCUMENT_BYTES
