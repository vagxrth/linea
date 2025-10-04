import { MoodboardImage, useMoodboard } from '@/hooks/use-styles'
import React from 'react'

type Props = {
    guideImages: MoodboardImage[]
}

const Moodboard = ({ guideImages }: Props) => {

    const { images, dragActive, removeImage, handleDrag, handleDrop, handleFileInput, canAddMore } = useMoodboard(guideImages)

    return (
        <div className='flex flex-col gap-10'>
            <div className='relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-200 min-h-[500px] flex items-center justify-center' />
            <div className='absolute inset-0 opacity-5'>
                <div className='w-full h-full bg-gradient-to-br from-primary/20 to-transparent rounded-3xl' />
            </div>

        </div>
    )
}

export default Moodboard