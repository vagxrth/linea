import React from 'react'
import History from '../history'
import Zoom from '../zoom'
import ToolbarShapes from '../shapes'

const Toolbar = () => {
  return (
    <div className='fixed bottom-0 w-full grid grid-cols-3 z-50 p-5'>
        <History />
        <ToolbarShapes />
        <Zoom />
    </div>
  )
}

export default Toolbar