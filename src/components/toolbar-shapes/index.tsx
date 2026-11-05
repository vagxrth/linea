'use client'
import { setTool, Tool } from '@/redux/slice/shapes'
import { useAppDispatch, useAppSelector } from '@/redux/store'
import { ArrowRight, Circle, Eraser, Hash, Minus, MousePointer2, Pencil, Square, Type } from 'lucide-react'
import React from 'react'
import { Button } from '../ui/button'
import { cn } from '@/lib/utils'

const tools: Array<{
    id: Tool
    icon: React.ReactNode
    label: string
    description: string
}> = [
    {
        id: 'select',
        icon: <MousePointer2 className='w-4 h-4'/>,
        label: 'Select',
        description: 'Select shapes'
    },
    {
        id: 'frame',
        icon: <Hash className='w-4 h-4'/>,
        label: 'Frame',
        description: 'Create a frame'
    },
    {
        id: 'rect',
        icon: <Square className='w-4 h-4'/>,
        label: 'Rectangle',
        description: 'Create a rectangle'
    },
    {
        id: 'ellipse',
        icon: <Circle className='w-4 h-4'/>,
        label: 'Ellipse',
        description: 'Create an ellipse'
    },
    {
        id: 'freedraw',
        icon: <Pencil className='w-4 h-4'/>,
        label: 'Freedraw',
        description: 'Create a freedraw'
    },
    {
        id: 'arrow',
        icon: <ArrowRight className='w-4 h-4'/>,
        label: 'Arrow',
        description: 'Create an arrow'
    },
    {
        id: 'line',
        icon: <Minus className='w-4 h-4'/>,
        label: 'Line',
        description: 'Create a line'
    },
    {
        id: 'text',
        icon: <Type className='w-4 h-4'/>,
        label: 'Text',
        description: 'Add text'
    },
    {
        id: 'eraser',
        icon: <Eraser className='w-4 h-4'/>,
        label: 'Eraser',
        description: 'Erase shapes'
    }
]


const ToolbarShapes = () => {

    // Not useCanvas(): every instance of it registers the canvas keyboard shortcuts again
    const dispatch = useAppDispatch()
    const currentTool = useAppSelector((state) => state.shapes.tool)
    const selectTool = (tool: Tool) => dispatch(setTool(tool))

  return (
    // On a phone the tools are wider than the screen, so the pill scrolls sideways. mx-auto centers it
    // when it fits; justify-center would push its first tools out of reach once it doesn't.
    <div className='flex min-w-0 items-center'>
        <div className='pointer-events-auto mx-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/[0.12] bg-neutral-800/85 p-2 saturate-150 backdrop-blur-xl [scrollbar-width:none] sm:gap-2 sm:p-3 [&::-webkit-scrollbar]:hidden'>
            {tools.map((tool) => (
                <Button
                    key={tool.id}
                    variant={'ghost'}
                    size='lg'
                    onClick={() => selectTool(tool.id)}
                    className={cn('shrink-0 cursor-pointer rounded-full p-3', currentTool === tool.id ? 'text-primary/100 bg-white/[0.12] border border-white/[0.16]' : 'text-primary/75 hover:text-primary hover:bg-white/[0.06] border border-transparent')}
                    title={`${tool.label} - ${tool.description}`}
                >
                    {tool.icon}
                </Button>
            ))}
        </div>
    </div>
  )
}

export default ToolbarShapes