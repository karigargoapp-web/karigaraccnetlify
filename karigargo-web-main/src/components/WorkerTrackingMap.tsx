import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { supabase } from '../lib/supabase'

L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

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

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 15, { animate: true, duration: 1 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])
  return null
}

interface Props {
  workerId: string
  jobId: string
  workerName: string
}

export default function WorkerTrackingMap({ workerId, jobId, workerName }: Props) {
  const [loc, setLoc] = useState<{ lat: number; lng: number; updated: string } | null>(null)

  useEffect(() => {
    // Initial fetch
    supabase
      .from('worker_locations')
      .select('latitude,longitude,updated_at')
      .eq('user_id', workerId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setLoc({ lat: data.latitude, lng: data.longitude, updated: data.updated_at })
      })

    // Live subscription
    const ch = supabase
      .channel(`wloc-${workerId}-${jobId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'worker_locations', filter: `user_id=eq.${workerId}` },
        (payload) => {
          const d = payload.new as { latitude: number; longitude: number; updated_at: string }
          setLoc({ lat: d.latitude, lng: d.longitude, updated: d.updated_at })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [workerId, jobId])

  if (!loc) {
    return (
      <div className="card p-4 text-center space-y-1">
        <div className="flex items-center justify-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-warning animate-pulse inline-block" />
          <p className="text-sm font-semibold text-text-primary">Worker Location</p>
        </div>
        <p className="text-xs text-text-muted">Waiting for worker to enable location sharing…</p>
      </div>
    )
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse inline-block" />
          <p className="text-sm font-semibold text-text-primary">Worker Live Location</p>
        </div>
        <p className="text-[10px] text-text-muted">
          Updated {new Date(loc.updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ height: 210 }}>
        <MapContainer
          center={[loc.lat, loc.lng]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <FlyTo lat={loc.lat} lng={loc.lng} />
          <Marker position={[loc.lat, loc.lng]} icon={workerIcon}>
            <Popup>
              <span className="text-sm font-medium">{workerName}</span>
              <br />
              <span className="text-xs text-gray-500">On the way</span>
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  )
}
