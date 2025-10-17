import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatWindow } from '@/hooks/use-canvas'
import { cn } from '@/lib/utils'
import { ChatMessage } from '@/redux/slice/chat'
import { Loader2, RefreshCw, Send, Trash2, X } from 'lucide-react'
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
                </div>
                <div className='flex items-center gap-1'>
                    {chatState?.messages && chatState.messages.length > 0 && (
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={handleClearChat}
                            className='h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10'
                        >
                            <Trash2 className='w-4 h-4' />
                        </Button>
                    )}
                    <Button
                        variant='ghost'
                        size='sm'
                        onClick={onClose}
                        className='h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10'
                    >
                        <X className='w-4 h-4' />
                    </Button>
                </div>
                <ScrollArea ref={scrollAreaRef} className='flex-1 p-4 overflow-y-auto'>
                    <div className='space-y-4'>
                        {!chatState?.messages || chatState.messages.length === 0 ? (
                            <div className='text-center text-white/60 py-8'>
                                <RefreshCw className='w-8 h-8 mx-auto mb-2 opacity-50 animate-spin' />
                                <p className='text-sm'>
                                    Start a conversation with the AI to regenerate the design
                                </p>
                                <p className='text-xs mt-1 opacity-75'>
                                    Change color, layout, style, content or more
                                </p>
                            </div>
                        ) : (
                            chatState.messages.map((message: ChatMessage) => (
                                <div key={message.id} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                                    <div className={cn('max-w-[85%] rounded-lg px-3 py-2 text-sm', message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/90 border border-white/20')}>
                                        <div className='whitespace-pre-wrap'>
                                            {message.content}
                                        </div>
                                        <div className={cn('text-xs mt-1 opacity-70 flex items-center gap-1', message.role === 'user' ? 'text-blue-100' : 'text-white/60')}>
                                            {message.isStreaming && (
                                                <Loader2 size={10} className='animate-spin' />
                                            )}
                                            {new Date(message.timestamp).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
                <div className='p-4 border-t border-white/[0.12]'>
                    <div className='space-y-3'>
                        <div className='flex gap-2'>
                            <Input
                                ref={inputRef}
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder='Ask the AI to regenerate the design...'
                                disabled={chatState?.isStreaming}
                                className='flex-1 bg-white/5 border-white/20 text-white placeholder:text-white/50'
                            />
                            <Button
                                onClick={handleSendMessage}
                                disabled={!inputValue.trim() || chatState?.isStreaming}
                                size='sm'
                                className='bg-blue-500 hover:bg-blue-600 text-white'
                            >
                                {chatState?.isStreaming ? (
                                    <Loader2 size={16} className='animate-spin' />
                                ) : (
                                    <Send size={16} />
                                )}
                            </Button>
                        </div>
                        <div className='text-xs text-white/60 text-center'>
                            Request redesign and press enter
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ChatWindow