import React from 'react'
import History from '../history'
import Zoom from '../zoom'
import ToolbarShapes from '../toolbar-shapes'

const Toolbar = () => {
  return (
    // Phones: the tools get a row of their own, above undo/redo and zoom. Wider: one row, tools
    // centered. The bar takes no clicks itself, so the canvas under its empty space still works.
    // Its pills, like the navigation bar's and the side panels, are dark glass rather than the
    // light glass used elsewhere, so their icons stay legible over a light design beneath.
    <div className='pointer-events-none fixed inset-x-0 bottom-0 z-50 grid grid-cols-2 items-center gap-3 p-3 [grid-template-areas:"tools_tools"_"history_zoom"] sm:p-5 md:grid-cols-[1fr_auto_1fr] md:[grid-template-areas:"history_tools_zoom"]'>
        <div className='[grid-area:history]'>
            <History />
        </div>
        <div className='min-w-0 [grid-area:tools]'>
            <ToolbarShapes />
        </div>
        <div className='[grid-area:zoom]'>
            <Zoom />
        </div>
    </div>
  )
}

export default Toolbar