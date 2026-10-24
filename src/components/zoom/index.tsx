'use client'
import React from 'react'
import { Button } from '../ui/button'
import { Scan, ZoomIn, ZoomOut } from 'lucide-react'
import { useDispatch } from 'react-redux';
import { fitToContent } from '@/lib/shape-bounds';
import { setScale } from '@/redux/slice/viewport';
import { useAppSelector, useAppStore } from '@/redux/store';

// The middle of the canvas, in the canvas's own coordinates, which start at its top-left corner.
// Zooming around it keeps what's in the center of the view in place.
const getViewCenter = () => {
    const canvas = document.getElementById('infinite-canvas')
    if (!canvas) return undefined
    const { width, height } = canvas.getBoundingClientRect()
    return { x: width / 2, y: height / 2 }
}

const Zoom = () => {
    const dispatch = useDispatch()
    const store = useAppStore()
    // Not useCanvas(): every instance of it registers the canvas keyboard shortcuts again
    const scale = useAppSelector((state) => state.viewport.scale)
    const minScale = useAppSelector((state) => state.viewport.minScale)
    const maxScale = useAppSelector((state) => state.viewport.maxScale)

    const handleZoomOut = () => {
        const newScale = Math.max(scale / 1.2, minScale)
        dispatch(setScale({ scale: newScale, originScreen: getViewCenter() }))
    }

    const handleZoomIn = () => {
        const newScale = Math.min(scale * 1.2, maxScale)
        dispatch(setScale({ scale: newScale, originScreen: getViewCenter() }))
    }

    // The shapes are read when clicked, so the controls don't redraw whenever a shape changes
    const handleFit = () => {
        const canvas = document.getElementById('infinite-canvas')
        if (!canvas) return
        const { width, height } = canvas.getBoundingClientRect()
        const fit = fitToContent(Object.values(store.getState().shapes.shapes.entities), { width, height })
        if (fit) dispatch(fit)
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
                <Button variant="ghost" size="sm" onClick={handleFit} className='w-9 h-9 p-0 rounded-full cursor-pointer hover:bg-white/[0.12] border border-transparent hover:border-white/[0.16] transition-all' title='Zoom to fit (Shift+1)'>
                    <Scan className='w-4 h-4 text-primary/50' />
                </Button>
            </div>
        </div>
    )
}

export default Zoom