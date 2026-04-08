import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { LatLon } from '@/lib/geo'

// Dark CartoDB tiles -- no API key required and they look great with the
// neon/glass aesthetic of the rebus view. Falls back to OpenStreetMap if
// CartoDB is unreachable.
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const TILE_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

// Custom div-icon factory: a glowing dot in the brand color. We avoid the
// stock leaflet marker icons because (a) they require fixing the asset paths
// under Vite and (b) they don't fit the neon look.
function makeIcon(opts: { color: string; label: string; pulse?: boolean }) {
  const pulseClass = opts.pulse ? ' rebus-marker-pulse' : ''
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `
      <div class="rebus-marker${pulseClass}" style="--marker-color: ${opts.color};">
        <span class="rebus-marker-dot"></span>
        <span class="rebus-marker-label">${opts.label}</span>
      </div>
    `,
  })
}

export function RebusMap({
  from,
  to,
  fromLabel,
  toLabel,
}: {
  from: LatLon
  to: LatLon
  fromLabel?: string
  toLabel?: string
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  // Initialise the map exactly once. Subsequent prop changes update the
  // existing map below.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
      // Touch interactions are still enabled so the bachelor can pan/zoom
      // on mobile -- this is the primary device for the rebus view.
    })
    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTR,
      maxZoom: 19,
    }).addTo(map)
    L.control.zoom({ position: 'topright' }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Render / update markers + the connecting line whenever the coordinates
  // change. We tear down the previous overlay layers each time so the map
  // never accumulates duplicates.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const fromLatLng = L.latLng(from.lat, from.lon)
    const toLatLng = L.latLng(to.lat, to.lon)

    const layers: L.Layer[] = []

    // Glowing dashed line from start -> destination. The line is drawn
    // twice: a thicker translucent halo underneath, then the bright
    // dashed line on top, to fake a neon glow.
    const halo = L.polyline([fromLatLng, toLatLng], {
      color: '#5dd6ff',
      weight: 10,
      opacity: 0.18,
    }).addTo(map)
    const line = L.polyline([fromLatLng, toLatLng], {
      color: '#5dd6ff',
      weight: 3,
      opacity: 0.95,
      dashArray: '8 8',
    }).addTo(map)
    layers.push(halo, line)

    const fromMarker = L.marker(fromLatLng, {
      icon: makeIcon({ color: '#94a3b8', label: fromLabel ?? 'Start' }),
      interactive: false,
    }).addTo(map)
    const toMarker = L.marker(toLatLng, {
      icon: makeIcon({ color: '#5dd6ff', label: toLabel ?? 'Mal', pulse: true }),
      interactive: false,
    }).addTo(map)
    layers.push(fromMarker, toMarker)

    // Fit both markers in view with some padding so the labels don't get
    // clipped against the edge of the map.
    map.fitBounds(L.latLngBounds([fromLatLng, toLatLng]), {
      padding: [60, 60],
      maxZoom: 16,
    })

    // Force a resize after the next paint so leaflet picks up the
    // container's actual dimensions inside the flex layout.
    const t = window.setTimeout(() => map.invalidateSize(), 50)

    return () => {
      window.clearTimeout(t)
      layers.forEach((l) => map.removeLayer(l))
    }
  }, [from.lat, from.lon, to.lat, to.lon, fromLabel, toLabel])

  return (
    <div
      ref={containerRef}
      className="rebus-map-container w-full h-72 sm:h-80 rounded-lg overflow-hidden neon-border"
    />
  )
}
