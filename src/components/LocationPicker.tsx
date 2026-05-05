import { useState, useCallback, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { IoLocate, IoCheckmarkCircle } from 'react-icons/io5'

const googlePin = L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 24 36">
    <path fill="#EA4335" d="M12 0C7.6 0 4 3.6 4 8c0 5.3 8 18 8 18S20 13.3 20 8c0-4.4-3.6-8-8-8z"/>
    <circle fill="white" cx="12" cy="8" r="4"/>
  </svg>`,
  iconSize: [28, 40],
  iconAnchor: [14, 40],
  popupAnchor: [0, -40],
})

interface Props {
  onSelect: (lat: number, lng: number, address: string) => void
  initialPosition?: [number, number]
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

function FlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo(position, 15, { animate: true, duration: 0.8 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.[0], position?.[1]])
  return null
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
}

export default function LocationPicker({ onSelect, initialPosition }: Props) {
  const [pos, setPos] = useState<[number, number] | null>(initialPosition ?? null)
  const [address, setAddress] = useState('')
  const [detecting, setDetecting] = useState(false)

  const pick = useCallback(async (lat: number, lng: number) => {
    const p: [number, number] = [lat, lng]
    setPos(p)
    const addr = await reverseGeocode(lat, lng)
    setAddress(addr)
    onSelect(lat, lng, addr)
  }, [onSelect])

  const useGPS = () => {
    if (!navigator.geolocation) return
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        setDetecting(false)
        await pick(coords.latitude, coords.longitude)
      },
      () => setDetecting(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={useGPS}
        disabled={detecting}
        className="flex items-center gap-2 text-sm text-primary font-medium bg-primary/10 px-4 py-2 rounded-xl disabled:opacity-50 active:scale-[0.98] transition"
      >
        <IoLocate size={16} />
        {detecting ? 'Detecting location…' : 'Use My GPS Location'}
      </button>

      <div className="rounded-2xl overflow-hidden border border-border" style={{ height: 200 }}>
        <MapContainer
          center={pos ?? [30.3753, 69.3451]}
          zoom={pos ? 14 : 5}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <ClickHandler onPick={pick} />
          <FlyTo position={pos} />
          {pos && <Marker position={pos} icon={googlePin} />}
        </MapContainer>
      </div>

      {pos ? (
        <p className="flex items-center gap-1 text-xs text-green-600">
          <IoCheckmarkCircle size={13} />
          {address ? address.split(',').slice(0, 3).join(',') : 'Location pinned'}
        </p>
      ) : (
        <p className="text-xs text-text-muted">Tap on the map or use GPS to pin your exact location</p>
      )}
    </div>
  )
}
