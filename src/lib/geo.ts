// Geo helpers for the rebus map. Coordinates throughout the rebus system are
// stored as a single text field in "lat,lon" form (e.g. "59.9139,10.7522")
// since that's what the admin pastes from Google Maps.

export interface LatLon {
  lat: number
  lon: number
}

/** Parse a "lat,lon" (or "lat, lon") string. Returns null on any failure
 *  -- empty input, malformed numbers, out-of-range values. */
export function parseLatLon(input: string | null | undefined): LatLon | null {
  if (!input) return null
  const parts = input.split(',').map((s) => s.trim())
  if (parts.length !== 2) return null
  const lat = Number(parts[0])
  const lon = Number(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { lat, lon }
}

/** Great-circle distance between two points in meters (Haversine). */
export function haversineMeters(a: LatLon, b: LatLon): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Initial bearing (forward azimuth) from a -> b in degrees [0, 360). */
export function bearingDegrees(a: LatLon, b: LatLon): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const toDeg = (rad: number) => (rad * 180) / Math.PI
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const dLon = toRad(b.lon - a.lon)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

/** Compass direction string (N, NE, E, ...) for a bearing in degrees. */
export function compassDirection(bearing: number): string {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SV', 'V', 'NV']
  const i = Math.round(bearing / 45) % 8
  return dirs[i]
}

/** Pretty-print a distance in meters. <1 km uses meters, otherwise km. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  if (meters < 10000) return `${(meters / 1000).toFixed(2)} km`
  return `${(meters / 1000).toFixed(1)} km`
}

/** Rough car-ride duration estimate based on the straight-line distance.
 *  We don't have access to a routing API, so this is intentionally a coarse
 *  approximation: short hops are assumed to be city traffic (slower), longer
 *  legs use a higher average speed for a mix of suburban / highway driving.
 *  Returns minutes. */
export function estimateDriveMinutes(meters: number): number {
  // Add a 30% detour factor on top of straight-line distance, since real
  // roads rarely follow the as-the-crow-flies path.
  const roadMeters = meters * 1.3
  // Pick an average speed bucket. These numbers are deliberately gentle so
  // the estimate doesn't look misleadingly precise.
  let kmh: number
  if (roadMeters < 2000) kmh = 25
  else if (roadMeters < 10000) kmh = 40
  else if (roadMeters < 50000) kmh = 60
  else kmh = 75
  const minutes = (roadMeters / 1000) / kmh * 60
  return minutes
}

/** Pretty-print a duration in minutes. Uses "min" for <60, "Xt Ymin"
 *  otherwise. Always rounds up to the nearest minute (and at least 1). */
export function formatDuration(minutes: number): string {
  const total = Math.max(1, Math.round(minutes))
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  if (m === 0) return `${h} t`
  return `${h} t ${m} min`
}
