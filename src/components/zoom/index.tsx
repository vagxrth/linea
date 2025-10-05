import React from 'react'
import { Button } from '../ui/button'
import { ZoomOut } from 'lucide-react'
import { useCanvas } from '@/hooks/use-canvas';

const Zoom = () => {

    // const { viewport } = useCanvas();

    // const handleZoomOut = () => {
    //     const newScale = Math.max(viewport.scale / 1.2, viewport.minScale)
    //     dispatch(setScale({ scale: newScale }))
    // }

    return (
        <div className='col-span-1 flex justify-end items-center'>
            <div className='flex items-center gap-1 backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-full p-3 saturate-150'>
                <Button variant="ghost" size="lg" onClick={handleZoomOut} className='w-9 h-9 p-0 rounded-full cursor-pointer hover:bg-white/[0.12] border border-transparent hover:border-white/[0.16] transition-all'>
                    <ZoomOut className='w-4 h-4 text-primary/50' />
                </Button>
            </div>
        </div>
    )
}

export default Zoom