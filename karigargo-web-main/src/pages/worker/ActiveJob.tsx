import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import { IoArrowBack, IoCheckmarkCircle, IoChatbubble, IoLocation, IoNavigate, IoCall } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Job } from '../../types'
import toast from 'react-hot-toast'

const STATES = ['bidAccepted', 'inspectionDone', 'workCostProposed', 'workCostAccepted', 'completed'] as const
const STATE_LABELS = ['Bid Accepted', 'Inspection Done', 'Cost Proposed', 'Cost Approved', 'Completed']
const REJECTED_STATES = ['bidAccepted', 'inspectionDone', 'workCostProposed', 'workCostRejected', 'completed'] as const
const REJECTED_LABELS = ['Bid Accepted', 'Inspection Done', 'Cost Proposed', 'Cost Rejected', 'Completed']

/* ── Job location pin icon — Google Maps style (green) ── */
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

const mapsUrl = (job: Job) =>
  job.latitude && job.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${job.latitude},${job.longitude}`
    : `https://maps.google.com/maps?q=${encodeURIComponent(job.location)}`

/** How often we POST worker position to Supabase (reduces API load) */
const BROADCAST_INTERVAL_MS = 10_000

/** GeolocationPositionError.code — do NOT use err.PERMISSION_DENIED (undefined on instance) */
const GEO_DENIED = 1
const GEO_UNAVAILABLE = 2
const GEO_TIMEOUT = 3

