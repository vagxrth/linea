import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'
import React from 'react'

type Props = {
    generatedUIId: string,
    isOpen: boolean,
    onClose: () => void,
}

const ChatWindow = ({ generatedUIId, isOpen, onClose }: Props) => {

    const {
        inputValue,
        setInputValue,
        scrollAreaRef,
        inputRef,
        handleSendMessage,
        handleKeyPress,
        handleClearChat,
        chatState,
    } = useChatWindow(generatedUIId, isOpen)

    if (!isOpen) return null

  return (
    <div className={cn('fixed right-5 top-1/2 transform -translate-y-1/2 w-96 h-[600px] backdrop-blur-xl bg-white/[0.08] border-white/[0.12] border rounded-lg z-50 transition-all duration-300 flex flex-col', 
        isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    )}>
        <div className='flex items-center justify-between p-4 border-b border-white/[0.12]'>
            <div className='flex items-center gap-2'>
                <RefreshCw className='w-5 h-5 text-white/80' />
                <Label className='text-white/80 font-medium'>AI Chat</Label>
                <div className='flex items-center gap-1'>

                </div>
            </div>
        </div>
    </div>
  )
}

export default ChatWindow