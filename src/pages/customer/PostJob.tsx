import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IoArrowBack, IoCamera, IoCalendar, IoTime, IoLocation,
  IoMic, IoStop, IoPlay, IoPause, IoTrash, IoVideocam, IoClose,
} from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { SERVICE_CATEGORIES } from '../../types'
import LocationPicker from '../../components/LocationPicker'
import LocationAutocomplete from '../../components/LocationAutocomplete'
import toast from 'react-hot-toast'
import { validateJobBudget, validateJobDescription, validateJobTitle, validateVoiceNote, validateMediaItems, validateJobDate } from '../../lib/validation'

interface MediaItem {
  file: File
  preview: string
  type: 'image' | 'video'
}

function formatDuration(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

async function compressImage(file: File, maxPx = 1280, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        blob => resolve(blob ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }) : file),
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

export default function PostJob() {
  const nav = useNavigate()
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [budget, setBudget] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [showMap, setShowMap] = useState(false)
  const [loading, setLoading] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null)
  const [voicePreviewUrl, setVoicePreviewUrl] = useState('')
  const [isPlayingVoice, setIsPlayingVoice] = useState(false)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl)
      mediaItems.forEach(m => URL.revokeObjectURL(m.preview))
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setVoiceBlob(blob)
        setVoicePreviewUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingDuration(0)
      timerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000)
    } catch {
      toast.error('Microphone access denied')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const togglePlayVoice = () => {
    if (!voicePreviewUrl) return
    if (!audioRef.current) {
      audioRef.current = new Audio(voicePreviewUrl)
      audioRef.current.onended = () => setIsPlayingVoice(false)
    }
    if (isPlayingVoice) {
      audioRef.current.pause()
      setIsPlayingVoice(false)
    } else {
      audioRef.current.play()
      setIsPlayingVoice(true)
    }
  }

  const deleteVoice = () => {
    audioRef.current?.pause()
    audioRef.current = null
    if (voicePreviewUrl) URL.revokeObjectURL(voicePreviewUrl)
    setVoiceBlob(null)
    setVoicePreviewUrl('')
    setIsPlayingVoice(false)
    setRecordingDuration(0)
  }

  const addMedia = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0]
    if (!file) return
    // Replace any existing item of the same type (1 image + 1 video max)
    setMediaItems(prev => {
      const existing = prev.find(m => m.type === type)
      if (existing) URL.revokeObjectURL(existing.preview)
      const filtered = prev.filter(m => m.type !== type)
      return [...filtered, { file, preview: URL.createObjectURL(file), type }]
    })
    e.target.value = ''
  }

  const removeMedia = (index: number) => {
    setMediaItems(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleLocationPick = useCallback(
    (lat: number, lng: number, address: string) => {
      setLatitude(lat)
      setLongitude(lng)
      const shortened = address.split(',').slice(0, 4).join(',').trim()
      setLocation(shortened)
    },
    []
  )

  const handleSubmit = async () => {
    const err =
      validateJobTitle(title) ||
      validateJobDescription(description) ||
      validateJobBudget(budget) ||
      validateVoiceNote(voiceBlob, { required: true }) ||
      (!mediaItems.find(m => m.type === 'image') ? 'Please add a photo showing the problem' : null) ||
      validateJobDate(date)
    if (err) return toast.error(err)
    if (!category) return toast.error('Please select a category')
    if (!location.trim()) return toast.error('Please enter a location')
    if (!user) return
    setLoading(true)

    try {
      const ts = Date.now()

      // Parallelize all media uploads (images are compressed first to reduce upload size/time)
      const mediaUploadTasks = mediaItems.map(async (item, i) => {
        const fileToUpload = item.type === 'image' ? await compressImage(item.file) : item.file
        const ext = item.type === 'video' ? 'mp4' : 'jpg'
        const prefix = item.type === 'video' ? 'video' : 'img'
        const path = `jobs/${prefix}_${user.id}_${ts}_${i}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('job-images')
          .upload(path, fileToUpload, { contentType: item.type === 'image' ? 'image/jpeg' : undefined })
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
        return supabase.storage.from('job-images').getPublicUrl(path).data.publicUrl
      })

      // Parallelize voice upload alongside media
      const voiceUploadTask = voiceBlob
        ? (async () => {
            const voiceFile = new File([voiceBlob], `voice_${ts}.webm`, { type: 'audio/webm' })
            const path = `voices/${user.id}_${ts}.webm`
            await supabase.storage.from('job-images').upload(path, voiceFile)
            return supabase.storage.from('job-images').getPublicUrl(path).data.publicUrl
          })()
        : Promise.resolve('')

      const [uploadedUrls, voiceNoteUrl] = await Promise.all([
        Promise.all(mediaUploadTasks),
        voiceUploadTask,
      ])

      let imageUrlValue: string | null = null
      if (uploadedUrls.length === 1) imageUrlValue = uploadedUrls[0]
      else if (uploadedUrls.length > 1) imageUrlValue = JSON.stringify(uploadedUrls)

      const { error } = await supabase.from('jobs').insert({
        title,
        description,
        category,
        location,
        latitude: latitude || null,
        longitude: longitude || null,
        budget: Number(budget),
        date: date || null,
        time: time || null,
        image_url: imageUrlValue,
        voice_note_url: voiceNoteUrl || null,
        status: 'pending',
        city: user.city || null,
        customer_id: user.id,
        customer_name: user.name,
        customer_photo: user.profile_photo_url || null,
      })

      if (error) return toast.error(error.message)
      toast.success('Job posted!')
      nav('/customer/home')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      <div className="bg-primary px-6 pt-10 pb-5 rounded-b-3xl shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={() => nav(-1)}>
            <IoArrowBack size={24} className="text-white" />
          </button>
          <h1 className="text-white text-xl font-medium">Post a Job</h1>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">
              Job Title *
            </label>
            <input
              placeholder="e.g. Fix leaking tap"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">
              Category *
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className={!category ? 'text-text-muted' : ''}
            >
              <option value="">Select category</option>
              {SERVICE_CATEGORIES.map(c => (
                <option key={c.name} value={c.name}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">
              Description *
            </label>
            <textarea
              rows={3}
              placeholder="Describe the problem in detail..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="resize-none"
            />
          </div>
        </div>

        {/* Voice Note */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <label className="text-sm font-medium text-text-primary mb-3 block">
            Voice Note <span className="text-red-500">*</span> <span className="text-text-muted font-normal">(Explain the problem)</span>
          </label>
          {voiceBlob ? (
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-border">
              <button
                onClick={togglePlayVoice}
                className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0"
              >
                {isPlayingVoice ? (
                  <IoPause size={18} className="text-white" />
                ) : (
                  <IoPlay size={18} className="text-white ml-0.5" />
                )}
              </button>
              <div className="flex-1">
                <div className="h-1.5 bg-primary/20 rounded-full">
                  <div className="h-1.5 bg-primary rounded-full" style={{ width: '40%' }} />
                </div>
                <p className="text-xs text-text-muted mt-1">{formatDuration(recordingDuration)}</p>
              </div>
              <button
                onClick={deleteVoice}
                className="p-2 text-red-400 hover:text-red-600 transition"
              >
                <IoTrash size={18} />
              </button>
            </div>
          ) : isRecording ? (
            <div className="flex items-center gap-3 bg-red-50 rounded-xl p-3 border border-red-200">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse shrink-0" />
              <p className="flex-1 text-sm font-medium text-red-600">
                {formatDuration(recordingDuration)}
              </p>
              <button
                onClick={stopRecording}
                className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center"
              >
                <IoStop size={18} className="text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={startRecording}
              className="w-full flex items-center justify-center gap-2 border border-primary text-primary rounded-xl py-3 text-sm font-medium hover:bg-primary/5 transition"
            >
              <IoMic size={18} /> Record Voice Note
            </button>
          )}
        </div>

        {/* Attachments — Multiple Photos & Videos */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <label className="text-sm font-medium text-text-primary mb-3 block">
            Attachments{' '}
            <span className="text-red-500">*</span> <span className="text-text-muted font-normal">(Please show the problem)</span>
          </label>
          {/* Preview row */}
          {mediaItems.length > 0 && (
            <div className="flex gap-3 mb-3">
              {mediaItems.map((item, i) => (
                <div key={i} className="relative flex-1 rounded-xl overflow-hidden border border-border" style={{ aspectRatio: '4/3' }}>
                  {item.type === 'image' ? (
                    <img src={item.preview} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <video src={item.preview} className="w-full h-full object-cover" preload="metadata" />
                  )}
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md">
                    {item.type === 'image' ? '📷 Photo' : '🎥 Video'}
                  </div>
                  <button
                    onClick={() => removeMedia(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center"
                  >
                    <IoClose size={14} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Upload buttons — hide each once added */}
          <div className="flex gap-3">
            {!mediaItems.find(m => m.type === 'image') && (
              <label className="flex-1 cursor-pointer">
                <div className="h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-primary/40 hover:bg-primary/5 transition">
                  <IoCamera size={22} className="text-text-muted" />
                  <p className="text-[11px] text-text-muted font-medium">Add Photo <span className="text-red-500">*</span></p>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={e => addMedia(e, 'image')} />
              </label>
            )}
            {!mediaItems.find(m => m.type === 'video') && (
              <label className="flex-1 cursor-pointer">
                <div className="h-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-primary/40 hover:bg-primary/5 transition">
                  <IoVideocam size={22} className="text-text-muted" />
                  <p className="text-[11px] text-text-muted font-medium">Add Video <span className="text-text-muted">(optional)</span></p>
                </div>
                <input type="file" accept="video/*" className="hidden" onChange={e => addMedia(e, 'video')} />
              </label>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <label className="text-sm font-medium text-text-primary mb-1.5 block">Location *</label>
          <LocationAutocomplete
            value={location}
            onChange={setLocation}
            onSelect={handleLocationPick}
            placeholder="Enter area or address (e.g., DHA Lahore, Gulshan Karachi)"
          />
          <button
            type="button"
            onClick={() => setShowMap(v => !v)}
            className="mt-2 text-xs text-primary font-medium flex items-center gap-1"
          >
            📍 {showMap ? 'Hide map' : 'Pick on map'}
          </button>
          {showMap && (
            <div className="mt-3">
              <LocationPicker
                onSelect={handleLocationPick}
                initialPosition={
                  latitude && longitude ? [latitude, longitude] : undefined
                }
              />
            </div>
          )}
        </div>

        {/* Budget + Date/Time */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">
              Budget (PKR) *
            </label>
            <input
              type="number"
              placeholder="e.g. 2500"
              value={budget}
              onChange={e => setBudget(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 flex items-center gap-1">
                <IoCalendar size={14} /> Date
              </label>
              <input type="date" value={date} min={new Date().toISOString().split('T')[0]} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-text-primary mb-1.5 flex items-center gap-1">
                <IoTime size={14} /> Time
              </label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
        </div>

        <button onClick={handleSubmit} disabled={loading} className="btn-primary">
          {loading ? 'Posting...' : 'Post Job'}
        </button>
      </div>
    </div>
  )
}
