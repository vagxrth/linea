'use client'
import React from 'react'
import { Button } from '../ui/button'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { useDispatch } from 'react-redux';
import { setScale } from '@/redux/slice/viewport';
import { useAppSelector } from '@/redux/store';

const Zoom = () => {
    const dispatch = useDispatch()
    // Not useCanvas(): every instance of it registers the canvas keyboard shortcuts again
    const scale = useAppSelector((state) => state.viewport.scale)
    const minScale = useAppSelector((state) => state.viewport.minScale)
    const maxScale = useAppSelector((state) => state.viewport.maxScale)

    const handleZoomOut = () => {
        const newScale = Math.max(scale / 1.2, minScale)
        dispatch(setScale({ scale: newScale }))
    }

    const handleZoomIn = () => {
        const newScale = Math.min(scale * 1.2, maxScale)
        dispatch(setScale({ scale: newScale }))
    }

    return (
        <div className='col-span-1 flex justify-end items-center'>
            <div className='flex items-center gap-1 backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-full p-3 saturate-150'>
                <Button variant="ghost" size="lg" onClick={handleZoomOut} className='w-9 h-9 p-0 rounded-full cursor-pointer hover:bg-white/[0.12] border border-transparent hover:border-white/[0.16] transition-all' title='Zoom Out'>
                    <ZoomOut className='w-4 h-4 text-primary/50' />
                </Button>
                <div className='text-center'>
                    <span className='text-sm font-mono leading-none text-primary/50'>
                        {Math.round(scale * 100)}%
                    </span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleZoomIn} className='w-9 h-9 p-0 rounded-full cursor-pointer hover:bg-white/[0.12] border border-transparent hover:border-white/[0.16] transition-all' title='Zoom In'>
                    <ZoomIn className='w-4 h-4 text-primary/50' />
                </Button>
            </div>
        </div>
    )
}

export default Zoom