import { useState, useEffect, useRef } from 'react'
import { IoSend, IoImage, IoMic, IoStop, IoVideocam, IoCloseCircle, IoDownload } from 'react-icons/io5'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'
import type { ChatMessage } from '../types'

interface Props {
  jobId: string
  otherUserName: string
  fullScreen?: boolean
}

export default function ChatWindow({ jobId, otherUserName, fullScreen = false }: Props) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!jobId) return

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages').select('*')
        .eq('job_id', jobId).order('created_at', { ascending: true })
      if (data) setMessages(data as ChatMessage[])
    }
    fetchMessages()

    const channel = supabase
      .channel(`messages-${jobId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `job_id=eq.${jobId}` },
        (payload) => setMessages(prev => [...prev, payload.new as ChatMessage])
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [jobId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  /* ── Send text ── */
  const sendText = async () => {
    if (!text.trim() || !user) return
    const msg = {
      job_id: jobId, sender_id: user.id,
      text: text.trim(), is_customer: user.role === 'customer', read: false,
    }
    setText('')
    const { error } = await supabase.from('messages').insert(msg)
    if (error) toast.error('Failed to send message')
  }

  /* ── Upload helper ── */
  const uploadFile = async (file: Blob, filename: string): Promise<string | null> => {
    const path = `${jobId}/${Date.now()}_${filename}`
    setUploading(true)
    const { error } = await supabase.storage.from('message-media').upload(path, file, { upsert: false })
    setUploading(false)
    if (error) {
      toast.error(`Upload failed: ${error.message}`)
      return null
    }
    const { data: { publicUrl } } = supabase.storage.from('message-media').getPublicUrl(path)
    return publicUrl
  }

  /* ── Send image or video ── */
  const sendMedia = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0]
    e.target.value = ''   // reset so same file can be picked again
    if (!file || !user) return

    const url = await uploadFile(file, file.name)
    if (!url) return

    const payload: Record<string, unknown> = {
      job_id: jobId, sender_id: user.id,
      text: type === 'image' ? '📷 Photo' : '📹 Video',
      is_customer: user.role === 'customer', read: false,
    }
    if (type === 'image') payload.image_url = url
    else payload.video_url = url

    const { error } = await supabase.from('messages').insert(payload)
    if (error) toast.error('Failed to send media')
  }

  /* ── Voice recording ── */
  const toggleRecording = async () => {
    if (recording) {
      mediaRecorder.current?.stop()
      if (recordTimer.current) clearInterval(recordTimer.current)
      setRecording(false)
      setRecordSecs(0)
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Voice recording not supported on this browser')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Pick best supported format
      const mimeType = [
        'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus',
        'audio/mp4', 'audio/mpeg',
      ].find(t => MediaRecorder.isTypeSupported(t)) || ''

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunks.current = []

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data) }

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        if (chunks.current.length === 0) return

        const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm'
        const blob = new Blob(chunks.current, { type: mimeType || 'audio/webm' })
        const url = await uploadFile(blob, `voice_${Date.now()}.${ext}`)
        if (!url || !user) return

        const { error } = await supabase.from('messages').insert({
          job_id: jobId, sender_id: user.id,
          text: '🎤 Voice message',
          voice_url: url,
          is_customer: user.role === 'customer',
          read: false,
        })
        if (error) toast.error('Failed to send voice message')
      }

      mr.start(250) // collect data every 250ms for better streaming
      mediaRecorder.current = mr
      setRecording(true)
      setRecordSecs(0)
      recordTimer.current = setInterval(() => setRecordSecs(s => s + 1), 1000)
    } catch {
      toast.error('Could not access microphone')
    }
  }

  const isOwn = (msg: ChatMessage) => msg.sender_id === user?.id

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <>
      {/* ── Lightbox (image full view) ── */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white" onClick={() => setLightbox(null)}>
            <IoCloseCircle size={32} />
          </button>
          <img src={lightbox} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}

      <div
        className={`flex flex-col bg-white ${fullScreen ? 'flex-1 min-h-0' : 'rounded-card border border-border'}`}
        style={fullScreen ? undefined : { height: 380 }}
      >
        {/* Header — only in inline mode */}
        {!fullScreen && (
          <div className="px-4 py-3 border-b border-border bg-white rounded-t-card flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary">Chat with {otherUserName}</p>
            {uploading && <span className="text-xs text-text-muted animate-pulse">Uploading…</span>}
          </div>
        )}

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-gray-50">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center gap-2 opacity-50">
              <p className="text-3xl">💬</p>
              <p className="text-xs text-text-muted">No messages yet. Say hello!</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${isOwn(msg) ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] rounded-2xl overflow-hidden text-sm shadow-sm ${
                isOwn(msg)
                  ? 'bg-primary text-white rounded-br-md'
                  : 'bg-white text-text-primary rounded-bl-md border border-gray-100'
              }`}>
                {/* Image */}
                {msg.image_url && (
                  <div>
                    <img
                      src={msg.image_url}
                      alt="Photo"
                      className="w-full max-h-52 object-cover cursor-pointer"
                      onClick={() => setLightbox(msg.image_url!)}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                    <div className="px-3 py-1.5">
                      <p className={`text-[10px] ${isOwn(msg) ? 'text-white/60' : 'text-text-muted'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )}
                {/* Video */}
                {msg.video_url && (
                  <div>
                    <video
                      src={msg.video_url}
                      controls
                      className="w-full max-h-52"
                      preload="metadata"
                    />
                    <div className="px-3 py-1.5">
                      <p className={`text-[10px] ${isOwn(msg) ? 'text-white/60' : 'text-text-muted'}`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )}
                {/* Voice */}
                {msg.voice_url && (
                  <div className="px-3 py-2.5 space-y-1.5">
                    <audio src={msg.voice_url} controls className="w-full max-w-[220px] h-9" preload="metadata" />
                    <p className={`text-[10px] ${isOwn(msg) ? 'text-white/60' : 'text-text-muted'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
                {/* Text-only */}
                {!msg.image_url && !msg.video_url && !msg.voice_url && (
                  <div className="px-3 py-2">
                    <p className="leading-relaxed">{msg.text}</p>
                    <p className={`text-[10px] mt-1 ${isOwn(msg) ? 'text-white/60' : 'text-text-muted'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* ── Input bar ── */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100 bg-white">
          {recording ? (
            /* Recording indicator */
            <div className="flex-1 flex items-center gap-2 bg-red-50 rounded-full px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-red-600 font-medium">{fmtTime(recordSecs)}</span>
              <span className="text-xs text-red-500 ml-auto">Recording…</span>
            </div>
          ) : (
            <input
              className="flex-1 !py-2 !rounded-full !text-sm !border-gray-200 !bg-gray-50"
              placeholder="Type a message..."
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendText()}
            />
          )}

          {/* Media buttons (hidden while recording) */}
          {!recording && (
            <>
              <label className={`cursor-pointer transition ${uploading ? 'text-text-muted pointer-events-none' : 'text-text-muted hover:text-primary'}`}>
                <IoImage size={22} />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => sendMedia(e, 'image')} disabled={uploading} />
              </label>
              <label className={`cursor-pointer transition ${uploading ? 'text-text-muted pointer-events-none' : 'text-text-muted hover:text-primary'}`}>
                <IoVideocam size={22} />
                <input type="file" accept="video/*" className="hidden" onChange={(e) => sendMedia(e, 'video')} disabled={uploading} />
              </label>
            </>
          )}

          {/* Mic / Stop */}
          <button
            onClick={toggleRecording}
            className={`transition shrink-0 ${recording ? 'text-red-500 hover:text-red-600' : 'text-text-muted hover:text-primary'}`}
          >
            {recording ? <IoStop size={22} /> : <IoMic size={22} />}
          </button>

          {/* Send (only when not recording and text is not empty) */}
          {!recording && (
            <button
              onClick={sendText}
              disabled={!text.trim() || uploading}
              className="text-primary disabled:text-gray-300 transition shrink-0"
            >
              <IoSend size={20} />
            </button>
          )}

          {/* Uploading indicator */}
          {uploading && (
            <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
          )}
        </div>
      </div>
    </>
  )
}
