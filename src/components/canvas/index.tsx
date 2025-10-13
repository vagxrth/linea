'use client'

import { useCanvas, useInspiration } from '@/hooks/use-canvas'
import React from 'react'
import TextSidebar from '../text-sidebar'
import { cn } from '@/lib/utils'
import ShapeRenderer from '../renderer'
import { RectanglePreview } from '../shapes/rectangle/preview'
import { FramePreview } from '../shapes/frame/preview'
import { EllipsePreview } from '../shapes/ellipse/preview'
import { ArrowPreview } from '../shapes/arrow/preview'
import { LinePreview } from '../shapes/line/preview'
import { FreeDrawStrokePreview } from '../shapes/stroke/preview'
import { SelectionOverlay } from '../overlay'
import InspirationSidebar from '../inspiration-sidebar'

const InfiniteCanvas = () => {

    const {
        viewport,
        shapes,
        currentTool,
        selectedShapes,
        onPointerDown,
        onPointerUp,
        onPointerMove,
        onPointerCancel,
        attachCanvasRef,
        getDraftShapes,
        getFreeDrawPoints,
        sidebarOpen,
        selectedText
    } = useCanvas()

    const { isInspirationOpen, closeInspiration, toggleInspiration } = useInspiration()

    const draftShape = getDraftShapes()
    const freeDrawPoints = getFreeDrawPoints()

  return (
    <>
        <TextSidebar isOpen={ sidebarOpen && selectedText } />

        <InspirationSidebar 
            isOpen={isInspirationOpen} 
            onClose={closeInspiration}
        />

        <div ref={attachCanvasRef} role='application' aria-label='Infinite Canvas' className={cn(
            'relative w-full h-full overflow-hidden select-none z-0',
            {
                'cursor-grabbing': viewport.mode === 'panning',
                'cursor-grab': viewport.mode === 'shiftPanning',
                'cursor-crosshair': currentTool !== 'select' && viewport.mode === 'idle',
                'cursor-default': currentTool === 'select' && viewport.mode === 'idle',
            }
        )}
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        draggable={false}
        >
            <div className='absolute origin-top-left pointer-events-none z-10' style={{
                transform: `translate3d(${viewport.translate.x}px, ${viewport.translate.y}px, 0) scale(${viewport.scale})`,
                transformOrigin: '0 0',
                willChange: 'transform',
            }}>
                {/* {shapes.map((shape) => (
                    <ShapeRenderer 
                        key={shape.id}
                        shape={shape}
                        toggleInspiration={toggleInspiration}
                        toggleChat={toggleChat}
                        generateWorkflow={generateWorkflow}
                        exportDesign={exportDesign}
                    />
                ))} */}

                {shapes.map((shape) => (
                    <SelectionOverlay key={`select-${shape.id}`} shape={shape} isSelected={!!selectedShapes[shape.id]} />
                ))}

                {draftShape && draftShape.type === 'frame' && (
                    <FramePreview startWorld={draftShape.start} currentWorld={draftShape.current} />
                )}

                {draftShape && draftShape.type === 'rect' && (
                    <RectanglePreview startWorld={draftShape.start} currentWorld={draftShape.current} />
                )}

                {draftShape && draftShape.type === 'ellipse' && (
                    <EllipsePreview startWorld={draftShape.start} currentWorld={draftShape.current} />
                )}

                {draftShape && draftShape.type === 'arrow' && (
                    <ArrowPreview startWorld={draftShape.start} currentWorld={draftShape.current} />
                )}

                {draftShape && draftShape.type === 'line' && (
                    <LinePreview startWorld={draftShape.start} currentWorld={draftShape.current} />
                )}
                {currentTool === 'freedraw' && freeDrawPoints.length > 1 && (
                    <FreeDrawStrokePreview points={freeDrawPoints} />
                )}
            </div>
        </div>
    </>
  )
}

export default InfiniteCanvas