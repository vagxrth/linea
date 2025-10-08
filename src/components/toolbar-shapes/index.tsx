'use client'
import { useCanvas } from '@/hooks/use-canvas'
import { Tool } from '@/redux/slice/shapes'
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

    const { currentTool, selectTool } = useCanvas();

  return (
    <div className='col-span-1 flex justify-center items-center'>
        <div className='flex items-center backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] gap-2 rounded-full p-3 saturate-150'>
            {tools.map((tool) => (
                <Button
                    key={tool.id}
                    variant={'ghost'}
                    size='lg'
                    onClick={() => selectTool(tool.id)}
                    className={cn('cursor-pointer rounded-full p-3', currentTool === tool.id ? 'text-primary/100 bg-white/[0.12] border border-white/[0.16]' : 'text-primary/50 hover:bg-white/[0.06] border border-transparent')}
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