import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IoArrowBack, IoStar, IoCheckmarkCircle, IoLocation, IoCalendar, IoChatbubble, IoCash, IoTime, IoNavigate } from 'react-icons/io5'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import type { Job, Bid } from '../../types'
import { parseMediaUrls, isVideoUrl } from '../../utils/media'

const workerBidIcon = L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;background:linear-gradient(135deg,#1a73e8,#0d47a1);border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(26,115,232,0.5);font-size:16px;">🔧</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function JobDetail() {
  const nav = useNavigate()
  const { jobId } = useParams()
  const [job, setJob] = useState<Job | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [workerCities, setWorkerCities] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)

  const fetchBids = async (jid: string) => {
    const { data } = await supabase
      .from('bids')
      .select('*')
      .eq('job_id', jid)
      .order('created_at', { ascending: false })
    if (!data) return
    setBids(data as Bid[])

    const workerIds = [...new Set(data.map(b => b.worker_id))]
    if (workerIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, city')
        .in('id', workerIds)
      if (users) {
        const map: Record<string, string> = {}
        users.forEach(u => { if (u.city) map[u.id] = u.city })
        setWorkerCities(map)
      }
    }
  }

  useEffect(() => {
    if (!jobId) return
    const fetchAll = async () => {
      const { data: jobData } = await supabase.from('jobs').select('*').eq('id', jobId).single()
      if (jobData) setJob(jobData as Job)
      await fetchBids(jobId)
      setLoading(false)
    }
    fetchAll()

    const ch = supabase
      .channel(`bids-${jobId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids', filter: `job_id=eq.${jobId}` }, () => { fetchBids(jobId) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [jobId])

  const acceptBid = async (bid: Bid) => {
    setAccepting(bid.id)
    await supabase.from('bids').update({ status: 'accepted' }).eq('id', bid.id)
    await supabase.from('bids').update({ status: 'rejected' }).eq('job_id', jobId).neq('id', bid.id)
    await supabase.from('jobs').update({
      status: 'bidAccepted',
      worker_id: bid.worker_id,
      worker_name: bid.worker_name,
      inspection_charges: bid.inspection_charges,
    }).eq('id', jobId)
    toast.success('Bid accepted! Job has started.')
    nav(`/customer/active-job/${jobId}`)
  }

  const accepted = bids.find(b => b.status === 'accepted')

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-surface text-sm text-text-muted">Loading...</div>
  )
  if (!job) return (
    <div className="min-h-screen flex items-center justify-center bg-surface text-sm text-text-muted">Job not found</div>
  )

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <div className="bg-primary px-6 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => nav(-1)}><IoArrowBack size={22} className="text-white" /></button>
            <div>
              <h1 className="text-lg font-semibold text-white">Bids & Details</h1>
              <p className="text-white/70 text-sm">{job.title}</p>
            </div>
          </div>
          <button
            onClick={() => nav(`/chat/${jobId}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white/20 text-white hover:bg-white/30 transition"
          >
            <IoChatbubble size={16} /> Chat
          </button>
        </div>

        {/* Task info card inside header */}
        <div className="bg-white/10 rounded-2xl p-4">
          <p className="text-white/90 text-sm flex items-center gap-1.5 mb-2">
            <IoLocation size={15} /> {job.location}
          </p>
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-medium">Budget: PKR {Number(job.budget).toLocaleString()}</p>
            <p className="text-white text-sm font-medium">{bids.length} {bids.length === 1 ? 'Bid' : 'Bids'}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-8">
        {/* Job description card */}
        <div className="card p-4">
          <p className="text-sm text-text-secondary">{job.description}</p>
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-text-muted">
            <span className="flex items-center gap-1">🔧 {job.category}</span>
            <span className="flex items-center gap-1">
              <IoCalendar size={13} /> {job.date ? new Date(job.date).toLocaleDateString() : 'Flexible'}
              {job.time && ` · ${job.time}`}
            </span>
          </div>
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

        {/* Inspection-only note */}
        <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
          <span className="text-lg shrink-0">ℹ️</span>
          <p className="text-xs text-blue-800">
            Workers bid <strong>inspection charges only</strong> (max PKR 300).
            Work charges will be finalized after on-site inspection.
          </p>
        </div>

        {/* Bids section */}
        <div>
          <h3 className="section-title">Worker Bids</h3>

          {bids.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm font-medium text-text-primary">No bids yet</p>
              <p className="text-xs text-text-muted mt-1">Workers will start bidding soon. Check back later.</p>
            </div>
          ) : (
            bids.map(bid => (
              <div key={bid.id} className="card p-4 mb-3 animate-fade-in">
                {/* Bid header: avatar + info + price */}
                <div className="flex gap-3">
                  {/* Worker avatar — large like old UI */}
                  <div className="w-16 h-16 rounded-full bg-surface border border-border flex items-center justify-center overflow-hidden shrink-0">
                    {bid.worker_photo
                      ? <img src={bid.worker_photo} className="w-full h-full object-cover" />
                      : <span className="text-xl font-bold text-primary">{bid.worker_name[0]}</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">{bid.worker_name}</p>
                      {bid.verified && (
                        <span className="w-5 h-5 rounded-full bg-primary-light flex items-center justify-center">
                          <IoCheckmarkCircle className="text-white" size={14} />
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-text-secondary">
                      <span className="flex items-center gap-0.5"><IoStar className="star-filled" size={12} /> {bid.rating.toFixed(1)}</span>
                      {job.latitude && job.longitude && bid.worker_lat && bid.worker_lng && (
                        <span className="flex items-center gap-0.5 text-primary font-medium">
                          <IoLocation size={12} /> {haversineKm(job.latitude, job.longitude, bid.worker_lat, bid.worker_lng).toFixed(1)} km
                        </span>
                      )}
                      {!(bid.worker_lat && bid.worker_lng) && workerCities[bid.worker_id] && (
                        <span className="flex items-center gap-0.5">
                          <IoLocation size={12} /> {workerCities[bid.worker_id]}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price column */}
                  <div className="text-right shrink-0">
                    <p className="text-base font-semibold text-primary">PKR {bid.inspection_charges}</p>
                    <p className="text-[10px] text-text-muted">Inspection</p>
                    {bid.status === 'accepted' && <span className="pill-active text-[10px] mt-1 inline-block">Accepted</span>}
                    {bid.status === 'rejected' && <span className="pill-rejected text-[10px] mt-1 inline-block">Rejected</span>}
                  </div>
                </div>

                {/* Worker message */}
                {bid.message && (
                  <div className="bg-surface rounded-xl p-3 mt-3">
                    <p className="text-xs text-text-secondary">{bid.message}</p>
                  </div>
                )}

                {bid.worker_lat && bid.worker_lng && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-text-primary flex items-center gap-1">
                        <IoLocation size={13} className="text-blue-500" /> Worker's Location at Bid Time
                      </p>
                      <button
                        onClick={() => window.open(`https://www.google.com/maps?q=${bid.worker_lat},${bid.worker_lng}`, '_blank')}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500 text-white text-[11px] font-medium rounded-lg"
                      >
                        <IoNavigate size={12} /> Open in Google Maps
                      </button>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-border" style={{ height: 180 }}>
                      <MapContainer
                        center={[bid.worker_lat, bid.worker_lng]}
                        zoom={14}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                        dragging={false}
                        scrollWheelZoom={false}
                        doubleClickZoom={false}
                        attributionControl={false}
                      >
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                        <Marker position={[bid.worker_lat, bid.worker_lng]} icon={workerBidIcon} />
                      </MapContainer>
                    </div>
                  </div>
                )}

                {!accepted && bid.status === 'pending' && job.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => nav(`/customer/worker/${bid.worker_id}`)}
                      className="flex-1 py-2.5 border border-border text-sm text-text-secondary font-medium rounded-xl active:scale-[0.98] transition"
                    >
                      View Profile
                    </button>
                    <button
                      onClick={() => acceptBid(bid)}
                      disabled={accepting === bid.id}
                      className="flex-1 py-2.5 bg-primary text-white text-sm font-medium rounded-xl active:scale-[0.98] transition disabled:opacity-50"
                    >
                      {accepting === bid.id ? 'Accepting...' : 'Accept Bid'}
                    </button>
                  </div>
                )}
                {bid.status === 'pending' && job.status !== 'pending' && (
                  <div className="mt-3">
                    <button
                      onClick={() => nav(`/customer/worker/${bid.worker_id}`)}
                      className="w-full py-2.5 border border-border text-sm text-text-secondary font-medium rounded-xl active:scale-[0.98] transition"
                    >
                      View Profile
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
