import { Shape } from '@/redux/slice/shapes'
import React from 'react'
import { Frame } from '../shapes/frame'
import { Rectangle } from '../shapes/rectangle'
import { Ellipse } from '../shapes/ellipse'
import { Line } from '../shapes/line'
import { Arrow } from '../shapes/arrow'
import { Stroke } from '../shapes/stroke'
import { Text } from '../shapes/text'

const ShapeRenderer = ({
    shape,
    toggleInspiration,
    toggleChat,
    generateWorkflow,
    exportDesign
} : {
    shape: Shape,
    toggleInspiration: () => void,
    toggleChat: (generatedUIID: string) => void,
    generateWorkflow: (generatedUIID: string) => void,
    exportDesign: (generatedUIID: string, element: HTMLElement | null) => void
}) => {
  switch (shape.type) {
    case 'frame':
        return <Frame shape={shape} toggleInspiration={toggleInspiration}/>
    case 'rect':
        return <Rectangle shape={shape}/>
    case 'ellipse':
        return <Ellipse shape={shape}/>
    case 'freedraw':
        return <Stroke shape={shape}/>
    case 'arrow':
        return <Arrow shape={shape}/>
    case 'line':
        return <Line shape={shape}/>
    case 'text':
        return <Text shape={shape}/>
  }
}

export default ShapeRenderer