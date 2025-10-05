import Toolbar from '@/components/toolbar'
import React from 'react'

type Props = {
    children: React.ReactNode
}

const layout = ({ children }: Props) => {
  return (
    <div className='w-full h-screen'>
        {children}
        <Toolbar />
    </div>
  )
}

export default layout