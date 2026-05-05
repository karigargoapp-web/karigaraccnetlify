import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { LeafletTrackingMarker } from 'react-leaflet-tracking-marker'
import L from 'leaflet'
import { IoArrowBack, IoChatbubble, IoStar, IoLocate } from 'react-icons/io5'
import { supabase } from '../../lib/supabase'
import type { Job, WorkerLocation } from '../../types'

/* ── Icons — Google Maps style ── */
const workerIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:42px;height:42px;
    background:linear-gradient(135deg,#1a73e8,#0d47a1);
    border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    border:3px solid white;
    box-shadow:0 3px 10px rgba(26,115,232,0.5);
    font-size:20px;
  ">🔧</div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -21],
})

const jobPinIcon = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 24 36">
    <path fill="#EA4335" d="M12 0C7.6 0 4 3.6 4 8c0 5.3 8 18 8 18S20 13.3 20 8c0-4.4-3.6-8-8-8z"/>
    <circle fill="white" cx="12" cy="8" r="4"/>
  </svg>`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -40],
})

/* ── Map helper: follow worker ── */
function FollowWorker({ pos, follow }: { pos: [number, number]; follow: boolean }) {
  const map = useMap()
  const isFirst = useRef(true)
  useEffect(() => {
    if (!follow && !isFirst.current) return
    if (isFirst.current) { map.setView(pos, 15); isFirst.current = false }
    else map.panTo(pos, { animate: true, duration: 1 })
  }, [pos])
  return null
}

const STATUS_LABELS: Record<string, string> = {
  bidAccepted: 'Worker is on the way',
  inspectionDone: 'Inspection complete',
  workCostProposed: 'Awaiting your cost approval',
  workCostAccepted: 'Work in progress',
  completed: 'Job completed',
}

export default function TrackingScreen() {
  const nav = useNavigate()
  const { jobId } = useParams<{ jobId: string }>()
  const [job, setJob] = useState<Job | null>(null)
  const [workerPos, setWorkerPos] = useState<[number, number] | null>(null)
  const [prevPos, setPrevPos] = useState<[number, number] | null>(null)
  const [follow, setFollow] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [workerRating, setWorkerRating] = useState<number | null>(null)
  const [workerJobs, setWorkerJobs] = useState<number>(0)
  const [jobLoading, setJobLoading] = useState(true)
  const posRef = useRef<[number, number] | null>(null)

  const liveTrackingPhase = job?.status === 'bidAccepted'

  /* ── Step 1: fetch job + subscribe to job status changes ── */
  useEffect(() => {
    if (!jobId) return

    supabase.from('jobs').select('*').eq('id', jobId).single()
      .then(({ data }) => { if (data) setJob(data as Job); setJobLoading(false) })

    const jobCh = supabase
      .channel(`tracking-job-${jobId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${jobId}` },
        (payload) => setJob(payload.new as Job))
      .subscribe()

    return () => { supabase.removeChannel(jobCh) }
  }, [jobId])

  /*
   * ── Step 2: once we have the worker_id from the job,
   *    subscribe to worker_locations filtered by user_id (the PRIMARY KEY).
   *
   *    WHY user_id and NOT job_id:
   *    Supabase Realtime only reliably filters UPDATE events on primary-key
   *    columns. worker_locations PK = user_id. Filtering by job_id (non-PK)
   *    silently drops every UPDATE — that's why the map showed "waiting" even
   *    though the worker was broadcasting.
   * ──
   */
  /* Live worker position — only while job is bidAccepted (worker en route to inspection) */
  useEffect(() => {
    const workerId = job?.worker_id
    if (!workerId || !liveTrackingPhase) {
      setWorkerPos(null)
      setPrevPos(null)
      setLastUpdated(null)
      posRef.current = null
      return
    }

    supabase.from('worker_profiles').select('avg_rating, total_jobs')
      .eq('user_id', workerId).maybeSingle()
      .then(({ data: wp }) => {
        if (wp) { setWorkerRating(wp.avg_rating); setWorkerJobs(wp.total_jobs) }
      })

    supabase.from('worker_locations').select('*')
      .eq('user_id', workerId).maybeSingle()
      .then(({ data: locData }) => {
        if (locData) {
          const p: [number, number] = [locData.latitude, locData.longitude]
          posRef.current = p
          setWorkerPos(p)
          setPrevPos(p)
          setLastUpdated(locData.updated_at)
        }
      })

    const locCh = supabase
      .channel(`tracking-loc-${workerId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'worker_locations',
        filter: `user_id=eq.${workerId}`,
      }, (payload) => {
        const loc = payload.new as WorkerLocation
        if (!loc?.latitude || !loc?.longitude) return
        const newPos: [number, number] = [loc.latitude, loc.longitude]
        setPrevPos(posRef.current ?? newPos)
        posRef.current = newPos
        setWorkerPos(newPos)
        setLastUpdated(loc.updated_at)
      })
      .subscribe()

    return () => { supabase.removeChannel(locCh) }
  }, [job?.worker_id, liveTrackingPhase])

  const timeSince = (dt: string) => {
    const s = Math.floor((Date.now() - new Date(dt).getTime()) / 1000)
    if (s < 10) return 'Just now'
    if (s < 60) return `${s}s ago`
    return `${Math.floor(s / 60)}m ago`
  }

  const defaultCenter: [number, number] = [31.5204, 74.3587]

  if (jobLoading || !jobId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-text-muted text-sm">Loading…</div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-6 text-center text-sm text-text-muted">
        Job not found
        <button type="button" onClick={() => nav(-1)} className="mt-4 text-primary font-medium">Go back</button>
      </div>
    )
  }

  if (!liveTrackingPhase) {
    return (
      <div className="min-h-screen bg-surface flex flex-col">
        <div className="top-bar flex items-center gap-3">
          <button onClick={() => nav(-1)} className="text-white">
            <IoArrowBack size={22} />
          </button>
          <h1 className="text-lg font-semibold text-white">Live tracking</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-4xl mb-4">📍</p>
          <p className="text-lg font-semibold text-text-primary">Live location is not available</p>
          <p className="text-sm text-text-secondary mt-3 leading-relaxed">
            Live tracking only works while the worker is on the way to your place for inspection (after you accept their bid).
            Once inspection starts, live sharing stops automatically.
          </p>
          <button
            type="button"
            onClick={() => nav(`/customer/active-job/${jobId}`)}
            className="mt-8 btn-primary w-full max-w-xs"
          >
            Back to job
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-hidden" style={{ height: '100dvh' }}>

      {/* Full-screen map */}
      <MapContainer
        center={workerPos ?? defaultCenter}
        zoom={15}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' />

        {/* Animated, rotating worker marker */}
        {workerPos && (
          <LeafletTrackingMarker
            position={workerPos}
            previousPosition={prevPos ?? workerPos}
            duration={10000}
            icon={workerIcon}
          >
            <Popup><b>{job?.worker_name || 'Worker'}</b></Popup>
          </LeafletTrackingMarker>
        )}

        {/* Job location pin */}
        {job?.latitude && job?.longitude && (
          <Marker position={[job.latitude, job.longitude]} icon={jobPinIcon}>
            <Popup>{job.location}</Popup>
          </Marker>
        )}

        {workerPos && <FollowWorker pos={workerPos} follow={follow} />}
      </MapContainer>

      {/* Top gradient overlay */}
      <div
        className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none"
        style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0.55) 0%,transparent 100%)' }}
      >
        <div className="flex items-center gap-3 px-4 pt-12 pb-10 pointer-events-auto">
          <button
            onClick={() => nav(-1)}
            className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg shrink-0"
          >
            <IoArrowBack size={20} className="text-gray-800" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm drop-shadow truncate">{job?.title || 'Live Tracking'}</p>
            <p className="text-white/80 text-xs drop-shadow">
              {job ? STATUS_LABELS[job.status] || job.status : 'Loading...'}
            </p>
          </div>
          {lastUpdated && (
            <div className="bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1 shrink-0 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <p className="text-white text-[11px] font-medium">{timeSince(lastUpdated)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Follow toggle */}
      <button
        onClick={() => setFollow(f => !f)}
        className={`absolute top-32 right-4 z-[1000] w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition ${
          follow ? 'bg-primary text-white' : 'bg-white text-gray-500'
        }`}
      >
        <IoLocate size={20} />
      </button>

      {/* Bottom info card */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-white rounded-t-3xl shadow-2xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />
        <div className="px-5 pb-8 space-y-4">

          {/* Worker row */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-2xl font-bold text-primary">{job?.worker_name?.[0] || 'W'}</span>
            </div>
            <div className="flex-1">
              <p className="text-base font-bold text-gray-900">{job?.worker_name || '—'}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-0.5">
                  <IoStar size={13} className="text-amber-400" />
                  <span className="text-sm font-medium text-gray-600">
                    {workerRating != null ? workerRating.toFixed(1) : '—'}
                  </span>
                </div>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-500">{workerJobs} jobs done</span>
              </div>
            </div>
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 ${
              job?.status === 'bidAccepted' ? 'bg-blue-100 text-blue-700' :
              job?.status === 'workCostAccepted' ? 'bg-green-100 text-green-700' :
              job?.status === 'completed' ? 'bg-gray-100 text-gray-600' :
              'bg-amber-100 text-amber-700'
            }`}>
              {job ? (STATUS_LABELS[job.status]?.split(' ')[0] || job.status) : '...'}
            </span>
          </div>

          {/* Waiting indicator */}
          {!workerPos && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-sm animate-pulse">📡</div>
              <div>
                <p className="text-sm font-medium text-amber-800">Waiting for worker's location</p>
                <p className="text-xs text-amber-600 mt-0.5">Worker's live location will appear once they open the job</p>
              </div>
            </div>
          )}

          {/* Live badge when connected */}
          {workerPos && lastUpdated && (
            <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shrink-0" />
              <p className="text-sm font-medium text-green-800">Live — updating every 10 seconds</p>
            </div>
          )}

          {/* Job location row */}
          {job?.location && (
            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-sm shrink-0">📍</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">Job Location</p>
                <p className="text-sm font-medium text-gray-800 truncate">{job.location}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => nav(`/chat/${jobId}`)}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-white rounded-2xl font-semibold text-sm active:scale-[0.98] transition shadow-md shadow-primary/30"
            >
              <IoChatbubble size={18} /> Chat with Worker
            </button>
            <button
              onClick={() => nav(-1)}
              className="flex items-center justify-center px-4 py-3.5 rounded-2xl border border-gray-200 text-gray-600 font-medium text-sm active:scale-[0.98] transition"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