export default function WorkerActiveJob() {
  const nav = useNavigate()
  const { jobId } = useParams()
  const { user } = useAuth()
  const [job, setJob] = useState<Job | null>(null)
  const [workCost, setWorkCost] = useState('')
  const [sharing, setSharing] = useState(true)
  const [loading, setLoading] = useState(true)
  const [showDirDialog, setShowDirDialog] = useState(false)
  /** 'idle' | 'requesting' | 'sending' | 'ok' | 'error' — for UI + debugging */
  const [locSync, setLocSync] = useState<'idle' | 'requesting' | 'sending' | 'ok' | 'error'>('idle')
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null)
  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!jobId) return
    const fetchJob = async () => {
      const { data } = await supabase.from('jobs').select('*').eq('id', jobId).single()
      if (data) setJob(data as Job)
      setLoading(false)
    }
    fetchJob()

    const channel = supabase
      .channel(`worker-job-${jobId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
        (payload) => setJob(payload.new as Job))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [jobId])

  /** Only while customer has accepted bid and worker is en route to inspection */
  const liveTrackingPhase = job?.status === 'bidAccepted'

  // Live location → only during bidAccepted; stops automatically after inspection is marked done
  useEffect(() => {
    if (!liveTrackingPhase || !sharing || !user || !jobId) {
      if (locationInterval.current) {
        clearInterval(locationInterval.current)
        locationInterval.current = null
      }
      setLocSync('idle')
      return
    }

    if (!navigator.geolocation) {
      toast.error('This browser does not support GPS. Customer cannot track you.')
      setSharing(false)
      return
    }

    const broadcast = () => {
      setLocSync('requesting')
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setLocSync('sending')
          const { error } = await supabase.from('worker_locations').upsert({
            user_id: user.id,
            job_id: jobId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            updated_at: new Date().toISOString(),
          })
          if (error) {
            setLocSync('error')
            toast.error(`Could not save location: ${error.message}`)
            return
          }
          setLocSync('ok')
          setLastSentAt(new Date())
        },
        (err) => {
          setLocSync('error')
          if (err.code === GEO_DENIED) {
            toast.error('Location blocked — tap below or allow in the browser address bar so the customer can see you.')
            setSharing(false)
          } else if (err.code === GEO_TIMEOUT) {
            toast.error('GPS timed out. Move to an open area or try again.')
          } else if (err.code === GEO_UNAVAILABLE) {
            toast.error('Position unavailable. Check GPS is on.')
          } else {
            toast.error('Could not read your position.')
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 25_000 }
      )
    }

    broadcast()
    locationInterval.current = setInterval(broadcast, BROADCAST_INTERVAL_MS)
    return () => {
      if (locationInterval.current) {
        clearInterval(locationInterval.current)
        locationInterval.current = null
      }
    }
  }, [liveTrackingPhase, sharing, user, jobId])

  const isRejected = job?.status === 'workCostRejected'
  const currentStates = isRejected ? REJECTED_STATES : STATES
  const currentLabels = isRejected ? REJECTED_LABELS : STATE_LABELS
  const stateIndex = job ? (currentStates as any).indexOf(job.status) : -1

  const markInspectionDone = async () => {
    await supabase.from('jobs').update({ status: 'inspectionDone' }).eq('id', jobId)
    toast.success('Inspection marked as done')
  }

  const submitWorkCost = async () => {
    if (!workCost || Number(workCost) <= 0) return toast.error('Enter a valid cost')
    await supabase.from('jobs').update({ status: 'workCostProposed', work_cost: Number(workCost) }).eq('id', jobId)
    toast.success('Work cost submitted')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-surface text-sm text-text-muted">Loading...</div>
  if (!job) return <div className="min-h-screen flex items-center justify-center bg-surface text-sm text-text-muted">Job not found</div>

  const hasCoords = Boolean(job.latitude && job.longitude)

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <div className="top-bar flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => nav(-1)}><IoArrowBack size={22} className="text-white" /></button>
          <h1 className="text-lg font-semibold text-white">Active Job</h1>
        </div>
        <button onClick={() => nav(`/chat/${jobId}`)} className="text-white"><IoChatbubble size={22} /></button>
        <button onClick={() => toast('Call feature coming soon')} className="text-white"><IoCall size={22} /></button>
      </div>

      <div className="flex-1 px-5 py-5 space-y-4 overflow-y-auto pb-6">
        {/* Job title */}
        <div className="card p-4">
          <p className="text-base font-semibold text-text-primary">{job.title}</p>
          <p className="text-xs text-text-secondary mt-1">{job.category} · {job.location}</p>
        </div>

        {/* Progress tracker */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-text-primary mb-4">Job Progress</p>
          <div className="flex items-center gap-1">
            {currentStates.map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= stateIndex ? 'bg-primary text-white' : 'bg-border text-text-muted'}`}>
                  {i <= stateIndex ? <IoCheckmarkCircle size={18} /> : i + 1}
                </div>
                <p className={`text-[9px] mt-1 text-center leading-tight ${i <= stateIndex ? 'text-primary font-medium' : 'text-text-muted'}`}>
                  {currentLabels[i]}
                </p>
              </div>
            ))}
          </div>
          <div className="flex mx-3.5 -mt-[38px] mb-6">
            {currentStates.slice(0, -1).map((_, i) => (
              <div key={i} className={`flex-1 h-0.5 mt-3.5 ${i < stateIndex ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        </div>

        {/* Customer info */}
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center">
              <span className="font-bold text-primary text-lg">{job.customer_name?.[0] || 'C'}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">{job.customer_name}</p>
              <p className="text-xs text-text-secondary">{job.location}</p>
            </div>
          </div>
          {/* Chat + Call action buttons — from WorkerLiveTracking old UI */}
          <div className="flex gap-3">
            <button
              onClick={() => nav(`/chat/${jobId}`)}
              className="flex-1 flex items-center justify-center gap-2 border border-primary py-2.5 rounded-xl text-sm font-medium text-primary"
            >
              <IoChatbubble size={16} /> Chat
            </button>
            <button
              onClick={() => toast('Call feature coming soon')}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-xl text-sm font-medium"
            >
              <IoCall size={16} /> Call
            </button>
          </div>
        </div>

        {/* ── Customer Job Location Map ── */}
        <div className="card overflow-hidden p-0">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
              <IoLocation className="text-red-500" size={16} /> Customer Location
            </p>
            <button
              onClick={() => setShowDirDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-xl active:scale-[0.97] transition"
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
            <div className="mx-4 mb-3 bg-surface rounded-xl px-4 py-5 text-center">
              <p className="text-2xl mb-1">📍</p>
              <p className="text-sm text-text-secondary">{job.location}</p>
              <p className="text-xs text-text-muted mt-1">No exact pin — directions use address text</p>
            </div>
          )}

          <div className="px-4 pb-4">
            <p className="text-xs text-text-muted truncate">📍 {job.location}</p>
          </div>
        </div>

        {/* Live Location — only during "Bid Accepted" (en route to inspection). Ends when inspection is marked done. */}
        {job.status === 'bidAccepted' ? (
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
              On the way to inspection — your live location is shared with the customer. It stops automatically after you mark inspection done.
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${sharing && locSync === 'ok' ? 'bg-green-500 animate-pulse' : sharing ? 'bg-amber-400' : 'bg-gray-300'}`} />
                <div className="min-w-0">
                  <p className="text-sm text-text-primary font-medium">Live Location</p>
                  <p className="text-[11px] text-text-muted">
                    {sharing
                      ? `Sending every ${BROADCAST_INTERVAL_MS / 1000}s while you travel to the job`
                      : 'Off — customer cannot track you'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSharing(s => !s)}
                className={`w-12 h-6 rounded-full transition relative shrink-0 ${sharing ? 'bg-primary' : 'bg-border'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${sharing ? 'left-[26px]' : 'left-0.5'}`} />
              </button>
            </div>
            {sharing && (
              <div className="rounded-xl bg-surface border border-border px-3 py-2.5 space-y-2">
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Allow the browser location prompt. Network tab should show <code className="text-[10px] bg-white px-1 rounded">worker_locations</code> POST every {BROADCAST_INTERVAL_MS / 1000}s.
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {locSync === 'requesting' && <span className="text-amber-700 font-medium">● Getting GPS…</span>}
                  {locSync === 'sending' && <span className="text-primary font-medium">● Saving to server…</span>}
                  {locSync === 'ok' && lastSentAt && (
                    <span className="text-green-700 font-medium">● Last sent {lastSentAt.toLocaleTimeString()}</span>
                  )}
                  {locSync === 'error' && <span className="text-red-600 font-medium">● Sync failed — try again</span>}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!user || !jobId || !navigator.geolocation || job.status !== 'bidAccepted') return
                    setLocSync('requesting')
                    navigator.geolocation.getCurrentPosition(
                      async (pos) => {
                        setLocSync('sending')
                        const { error } = await supabase.from('worker_locations').upsert({
                          user_id: user.id,
                          job_id: jobId,
                          latitude: pos.coords.latitude,
                          longitude: pos.coords.longitude,
                          updated_at: new Date().toISOString(),
                        })
                        if (error) {
                          toast.error(error.message)
                          setLocSync('error')
                          return
                        }
                        setLocSync('ok')
                        setLastSentAt(new Date())
                        toast.success('Location sent')
                      },
                      (err) => {
                        setLocSync('error')
                        if (err.code === GEO_DENIED) toast.error('Still blocked — allow location in site settings')
                        else toast.error('Could not read GPS')
                      },
                      { enableHighAccuracy: true, maximumAge: 0, timeout: 25_000 }
                    )
                  }}
                  className="w-full py-2 text-xs font-semibold text-primary border border-primary/30 rounded-xl bg-primary/5"
                >
                  Send location now
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="card p-4 bg-gray-50 border border-border">
            <p className="text-sm font-medium text-text-primary">Live location</p>
            <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
              {job.status === 'inspectionDone' || ['workCostProposed', 'workCostAccepted', 'workCostRejected'].includes(job.status)
                ? 'Live tracking is off. It was only active while you were travelling to the inspection (Bid Accepted).'
                : 'Live tracking is only active after the customer accepts your bid and you are on the way to the inspection.'}
            </p>
          </div>
        )}

        {/* State-based actions */}
        {job.status === 'bidAccepted' && (
          <button onClick={markInspectionDone} className="btn-primary">Mark Inspection Done</button>
        )}

        {job.status === 'inspectionDone' && (
          <div className="card p-4 space-y-3">
            <p className="text-sm font-semibold text-text-primary">Enter Work Cost</p>
            <input type="number" placeholder="Enter cost in PKR" value={workCost} onChange={e => setWorkCost(e.target.value)} />
            <button onClick={submitWorkCost} className="btn-primary">Submit Work Cost</button>
          </div>
        )}

        {job.status === 'workCostProposed' && (
          <div className="card p-4 text-center">
            <p className="text-sm text-warning font-medium">⏳ Awaiting customer approval...</p>
            <p className="text-xs text-text-muted mt-1">Proposed: PKR {job.work_cost}</p>
          </div>
        )}

        {job.status === 'workCostAccepted' && (
          <div className="card p-4 text-center">
            <p className="text-sm text-primary font-medium">✅ Cost approved: PKR {job.work_cost}</p>
            <p className="text-xs text-text-muted mt-1">Complete the work. Customer will mark job as done.</p>
          </div>
        )}

        {job.status === 'workCostRejected' && (
          <div className="card p-4 text-center">
            <p className="text-sm text-red-600 font-medium">Cost rejected. You will receive inspection fee only: PKR {job.inspection_charges}.</p>
            <p className="text-xs text-text-muted mt-1">Wait for customer to complete the job.</p>
          </div>
        )}

        {/* Rate Customer — shown after job completes */}
        {job.status === 'completed' && (
          <button
            onClick={() => nav(`/worker/review-customer/${job.id}`)}
            className="btn-primary"
          >
            ⭐ Rate the Customer
          </button>
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
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-2xl shrink-0">🗺️</div>
              <div>
                <p className="text-base font-semibold text-gray-900">Open Google Maps?</p>
                <p className="text-sm text-gray-500 mt-0.5">Navigate to the customer's location</p>
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
                className="flex-1 py-3.5 bg-green-500 text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
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
