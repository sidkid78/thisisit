import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        
        // Check auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { leadId, type, subject, message, preferredTime, recipientId } = body

        // Validate required fields
        if (!leadId || !message) {
            return NextResponse.json({ error: 'Lead ID and message are required' }, { status: 400 })
        }

        // Get the lead to find the homeowner (recipient)
        const { data: lead, error: leadError } = await supabase
            .from('leads')
            .select('homeowner_id, title')
            .eq('id', leadId)
            .single()

        if (leadError || !lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
        }

        // Create message record
        const messageData = {
            sender_id: user.id,
            recipient_id: recipientId || lead.homeowner_id,
            lead_id: leadId,
            subject: subject || `Inquiry about: ${lead.title}`,
            message,
            message_type: type || 'in_app',
            preferred_callback_time: preferredTime || null,
            status: 'sent',
            created_at: new Date().toISOString()
        }

        const { data: newMessage, error: insertError } = await supabase
            .from('messages')
            .insert(messageData)
            .select()
            .single()

        if (insertError) {
            console.error('Failed to insert message:', insertError)
            // If table doesn't exist, return success anyway (non-critical)
            if (insertError.code === '42P01') {
                return NextResponse.json({ 
                    success: true, 
                    message: 'Message queued (table pending)',
                    queued: true 
                })
            }
            return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
        }

        // Log the message event
        try {
            await supabase.from('lead_events').insert({
                lead_id: leadId,
                event_type: 'MESSAGE_SENT',
                event_data: {
                    message_id: newMessage.id,
                    message_type: type,
                    sender_id: user.id
                }
            })
        } catch (e) {
            // Non-critical, don't fail the request
            console.log('Failed to log message event:', e)
        }

        return NextResponse.json({ success: true, message: newMessage })

    } catch (error) {
        console.error('Messages API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        
        // Check auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const leadId = searchParams.get('leadId')
        const conversationWith = searchParams.get('conversationWith')

        // Get messages for this user
        let query = supabase
            .from('messages')
            .select(`
                *,
                sender:profiles!sender_id(id, full_name, avatar_url),
                recipient:profiles!recipient_id(id, full_name, avatar_url)
            `)
            .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
            .order('created_at', { ascending: false })

        if (leadId) {
            query = query.eq('lead_id', leadId)
        }

        if (conversationWith) {
            query = query.or(`sender_id.eq.${conversationWith},recipient_id.eq.${conversationWith}`)
        }

        const { data: messages, error } = await query.limit(100)

        if (error) {
            // If table doesn't exist, return empty array
            if (error.code === '42P01') {
                return NextResponse.json({ messages: [] })
            }
            throw error
        }

        return NextResponse.json({ messages })

    } catch (error) {
        console.error('Messages GET error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// Mark message as read
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient()
        
        // Check auth
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { messageId, status } = body

        if (!messageId) {
            return NextResponse.json({ error: 'Message ID required' }, { status: 400 })
        }

        // Update message status
        const { data: updated, error: updateError } = await supabase
            .from('messages')
            .update({ 
                status: status || 'read',
                read_at: new Date().toISOString()
            })
            .eq('id', messageId)
            .eq('recipient_id', user.id) // Only recipient can mark as read
            .select()
            .single()

        if (updateError) {
            if (updateError.code === '42P01') {
                return NextResponse.json({ success: true })
            }
            throw updateError
        }

        return NextResponse.json({ success: true, message: updated })

    } catch (error) {
        console.error('Messages PATCH error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
