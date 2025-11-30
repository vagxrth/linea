'use client'

import { Redo2, Undo2 } from 'lucide-react'
import React from 'react'
import { useAppDispatch, useAppSelector } from '@/redux/store'
import { undo, redo } from '@/redux/slice/shapes'
import { cn } from '@/lib/utils'

const History = () => {
  const dispatch = useAppDispatch()
  const canUndo = useAppSelector((state) => state.shapes.past.length > 0)
  const canRedo = useAppSelector((state) => state.shapes.future.length > 0)

  const handleUndo = () => {
    if (canUndo) {
      dispatch(undo())
    }
  }

  const handleRedo = () => {
    if (canRedo) {
      dispatch(redo())
    }
  }

  return (
    <div className='col-span-1 flex justify-start items-center'>
        <div className='inline-flex items-center rounded-full backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] p-2 text-neutral-300 saturate-150'>
            <span
              onClick={handleUndo}
              className={cn(
                'inline-grid h-9 w-9 place-items-center rounded-full transition-all',
                canUndo
                  ? 'hover:bg-white/[0.12] cursor-pointer'
                  : 'opacity-40 cursor-not-allowed'
              )}
            >
                <Undo2 size={18} className='opacity-80 stroke-[1.75]'/>
            </span>

            <span className='mx-1 h-5 w-px rounded bg-white/[0.16]' />

            <span
              onClick={handleRedo}
              className={cn(
                'inline-grid h-9 w-9 place-items-center rounded-full transition-all',
                canRedo
                  ? 'hover:bg-white/[0.12] cursor-pointer'
                  : 'opacity-40 cursor-not-allowed'
              )}
            >
                <Redo2 size={18} className='opacity-80 stroke-[1.75]'/>
            </span>
        </div>
    </div>
  )
}

export default History
