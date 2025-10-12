'use client'

import { Button } from '@/components/ui/button'
import { useStyleGuide } from '@/hooks/use-styles'
import { Loader2, Sparkles } from 'lucide-react'
import React from 'react'

type Props = {
    images: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
    fileInputRef: React.RefObject<HTMLInputElement | null>
    projectId: string
}

const GenerateStyleGuide = ({ images, fileInputRef, projectId }: Props) => {

    const { handleGenerateStyleGuide, isGenerating } = useStyleGuide(projectId, images, fileInputRef)

  return (
    images.length > 0 && (
        <div className='flex justify-end'>
            <Button
                className='rounded-full'
                onClickCapture={handleGenerateStyleGuide}
                disabled={isGenerating || images.some((img) => img.uploading)}
            >
                {isGenerating ? (
                    <>
                        <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                        Analyzing Images...
                    </>
                ) : (
                    <>
                        <Sparkles className='h-4 w-4 mr-2' />
                        Generate Style Guide
                    </>
                )
                }
            </Button>
        </div>
    )
  )
}

export default GenerateStyleGuide