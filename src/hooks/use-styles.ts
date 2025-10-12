'use client'

import { useMutation } from "convex/react"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { api } from "../../convex/_generated/api"
import { toast } from "sonner"
import { Id } from "../../convex/_generated/dataModel"
import { useGenerateStyleGuideMutation } from "@/redux/api/style-guide"
import { useRouter } from "next/navigation"

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
    const addMoodboardImage = useMutation(api.moodboard.addMoodboardImage)

    const uploadImage = async (file: File): Promise<{ storageId: string; url?: string }> => {
        try {
            const uploadUrl = await generateUploadUrl()
            const result = await fetch(uploadUrl, {
                method: 'POST',
                body: file,
                headers: {
                    'Content-Type': file.type,
                },
            })
            if (!result.ok) {
                throw new Error(`Upload failed: ${result.statusText}`)
            }

            const { storageId } = await result.json()
            if (projectId) {
                await addMoodboardImage({
                    projectId: projectId as Id<'projects'>,
                    storageId: storageId as Id<'_storage'>
                })
            }

            return { storageId }
        } catch (error) {
            console.error(error)
            throw error
        }
    }

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

    const addImage = (file: File) => {
        if (images.length >= 5) {
            toast.error('You can only add up to 5 images')
            return
        }

        const newImage: MoodboardImage = {
            id: `${Date.now()}-${Math.random()}`,
            file,
            preview: URL.createObjectURL(file),
            uploaded: false,
            uploading: false,
            isFromServer: false
        }

        const updatedImages = [...images, newImage]
        setValue('images', updatedImages)

        toast.success('Image added successfully')
    }

    const removeImage = async (imageId: string) => {
        const imageToRemove = images.find((image) => image.id === imageId)
        if (!imageToRemove) return

        if (imageToRemove.isFromServer && imageToRemove.storageId && projectId) {
            try {
                await removeMoodboardImage({
                    projectId: projectId as Id<'projects'>,
                    storageId: imageToRemove.storageId as Id<'_storage'>
                })
            } catch (error) {
                console.error(error)
                toast.error('Failed to remove image')
                return
            }
        }

        const updatedImages = images.filter((image) => {
            if (image.id === imageId) {
                if (!image.isFromServer && image.preview.startsWith('blob:')) {
                    URL.revokeObjectURL(image.preview)
                }
                return false
            }
            return true
        })
        setValue('images', updatedImages)
        toast.success('Image removed successfully')
    }

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        setDragActive(false)

        const files = Array.from(e.dataTransfer.files)
        const imageFiles = files.filter((file) => file.type.startsWith('image/'))

        if (imageFiles.length === 0) {
            toast.error('Please drag and drop images only')
            return
        }

        imageFiles.forEach((file) => {
            if (images.length < 5) {
                addImage(file)
            }
        })
    }

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        files.forEach((file) => addImage(file))
        e.target.value = ''
    }

    useEffect(() => {
        const uploadPendingImages = async () => {
            const currentImages = getValues('images')
            for (let i = 0; i < currentImages.length; i++) {
                const image = currentImages[i]
                if (!image.uploaded && !image.uploading && !image.error) {
                    const updatedImages = [...currentImages]
                    updatedImages[i] = { ...image, uploading: true }
                    setValue('images', updatedImages)
                    try {
                        const { storageId } = await uploadImage(image.file!)
                        const finalImages = getValues('images')
                        const finalIndex = finalImages.findIndex(
                            (img) => img.id === image.id
                        )
                        if (finalIndex !== -1) {
                            finalImages[finalIndex] = {
                                ...finalImages[finalIndex],
                                storageId,
                                uploaded: true,
                                uploading: false,
                                isFromServer: true
                            }
                            setValue('images', [...finalImages])
                        }
                    } catch (error) {
                        console.error(error)
                        const errorImages = getValues('images')
                        const errorIndex = errorImages.findIndex(
                            (img) => img.id === image.id
                        )
                        if (errorIndex !== -1) {
                            errorImages[errorIndex] = {
                                ...errorImages[errorIndex],
                                uploading: false,
                                error: 'Upload Failed'
                            }
                            setValue('images', [...errorImages])
                        }
                    }
                }
            }
        }

        if (images.length > 0) {
            uploadPendingImages()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images, setValue, getValues])

    useEffect(() => {
        return () => {
            images.forEach((image) => {
                URL.revokeObjectURL(image.preview)
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        form,
        images,
        dragActive,
        addImage,
        removeImage,
        handleDrag,
        handleDrop,
        handleFileInput,
        canAddMore: images.length < 5
    }
}

export const useStyleGuide = (projectId: string, images: MoodboardImage[], fileInputRef: React.RefObject<HTMLInputElement | null>) => {
    const [generateStyleGuide, { isLoading: isGenerating }] = useGenerateStyleGuideMutation()
    const router = useRouter()

    const handleUploadClick = () => fileInputRef.current?.click()

    const handleGenerateStyleGuide = async () => {
        if (!projectId) {
            toast.error('No Project selected')
            return
        }
        if (images.length === 0) {
            toast.error('No images uploaded')
            return
        }
        if (images.some((img) => img.uploading)) {
            toast.error('Please wait for images to finish uploading')
            return
        }
        try {
            toast.loading('Generating style guide...', {
                id: 'style-guide-generation'
            })
            const result = await generateStyleGuide({ projectId }).unwrap()

            if (!result.success) {
                toast.error(result.message, { id: 'style-guide-generation' })
                return
            }
            router.refresh()
            toast.success('Style guide generated successfully', { id: 'style-guide-generation' })
            setTimeout(() => {
                toast.success('Switch to Colors tab to see the results', { duration: 5000 })
            }, 1000)
        } catch (error) {
            const errorMessage = error && typeof error === 'object' && 'error' in error
                ? (error as { error: string }).error
                : 'Failed to generate style guide'
            toast.error(errorMessage, { id: 'style-guide-generation' })
        }
    }

    return {
        handleUploadClick,
        handleGenerateStyleGuide,
        isGenerating
    }
}