import { useMutation } from "convex/react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { api } from "../../convex/_generated/api"

export interface MoodboardImage {
    id: string
    file?: File
    preview: string
    storageId?: string
    uploaded: boolean
    uploading: boolean
    error?: string
    url?: string
    isFromServer?: boolean
}

interface StylesFormData {
    images: MoodboardImage[]
}

export const useMoodboard = (guideImages: MoodboardImage[]) => {
    const [dragActive, setDragActive] = useState(false)
    const searchParams = useSearchParams()
    const projectId = searchParams.get('project')

    const form = useForm<StylesFormData>({
        defaultValues: {
            images: [],
        }
    })

    const { watch, setValue, getValues } = form
    const images = watch('images')

    const generateUploadUrl = useMutation(api.moodboard.generateUploadUrl)
    const removeMoodboardImage = useMutation(api.moodboard.removeMoodboardImage)

    useEffect(() => {
        if (guideImages && guideImages.length > 0) {
            const serverImages: MoodboardImage[] = guideImages.map((image) => ({
                id: image.id,
                preview: image.preview,
                storageId: image.storageId,
                uploaded: true,
                uploading: false,
                url: image.url,
            }))
            const currentImages = getValues('images')

            if (currentImages.length === 0) {
                setValue('images', serverImages)
            } else {
                const mergedImages = [...currentImages]
                serverImages.forEach((serverImage) => {
                    const clientIndex = mergedImages.findIndex((clientImage) => clientImage.storageId === serverImage.storageId)

                    if (clientIndex !== -1) {
                        if (mergedImages[clientIndex].preview.startsWith('blob:')) {
                            URL.revokeObjectURL(mergedImages[clientIndex].preview)
                        }
                        mergedImages[clientIndex] = serverImage
                    }
                })
                setValue('images', mergedImages)
            }
        }
    }, [guideImages, setValue, getValues])
}