import { cn } from '@/lib/utils'
import { ImageIcon, Loader2, Plus, Trash2, Upload, X } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Label } from '../ui/label'
import { Button } from '../ui/button'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
import Image from 'next/image'

type InspirationSidebarProps = {
    isOpen: boolean
    onClose: () => void
}

type Props = {
    id: string
    file?: File
    storageId?: string
    url?: string
    uploaded: boolean
    uploading: boolean
    error?: string
    isFromServer?: boolean
}


const InspirationSidebar = ({ isOpen, onClose }: InspirationSidebarProps) => {

    const [images, setImages] = useState<Props[]>([])
    const [dragActive, setDragActive] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const searchParams = useSearchParams()
    const projectId = searchParams.get('project')

    const generateUploadUrl = useMutation(api.inspiration.generateUploadUrl)
    const addInspirationImage = useMutation(api.inspiration.addInspirationImage)
    const removeInspirationImage = useMutation(api.inspiration.removeInspirationImage)
    const existingImages = useQuery(api.inspiration.getInspirationImages, projectId ? { projectId: projectId as Id<'projects'> } : 'skip')

    const uploadImage = useCallback(async (file: File): Promise<{ storageId: string }> => {
        try {
            const uploadUrl = await generateUploadUrl()

            const result = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Content-Type': file.type },
                body: file
            })

            if (!result.ok) {
                throw new Error(`Upload failed: ${result.statusText}`)
            }

            const { storageId } = await result.json()

            if (projectId) {
                await addInspirationImage({
                    projectId: projectId as Id<'projects'>,
                    storageId: storageId as Id<'_storage'>
                })
            }

            return { storageId }
        } catch (error) {
            throw error
        }
    }, [generateUploadUrl, addInspirationImage, projectId])

    const handleFileSelect = useCallback((files: FileList | null) => {
        if (!files || files.length === 0) return

        const newImages: Props[] = Array.from(files)
            .filter((file) => file.type.startsWith('image/'))
            .slice(0, 6 - images.length)
            .map((file) => ({
                id: `temp-${Date.now()}-${Math.random()}`,
                file,
                url: URL.createObjectURL(file),
                uploaded: false,
                uploading: false,
            }))

        if (newImages.length > 0) {
            setImages((prev) => [...prev, ...newImages])
            newImages.forEach(async (image) => {
                setImages((prev) => prev.map((img) => img.id === image.id ? { ...img, uploading: true } : img))
                try {
                    const { storageId } = await uploadImage(image.file!)
                    setImages((prev) =>
                        prev.map((img) =>
                            img.id === image.id
                                ? { ...img, storageId, uploaded: true, uploading: false, isFromServer: true } : img
                        )
                    )
                } catch (error) { // eslint-disable-line @typescript-eslint/no-unused-vars
                    setImages((prev) =>
                        prev.map((img) =>
                            img.id === image.id
                                ? { ...img, uploading: false, error: 'Failed to upload image' } : img
                        )
                    )
                }
            })
        }
    }, [images.length, uploadImage])

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true)
        } else if (e.type === 'dragleave') {
            setDragActive(false)
        }
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()

        setDragActive(false)

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files)
        }
    }, [handleFileSelect])

    const clearAllImages = async () => {
        const imagesToRemove = images.filter((img) => img.storageId && img.isFromServer)

        for (const image of imagesToRemove) {
            if (projectId && image.storageId) {
                try {
                    await removeInspirationImage({
                        projectId: projectId as Id<'projects'>,
                        storageId: image.storageId as Id<'_storage'>
                    })
                } catch (error) {
                    console.error('Failed to remove image', error)
                }
            }
        }
        setImages([])
    }

    const removeImage = async (imageId: string) => {
        const image = images.find((img) => img.id === imageId)
        if (!image) return

        if (image.storageId && image.isFromServer && projectId) {
            try {
                await removeInspirationImage({
                    projectId: projectId as Id<'projects'>,
                    storageId: image.storageId as Id<'_storage'>
                })
            } catch (error) {
                console.error('Failed to remove image', error)
            }
        }

        setImages((prev) => prev.filter((img) => img.id !== imageId))
    }

    useEffect(() => {
        if (existingImages && existingImages.length > 0) {
            const serverImages: Props[] = existingImages.map((img) => ({
                id: img.id,
                storageId: img.storageId,
                url: img.url || undefined,
                uploaded: true,
                uploading: false,
                isFromServer: true
            }))

            setImages((prev) => {
                const localImages = prev.filter((img) => !img.isFromServer)
                return [...serverImages, ...localImages]
            })
        } else if (existingImages && existingImages.length === 0) {
            setImages((prev) => prev.filter((img) => !img.isFromServer))
        }
    }, [existingImages])

    return (
        <div className={cn('fixed left-5 top-1/2 transform -translate-y-1/2 w-80 backdrop-blur-xl bg-white/[0.08] border-white/[0.12] gap-2 p-3 saturate-150 border rounded-lg z-50 transition-all duration-300',
            isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
        )}>
            <div className='p-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-8rem)]'>
                <div className='flex items-center justify-between'>
                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={onClose}
                        className='h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/12'
                    >
                        <X className='w-4 h-4' />
                    </Button>
                    <div className='flex items-center gap-2'>
                        <ImageIcon className='w-5 h-5 text-white/80' />
                        <Label className='text-white/80 font-medium'>
                            Inspiration Board
                        </Label>
                    </div>
                </div>
            </div>
            <div className={cn('border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer',
                dragActive
                    ? 'border-blue-400 bg-blue-500/10'
                    : images.length < 6
                        ? 'border-white/20 hover:border-white/40 hover:bg-white/5'
                        : 'border-white/10 bg-white/5 cursor-not-allowed opacity-50'
            )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => images.length < 6 && fileInputRef.current?.click()}
            >
                <input ref={fileInputRef} type='file' multiple className='hidden' onChange={(e) => handleFileSelect(e.target.files)} accept='image/*' />
                <div className='flex flex-col items-center gap-2'>
                    <Upload className='w-8 h-8 text-white/40' />
                    <p className='text-white/60 text-sm'>
                        {images.length < 6 ? (
                            <>
                                Drop images here or {' '}
                                <span className='text-blue-400'>browse</span>
                                <br />
                                <span className='text-xs text-white/40'>
                                    {images.length}/6 images uploaded
                                </span>
                            </>
                        ) : (
                            'Maximum 6 images allowed'
                        )}
                    </p>
                </div>
            </div>
            <div>
                {images.length > 0 && (
                    <div className='space-y-3'>
                        <div className='flex items-center justify-between'>
                            <Label className='text-white/80 text-sm'>
                                Uploaded Images ({images.length})
                            </Label>
                            <Button
                                variant='ghost'
                                size='sm'
                                onClick={clearAllImages}
                                className='h-7 px-2 text-xs text-white/60 hover:text-white hover:bg-white/12'
                            >
                                <Trash2 className='w-3 h-3 mr-1' />
                                Clear all
                            </Button>
                        </div>
                        <div className='grid grid-cols-2 gap-2'>
                            {images.map((image) => (
                                <div key={image.id} className='relative group asepct-square rounded-lg overflow-hidden border border-white/10 bg-white/5'>
                                    <Image 
                                        src={image.url || ''}
                                        alt={'Inspiration Image'}
                                        width={100}
                                        height={100}
                                        className='w-full h-full object-cover'
                                    />
                                    {image.uploading && (
                                        <div className='absolute inset-0 bg-black/50 flex items-center justify-center'>
                                            <Loader2 className='w-6 h-6 text-white animate-spin' />
                                        </div>
                                    )}
                                    {image.error && (
                                        <div className='absolute inset-0 bg-red-500/20 flex items-center justify-center'>
                                            <p className='text-xs text-red-300 text-center px-2'>
                                                {image.error}
                                            </p>
                                        </div>
                                    )}
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => removeImage(image.id)}
                                        className='absolute top-1 right-1 h-6 w-6 p-0 bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity'
                                    >
                                        <X className='w-3 h-3 text-white' />
                                    </Button>
                                    {image.uploaded && !image.uploading && (
                                        <div className='absolute bottom-1 right-1 w-3 h-3 bg-green-500 rounded-full border border-white/20' />
                                    )}
                                </div>
                            ))}
                            {images.length < 6 && (
                                <Button
                                    onClick={() => fileInputRef.current?.click()}
                                    className='aspect-square rounded-lg border-2 border-dashed border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10 transition-all duration-200 flex items-center justify-center group'
                                >
                                    <Plus className='w-6 h-6 text-white/40 group-hover:text-white/60 transition-colors' />
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default InspirationSidebar