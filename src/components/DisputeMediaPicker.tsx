import { useRef, useState } from 'react'
import { IoImage, IoMic, IoStop, IoVideocam, IoCloseCircle } from 'react-icons/io5'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export interface DisputeMedia {
  photo_url?: string
  voice_url?: string
  video_url?: string
}

interface Props {
  pathPrefix: string
  media: DisputeMedia
  onChange: (media: DisputeMedia) => void
  requireVoiceVideo?: boolean
}

export default function DisputeMediaPicker({ pathPrefix, media, onChange, requireVoiceVideo }: Props) {
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const uploadFile = async (file: Blob, filename: string): Promise<string | null> => {
    const path = `${pathPrefix}/${Date.now()}_${filename}`
    setUploading(true)
    const { error } = await supabase.storage.from('message-media').upload(path, file, { upsert: false })
    setUploading(false)
    if (error) { toast.error(`Upload failed: ${error.message}`); return null }
    const { data: { publicUrl } } = supabase.storage.from('message-media').getPublicUrl(path)
    return publicUrl
  }

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video') => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = await uploadFile(file, file.name)
    if (!url) return
    onChange({ ...media, [type === 'photo' ? 'photo_url' : 'video_url']: url })
  }

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorder.current?.stop()
      if (recordTimer.current) clearInterval(recordTimer.current)
      setRecording(false)
      setRecordSecs(0)
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) { toast.error('Voice recording not supported on this browser'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = [
        'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/mpeg',
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
        if (!url) return
        onChange({ ...media, voice_url: url })
      }
      mediaRecorder.current = mr
      mr.start()
      setRecording(true)
      recordTimer.current = setInterval(() => setRecordSecs(s => s + 1), 1000)
    } catch {
      toast.error('Could not access microphone')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <label className={`cursor-pointer flex items-center gap-1.5 text-xs font-medium ${uploading ? 'text-text-muted pointer-events-none' : 'text-text-secondary hover:text-primary'}`}>
          <IoImage size={18} /> Photo
          <input type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e, 'photo')} disabled={uploading} />
        </label>
        <label className={`cursor-pointer flex items-center gap-1.5 text-xs font-medium ${uploading ? 'text-text-muted pointer-events-none' : 'text-text-secondary hover:text-primary'}`}>
          <IoVideocam size={18} /> Video{requireVoiceVideo ? ' *' : ''}
          <input type="file" accept="video/*" className="hidden" onChange={(e) => pickFile(e, 'video')} disabled={uploading} />
        </label>
        <button type="button" onClick={toggleRecording} disabled={uploading}
          className={`flex items-center gap-1.5 text-xs font-medium ${recording ? 'text-red-500' : 'text-text-secondary hover:text-primary'}`}>
          {recording ? <IoStop size={18} /> : <IoMic size={18} />}
          {recording ? `Stop (${recordSecs}s)` : `Voice Note${requireVoiceVideo ? ' *' : ''}`}
        </button>
        {uploading && <span className="text-xs text-text-muted animate-pulse">Uploading…</span>}
      </div>

      {(media.photo_url || media.video_url || media.voice_url) && (
        <div className="flex flex-wrap gap-2">
          {media.photo_url && (
            <div className="relative">
              <img src={media.photo_url} className="w-14 h-14 rounded-lg object-cover border border-border" alt="attached" />
              <button type="button" onClick={() => onChange({ ...media, photo_url: undefined })}
                className="absolute -top-1.5 -right-1.5 bg-white rounded-full"><IoCloseCircle size={16} className="text-red-500" /></button>
            </div>
          )}
          {media.video_url && (
            <div className="relative flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2 py-1.5">
              <IoVideocam size={14} className="text-text-secondary" />
              <span className="text-xs text-text-secondary">Video attached</span>
              <button type="button" onClick={() => onChange({ ...media, video_url: undefined })}><IoCloseCircle size={14} className="text-red-500" /></button>
            </div>
          )}
          {media.voice_url && (
            <div className="relative flex items-center gap-1.5 bg-surface border border-border rounded-lg px-2 py-1.5">
              <IoMic size={14} className="text-text-secondary" />
              <span className="text-xs text-text-secondary">Voice note attached</span>
              <button type="button" onClick={() => onChange({ ...media, voice_url: undefined })}><IoCloseCircle size={14} className="text-red-500" /></button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
