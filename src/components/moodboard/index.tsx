'use client'

import { MoodboardImage, useMoodboard } from '@/hooks/use-styles'
import { BOARD_IMAGE_LIMIT } from '../../../convex/limits'
import { IMAGE_ACCEPT } from '@/lib/image-upload'
import { cn } from '@/lib/utils'
import React, { useRef } from 'react'
import ImagesBoard from './images-board'
import { Upload } from 'lucide-react'
import { Button } from '../ui/button'
import { useSearchParams } from 'next/navigation'
import GenerateStyleGuide from '../buttons/style-guide'

type Props = {
    guideImages: MoodboardImage[]
}

const Moodboard = ({ guideImages }: Props) => {

    const { images, dragActive, removeImage, handleDrag, handleDrop, handleFileInput, canAddMore } = useMoodboard(guideImages)

    const fileInput = useRef<HTMLInputElement>(null)
    const handleUpload = () => {
        fileInput.current?.click()
    }

    const searchParams = useSearchParams()
    const projectId = searchParams.get('project')

    return (
        <div className='flex flex-col gap-10'>
            <div className={cn('relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-200 min-h-[400px] flex items-center justify-center', dragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border/50 hover:border-border')}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <div className='absolute inset-0 opacity-5'>
                    <div className='w-full h-full bg-gradient-to-br from-primary/20 to-transparent rounded-3xl' />
                </div>
                {images.length > 0 && (
                    <>
                        <div className='lg:hidden absolute inset-0 flex items-center justify-center'>
                            <div className='relative'>
                                {images.map((image, index) => {
                                    const seed = image.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)

                                    const random1 = ((seed * 9301 + 49297) % 233280) / 233280
                                    const random2 = (((seed + 1) * 9301 + 49297) % 233280) / 233280
                                    const random3 = (((seed + 2) * 9301 + 49297) % 233280) / 233280

                                    const rotation = (random1 - 0.5) * 20
                                    const xOffset = (random2 - 0.5) * 40
                                    const yOffset = (random3 - 0.5) * 30
                                    return (
                                        <ImagesBoard
                                            key={`mobile-${image.id}`}
                                            image={image}
                                            removeImage={removeImage}
                                            xOffset={xOffset}
                                            yOffset={yOffset}
                                            rotation={rotation}
                                            zIndex={index + 1}
                                            marginLeft="-80px"
                                            marginTop="-96px"
                                        />
                                    )
                                })}
                            </div>
                        </div>
                        <div className='hidden lg:flex absolute inset-0 items-center justify-center'>
                            <div className='relative w-full max-w-[700px] h-[300px] mx-auto'>
                                {images.map((image, index) => {
                                    const seed = image.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)

                                    const random1 = ((seed * 9301 + 49297) % 233280) / 233280
                                    const random2 = (((seed + 2) * 9301 + 49297) % 233280) / 233280

                                    const imageWidth = 192
                                    const overlapAmount = 30
                                    const spacing = imageWidth - overlapAmount

                                    const rotation = (random1 - 0.5) * 50
                                    const xOffset = index * spacing - ((images.length - 1) * spacing) / 2
                                    const yOffset = (random2 - 0.5) * 30
                                    const zIndex = index + 1
                                    return (
                                        <ImagesBoard
                                            key={`desktop-${image.id}`}
                                            image={image}
                                            removeImage={removeImage}
                                            xOffset={xOffset}
                                            yOffset={yOffset}
                                            rotation={rotation}
                                            zIndex={zIndex}
                                            marginLeft="-96px"
                                            marginTop="-112px"
                                        />
                                    )
                                })}
                            </div>
                        </div>
                    </>
                )}
                {images.length === 0 && (
                    <div className='relative z-10 space-y-6'>
                        <div className='mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center'>
                            <Upload className='w-8 h-8 text-muted-foreground' />
                        </div>
                        <div className='space-y-2'>
                            <h3 className='text-lg font-medium text-foreground'>
                                Add images to your moodboard
                            </h3>
                            <p className='text-[0.9375rem]/relaxed text-muted-foreground max-w-md mx-auto'>
                                Drag and drop up to {BOARD_IMAGE_LIMIT} images here, or choose files
                            </p>
                        </div>
                        <Button onClick={handleUpload} variant='outline'>
                            <Upload className='w-4 h-4 mr-2' />
                            Choose files
                        </Button>
                    </div>
                )}
                {images.length > 0 && (
                    // How many images there are against the limit, so a full board explains why Add more is gone
                    <p className='absolute top-6 left-6 z-20 text-sm text-muted-foreground' aria-live='polite'>
                        {canAddMore
                            ? `${images.length} of ${BOARD_IMAGE_LIMIT} images`
                            : `Full: ${BOARD_IMAGE_LIMIT} of ${BOARD_IMAGE_LIMIT} images`}
                    </p>
                )}
                {images.length > 0 && canAddMore && (
                    <div className='absolute bottom-6 right-6 z-20'>
                        <Button onClick={handleUpload} size="sm" variant="outline">
                            <Upload className='w-4 h-4 mr-2' />
                            Add more
                        </Button>
                    </div>
                )}
                <input ref={fileInput} type="file" multiple className='hidden' onChange={handleFileInput} accept={IMAGE_ACCEPT}/>
            </div>
            <GenerateStyleGuide images={images} fileInputRef={fileInput} projectId={projectId ?? ''}/>
        </div>
    )
}

export default Moodboard