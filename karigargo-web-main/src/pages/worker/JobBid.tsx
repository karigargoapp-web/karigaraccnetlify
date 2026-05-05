import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import { IoArrowBack, IoLocation, IoCalendar, IoWarning, IoChatbubble, IoNavigate, IoCash, IoPerson } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Job, Bid } from '../../types'
import { parseMediaUrls, isVideoUrl } from '../../utils/media'
import toast from 'react-hot-toast'

/* ── Job location pin icon — Google Maps style ── */
const jobPin = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 24 36">
    <path fill="#34A853" d="M12 0C7.6 0 4 3.6 4 8c0 5.3 8 18 8 18S20 13.3 20 8c0-4.4-3.6-8-8-8z"/>
    <circle fill="white" cx="12" cy="8" r="4"/>
  </svg>`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -40],
})

/* ── Google Maps URL ── */
const mapsUrl = (job: Job) =>
  job.latitude && job.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`
    : `https://maps.google.com/maps?q=${encodeURIComponent(job.location)}`

export default function JobBid() {
  const nav = useNavigate()
  const { jobId } = useParams()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [existingBid, setExistingBid] = useState<Bid | null>(null)
  const [inspectionCharge, setInspectionCharge] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDirDialog, setShowDirDialog] = useState(false)

  useEffect(() => {
    if (!jobId || !user) return
    Promise.all([
      supabase.from('jobs').select('*').eq('id', jobId).single(),
      supabase.from('bids').select('*').eq('job_id', jobId).eq('worker_id', user.id).maybeSingle(),
    ]).then(([jobRes, bidRes]) => {
      if (jobRes.data) setJob(jobRes.data as Job)
      if (bidRes.data) setExistingBid(bidRes.data as Bid)
    })
  }, [jobId, user])

  const chargeNum = Number(inspectionCharge)
  const overMax = chargeNum > 300

  const handleSubmit = async () => {
    if (!inspectionCharge || overMax)
      return toast.error(overMax ? 'Maximum inspection charge is PKR 300' : 'Enter inspection charge')
    if (!user || !job) return
    setLoading(true)

    try {
      /* Capture worker's current GPS — hard 5 s wall-clock limit covers the
         permission prompt too (browser's own `timeout` only starts after grant) */
      let workerLat: number | null = null
      let workerLng: number | null = null
      try {
        const gps = new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, {
            timeout: 5000,
            enableHighAccuracy: true,
            maximumAge: 0,
          })
        )
        const wall = new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error('gps-wall')), 5000)
        )
        const pos = await Promise.race([gps, wall])
        workerLat = pos.coords.latitude
        workerLng = pos.coords.longitude
      } catch { /* denied or timed out — bid still proceeds */ }

      const { data: wp } = await supabase
        .from('worker_profiles').select('avg_rating, skills')
        .eq('user_id', user.id).maybeSingle()

      const { error } = await supabase.from('bids').insert({
        job_id: job.id,
        worker_id: user.id,
        worker_name: user.name,
        worker_photo: user.profile_photo_url || null,
        skill: wp?.skills?.[0] || job.category,
        inspection_charges: chargeNum,
        message: message.trim() || null,
        rating: wp?.avg_rating || 0,
        verified: user.verified,
        status: 'pending',
        worker_lat: workerLat,
        worker_lng: workerLng,
      })

      if (error) { toast.error(error.message); return }
      toast.success('Bid submitted!')
      nav('/worker/my-bids')
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit bid')
    } finally {
      setLoading(false)
    }
  }

  if (!job) return (
    <div className="min-h-screen flex items-center justify-center bg-surface text-sm text-text-muted">Loading...</div>
  )

  const hasCoords = Boolean(job.latitude && job.longitude)

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex flex-col">
      {/* Green header */}
      <div className="bg-primary px-6 pt-10 pb-5 rounded-b-3xl shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => nav(-1)}><IoArrowBack size={24} className="text-white" /></button>
            <h1 className="text-white text-xl font-medium">Job Details</h1>
          </div>
          <button
            onClick={() => nav(`/chat/${jobId}`)}
            className="flex items-center gap-1.5 bg-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-xl"
          >
            <IoChatbubble size={14} /> Chat
          </button>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">
        {/* Job title + description */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <h2 className="text-lg font-semibold text-text-primary flex-1">{job.title}</h2>
            <span className="shrink-0 px-2.5 py-1 rounded-xl bg-primary/10 text-primary text-xs font-semibold">{job.category}</span>
          </div>
          <p className="text-sm text-text-secondary">{job.description}</p>
          {(() => {
            const urls = parseMediaUrls(job.image_url)
            if (urls.length === 0) return null
            const imageUrl = urls.find(u => !isVideoUrl(u))
            const videoUrl = urls.find(u => isVideoUrl(u))
            return (
              <div className="mt-3 space-y-2">
                {imageUrl && <img src={imageUrl} alt="" className="w-full h-48 object-cover rounded-xl" />}
                {videoUrl && <video src={videoUrl} controls className="w-full h-48 rounded-xl" preload="metadata" />}
              </div>
            )
          })()}
          {job.voice_note_url && (
            <div className="mt-3 bg-gray-50 rounded-xl p-3 border border-border">
              <p className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-1">🎤 Voice Note from Customer</p>
              <audio src={job.voice_note_url} controls className="w-full h-9" preload="metadata" />
            </div>
          )}
        </div>

        {/* Detail rows with colored icon circles — like old JobDetail.tsx */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <IoLocation size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Location</p>
              <p className="text-sm font-medium text-text-primary">{job.location}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
              <IoCalendar size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Date</p>
              <p className="text-sm font-medium text-text-primary">{job.date ? new Date(job.date).toLocaleDateString() : 'Flexible'}{job.time && ` · ${job.time}`}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <IoCash size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-xs text-text-muted">Budget</p>
              <p className="text-sm font-semibold text-primary">PKR {Number(job.budget).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Customer details card */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm font-semibold text-text-primary mb-3">Customer Details</p>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-lg">{job.customer_name?.[0] || 'C'}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">{job.customer_name}</p>
              <p className="text-xs text-text-muted">Posted today</p>
            </div>
          </div>
        </div>

        {/* ── Job Location Map ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
              <IoLocation className="text-primary" size={16} /> Job Location
            </p>
            <button
              onClick={() => setShowDirDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-xl active:scale-[0.97] transition"
            >
              <IoNavigate size={14} /> Get Directions
            </button>
          </div>

          {hasCoords ? (
            <div style={{ height: 200 }}>
              <MapContainer
                center={[job.latitude!, job.longitude!]}
                zoom={14}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                scrollWheelZoom={false}
                attributionControl={false}
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' />
                <Marker position={[job.latitude!, job.longitude!]} icon={jobPin} />
              </MapContainer>
            </div>
          ) : (
            <div className="mx-4 mb-4 bg-gray-50 rounded-xl px-4 py-6 text-center">
              <p className="text-2xl mb-1">📍</p>
              <p className="text-sm text-text-secondary">{job.location}</p>
              <p className="text-xs text-text-muted mt-1">Customer didn't pin exact location</p>
            </div>
          )}

          <div className="px-4 pb-4">
            <p className="text-xs text-text-muted mt-1 truncate">📍 {job.location}</p>
          </div>
        </div>

        {/* Inspection-only reminder */}
        <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <span className="text-lg shrink-0">💡</span>
          <div>
            <p className="text-xs text-amber-900 font-semibold">Bidding Phase — Inspection Charges Only</p>
            <p className="text-xs text-amber-800 mt-0.5 italic">
              Work charges will be finalized after checking the work.
            </p>
          </div>
        </div>

        {/* Bid form or existing bid */}
        {existingBid ? (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm font-semibold text-text-primary mb-3">Your Bid</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Inspection Charge</span>
                <span className="font-medium">PKR {existingBid.inspection_charges}</span>
              </div>
              {existingBid.message && (
                <p className="text-sm text-text-secondary mt-1">{existingBid.message}</p>
              )}
              <div className="mt-3">
                <span className={
                  existingBid.status === 'accepted' ? 'pill-active' :
                  existingBid.status === 'rejected' ? 'pill-rejected' : 'pill-pending'
                }>
                  {existingBid.status.charAt(0).toUpperCase() + existingBid.status.slice(1)}
                </span>
              </div>
              {existingBid.status === 'accepted' && (
                <button onClick={() => nav(`/worker/active-job/${job.id}`)} className="btn-primary !mt-4">
                  Go to Active Job →
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm font-semibold text-text-primary mb-4">Place Your Bid</p>
            <div className="space-y-4">
              {/* Inspection charge */}
              <div>
                <label className="text-sm font-medium text-text-primary mb-2 block">Inspection Charges (PKR) *</label>
                <div className="flex items-center border border-border rounded-xl overflow-hidden">
                  <div className="px-3 py-3 bg-gray-50">
                    <IoCash size={18} className="text-text-muted" />
                  </div>
                  <input
                    type="number"
                    placeholder="Enter inspection charges (max PKR 300)"
                    value={inspectionCharge}
                    onChange={e => setInspectionCharge(e.target.value)}
                    className={`flex-1 border-0 rounded-none focus:ring-0 ${overMax ? '!border-danger' : ''}`}
                    min={0}
                    max={300}
                  />
                </div>
                {overMax && (
                  <p className="flex items-center gap-1 text-xs text-danger mt-1">
                    <IoWarning size={13} /> Maximum inspection charge is PKR 300
                  </p>
                )}
                <p className="text-xs text-text-muted mt-1 italic">Work charges will be finalized after checking the work.</p>
              </div>

              {/* Message */}
              <div>
                <label className="text-sm font-medium text-text-primary mb-2 block">Message to Customer (optional)</label>
                <textarea
                  rows={4}
                  placeholder="Briefly describe your experience and approach..."
                  value={message}
                  onChange={e => setMessage(e.target.value.slice(0, 300))}
                  className="resize-none w-full border border-border rounded-xl p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
                <p className="text-xs text-text-muted text-right mt-1">{message.length}/300</p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || overMax || !inspectionCharge}
                className="btn-primary"
              >
                {loading ? 'Submitting bid...' : 'Submit Bid'}
              </button>
              <button
                onClick={() => nav(-1)}
                className="w-full py-3.5 border border-border bg-white text-text-primary rounded-2xl text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Get Directions dialog ── */}
      {showDirDialog && (
        <div
          className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/50"
          onClick={() => setShowDirDialog(false)}
        >
          <div
            className="bg-white rounded-t-3xl px-6 pt-5 pb-10 w-full max-w-[430px] space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl shrink-0">🗺️</div>
              <div>
                <p className="text-base font-semibold text-gray-900">Open Google Maps?</p>
                <p className="text-sm text-gray-500 mt-0.5">Navigate to the job location</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-2xl px-4 py-3">
              <p className="text-xs text-gray-500">Destination</p>
              <p className="text-sm font-medium text-gray-800 mt-0.5">{job.location}</p>
              {hasCoords && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {job.latitude!.toFixed(5)}, {job.longitude!.toFixed(5)}
                </p>
              )}
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowDirDialog(false)}
                className="flex-1 py-3.5 border border-gray-200 text-gray-600 rounded-2xl text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => { window.open(mapsUrl(job), '_blank'); setShowDirDialog(false) }}
                className="flex-1 py-3.5 bg-primary text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-primary/30"
              >
                <IoNavigate size={16} /> Open Maps
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
