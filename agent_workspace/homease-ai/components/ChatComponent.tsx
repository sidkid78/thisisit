'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

type Message = {
    id: string
    sender_id: string
    content: string
    created_at: string
    read_at: string | null
}

type ChatProps = {
    projectId: string
    currentUserId: string
    otherUserName: string
}

export default function ChatComponent({ projectId, currentUserId, otherUserName }: ChatProps) {
    const supabase = createClient()
    const [messages, setMessages] = useState<Message[]>([])
    const [newMessage, setNewMessage] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isSending, setIsSending] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const channelRef = useRef<RealtimeChannel | null>(null)

    // Load initial messages
    useEffect(() => {
        const loadMessages = async () => {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: true })

            if (!error && data) {
                setMessages(data)
            }
            setIsLoading(false)
        }

        loadMessages()
    }, [projectId, supabase])

    // Set up realtime subscription
    useEffect(() => {
        channelRef.current = supabase
            .channel(`messages:${projectId}`)
            .on<Message>(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `project_id=eq.${projectId}`
                },
                (payload) => {
                    setMessages(prev => [...prev, payload.new])
                }
            )
            .subscribe()

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current)
            }
        }
    }, [projectId, supabase])

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const sendMessage = async () => {
        if (!newMessage.trim() || isSending) return

        setIsSending(true)
        const { error } = await supabase.from('messages').insert({
            project_id: projectId,
            sender_id: currentUserId,
            content: newMessage.trim()
        })

        if (!error) {
            setNewMessage('')
        }
        setIsSending(false)
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    if (isLoading) {
        return (
            <div className="h-64 flex items-center justify-center text-gray-500 dark:text-slate-400">
                Loading messages...
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold">
                        {otherUserName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="font-medium text-gray-900 dark:text-white">{otherUserName}</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">Chat</div>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div className="h-80 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-slate-900/30">
                {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-400 dark:text-slate-500 text-sm">
                        No messages yet. Start the conversation!
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[70%] px-4 py-2 rounded-2xl ${msg.sender_id === currentUserId
                                        ? 'bg-blue-500 text-white rounded-br-sm'
                                        : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white rounded-bl-sm'
                                    }`}
                            >
                                <p className="text-sm">{msg.content}</p>
                                <p className={`text-xs mt-1 ${msg.sender_id === currentUserId ? 'opacity-60' : 'text-gray-500 dark:text-slate-400'}`}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-slate-700">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type a message..."
                        className="flex-1 px-4 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-full focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-500"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || isSending}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors text-white"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}
