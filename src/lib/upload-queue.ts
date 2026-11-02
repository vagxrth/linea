// Uploads the images added to a list, each exactly once and one at a time, in the order they were
// added. The moodboard keeps its images in a form, and its effect hands the list over after every
// change, including the changes the uploads themselves make. So this remembers what it started
// rather than trusting the list it's given, and patches images by id in the list as it is now. The
// old loop wrote back the copy it started with, which marked finished uploads pending again: adding
// several images at once uploaded some twice, until the moodboard's 5-image limit refused the rest.

export type QueuedImage = {
    id: string
    file?: File
    uploaded: boolean
    uploading: boolean
    error?: string
}

type Options<T extends QueuedImage> = {
    // The list as it is now. Read fresh each time, never kept: it changes while uploads run.
    current: () => T[]
    // Changes one image in the current list
    update: (id: string, patch: Partial<T>) => void
    // Uploads one image. What it returns is merged into the image when it's done.
    upload: (image: T) => Promise<Partial<T>>
}

export const createUploadQueue = <T extends QueuedImage>({ current, update, upload }: Options<T>) => {
    const started = new Set<string>()
    let queue: Promise<void> = Promise.resolve()

    // Queues the images in this list that still need uploading. The promise settles when everything
    // queued so far has finished.
    const add = (images: T[]): Promise<void> => {
        for (const image of images) {
            if (!image.file || image.uploaded || image.uploading || image.error || started.has(image.id)) continue
            started.add(image.id)
            // Queued before the update says so, since the update can hand the list straight back
            // here and queue the images after this one
            queue = queue.then(async () => {
                // Removed while it waited its turn
                if (!current().some((item) => item.id === image.id)) return
                try {
                    const result = await upload(image)
                    update(image.id, { ...result, uploaded: true, uploading: false } as Partial<T>)
                } catch (error) {
                    console.error(error)
                    update(image.id, { uploading: false, error: 'Upload Failed' } as Partial<T>)
                }
            })
            update(image.id, { uploading: true } as Partial<T>)
        }
        return queue
    }

    return { add }
}
