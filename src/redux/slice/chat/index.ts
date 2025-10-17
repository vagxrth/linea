import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ChatMessage {
    id: string,
    role: 'user' | 'assistant',
    content: string,
    timestamp: string,
    isStreaming?: boolean
}

export interface GeneratedUIChat {
    generatedUIId: string,
    messages: ChatMessage[]
    isStreaming: boolean
    streamingMessageId: string | null
}

interface ChatState {
    chats: Record<string, GeneratedUIChat>
}

const initialState: ChatState = {
    chats: {}
}

const chatSlice = createSlice({
    name: 'chat',
    initialState,
    reducers: {
        initializeChat: (state, action: PayloadAction<string>) => {
            const generatedUIId = action.payload
            if (!state.chats[generatedUIId]) {
                state.chats[generatedUIId] = {
                    generatedUIId,
                    messages: [],
                    isStreaming: false,
                    streamingMessageId: null
                }
            }
        },
        addUserMessage: (state, action: PayloadAction<{ generatedUIId: string, content: string }>) => {
            const { generatedUIId, content } = action.payload
            const chat = state.chats[generatedUIId]

            if (chat) {
                chat.messages.push({
                    id: `user-${Date.now()}`,
                    role: 'user',
                    content,
                    timestamp: new Date().toISOString(),
                })
            }
        },
        startStreamingResponse: (state, action: PayloadAction<{ generatedUIId: string, messageId: string }>) => {
            const { generatedUIId, messageId } = action.payload
            const chat = state.chats[generatedUIId]

            if (chat) {
                chat.isStreaming = true
                chat.streamingMessageId = messageId

                chat.messages.push({
                    id: messageId,
                    role: 'assistant',
                    content: '',
                    timestamp: new Date().toISOString(),
                    isStreaming: true
                })
            }
        },
        updateStreamingContent: (state, action: PayloadAction<{ generatedUIId: string, messageId: string, content: string }>) => {
            const { generatedUIId, messageId, content } = action.payload
            const chat = state.chats[generatedUIId]

            if (chat) {
                const messageIndex = chat.messages.findIndex((message) => message.id === messageId)

                if (messageIndex !== -1) {
                    chat.messages[messageIndex].content = content
                }
            }
        },
        finishedStreamingResponse: (state, action: PayloadAction<{ generatedUIId: string, messageId: string, finalContent: string }>) => {
            const { generatedUIId, messageId, finalContent } = action.payload
            const chat = state.chats[generatedUIId]

            if (chat) {
                chat.isStreaming = false
                chat.streamingMessageId = null

                const messageIndex = chat.messages.findIndex((message) => message.id === messageId)

                if (messageIndex !== -1) {
                    chat.messages[messageIndex].content = finalContent
                    chat.messages[messageIndex].isStreaming = false
                }
            }
        },
        addErrorMessage: (state, action: PayloadAction<{ generatedUIId: string, error: string }>) => {
            const { generatedUIId, error } = action.payload
            const chat = state.chats[generatedUIId]

            if (chat) {
                chat.isStreaming = false
                chat.streamingMessageId = null

                chat.messages.push({
                    id: `error-${Date.now()}`,
                    role: 'assistant',
                    content: `An error occurred while generating the response: ${error}`,
                    timestamp: new Date().toISOString(),
                })
            }
        },
        clearChat: (state, action: PayloadAction<string>) => {
            const generatedUIId = action.payload
            if (state.chats[generatedUIId]) {
                state.chats[generatedUIId].messages = []
                state.chats[generatedUIId].isStreaming = false
                state.chats[generatedUIId].streamingMessageId = null
            }
        },
        removeChat: (state, action: PayloadAction<string>) => {
            const generatedUIId = action.payload
            delete state.chats[generatedUIId]
        }
    }
})

export const {
    initializeChat,
    addUserMessage,
    startStreamingResponse,
    updateStreamingContent,
    finishedStreamingResponse,
    addErrorMessage,
    clearChat,
    removeChat
} = chatSlice.actions

export default chatSlice.reducer