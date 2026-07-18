import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import DisputeMessageList from './DisputeMessageList'
import DisputeMediaPicker, { DisputeMedia } from './DisputeMediaPicker'
import type { Dispute, DisputeMessage, Job } from '../types'
import toast from 'react-hot-toast'

interface Props {
  dispute: Dispute
  job: Job
}

export default function DisputeThread({ dispute, job }: Props) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<DisputeMessage[]>([])
  const [reply, setReply] = useState('')
  const [media, setMedia] = useState<DisputeMedia>({})
  const [submitting, setSubmitting] = useState(false)

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('dispute_messages').select('*').eq('dispute_id', dispute.id).order('created_at', { ascending: true })
    if (data) setMessages(data as DisputeMessage[])
  }, [dispute.id])

  useEffect(() => {
    fetchMessages()
    const channel = supabase.channel(`dispute-messages-${dispute.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dispute_messages', filter: `dispute_id=eq.${dispute.id}` },
        (payload) => setMessages(prev => [...prev, payload.new as DisputeMessage]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [dispute.id, fetchMessages])

  const last = messages[messages.length - 1]
  const canRespond = Boolean(user && last && last.sender_role === 'admin' && last.directed_to === user.id)

  const sendReply = async () => {
    if (!user || !reply.trim()) return toast.error('Please enter a response')
    setSubmitting(true)
    const { error } = await supabase.from('dispute_messages').insert({
      dispute_id: dispute.id,
      sender_id: user.id,
      sender_role: user.role,
      message: reply.trim(),
      photo_url: media.photo_url,
      voice_url: media.voice_url,
      video_url: media.video_url,
    })
    setSubmitting(false)
    if (error) return toast.error('Failed to send response')
    setReply('')
    setMedia({})
    toast.success('Response sent to admin')
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      <p className="text-sm font-semibold text-text-primary">Dispute Remarks</p>
      <DisputeMessageList messages={messages} job={job} />

      {canRespond && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs font-medium text-amber-700">Admin requested more information from you:</p>
          <textarea rows={3} placeholder="Type your response..." value={reply} onChange={e => setReply(e.target.value)}
            className="resize-none" />
          <DisputeMediaPicker pathPrefix={`disputes/${dispute.id}`} media={media} onChange={setMedia} />
          <button onClick={sendReply} disabled={submitting || !reply.trim()}
            className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-medium disabled:opacity-50">
            {submitting ? 'Sending...' : 'Send Response'}
          </button>
        </div>
      )}
    </div>
  )
}
