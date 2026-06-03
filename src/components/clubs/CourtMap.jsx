import { useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n'

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

const PIN_COLORS = {
  publica: '#10b981',
  comunitaria: '#3b82f6',
  club: '#f59e0b',
  country_club: '#eab308',
}

export default function CourtMap({ courts, userLocation }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const { t } = useI18n()

  useEffect(() => {
    if (!MAPS_KEY || mapInstanceRef.current) return

    if (!window.google?.maps) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}`
      script.async = true
      script.onload = () => initMap()
      document.head.appendChild(script)
    } else {
      initMap()
    }

    function initMap() {
      if (!mapRef.current) return
      const center = userLocation
        ? { lat: userLocation.lat, lng: userLocation.lng }
        : { lat: 20.97, lng: -89.62 }

      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 12,
        styles: [
          { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e1a' }] },
          { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2e1a' }] },
        ],
        disableDefaultUI: true,
        zoomControl: true,
      })
      addMarkers(mapInstanceRef.current)
    }
  }, [])

  useEffect(() => {
    if (mapInstanceRef.current) addMarkers(mapInstanceRef.current)
  }, [courts])

  function addMarkers(map) {
    if (map._markers) map._markers.forEach(m => m.setMap(null))
    map._markers = []
    const infoWindow = new window.google.maps.InfoWindow()

    courts.forEach(court => {
      if (!court.lat || !court.lng) return
      const type = court.court_type || 'club'
      const color = PIN_COLORS[type] || PIN_COLORS.club

      const marker = new window.google.maps.Marker({
        position: { lat: Number(court.lat), lng: Number(court.lng) },
        map,
        title: court.name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: color,
          fillOpacity: 0.9,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      })

      marker.addListener('click', () => {
        infoWindow.setContent(`
          <div style="color:#000;font-family:system-ui;max-width:200px;">
            <strong>${court.name}</strong>
            <div style="font-size:11px;color:#666;margin:4px 0;">${t('courts.type_' + type)} · ${court.courts_count || '?'} canchas</div>
            ${court.address ? '<div style="font-size:11px;color:#888;">' + court.address + '</div>' : ''}
            <a href="/club/${court.slug}" style="color:#10b981;font-size:12px;font-weight:bold;display:block;margin-top:6px;">Ver perfil →</a>
          </div>
        `)
        infoWindow.open(map, marker)
      })
      map._markers.push(marker)
    })

    if (map._markers.length > 0) {
      const bounds = new window.google.maps.LatLngBounds()
      map._markers.forEach(m => bounds.extend(m.getPosition()))
      map.fitBounds(bounds)
      if (map._markers.length === 1) map.setZoom(14)
    }
  }

  if (!MAPS_KEY) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-zinc-400 text-sm">{t('courts.map_view')} — Google Maps API key required</p>
      </div>
    )
  }

  return (
    <div ref={mapRef} className="w-full rounded-xl overflow-hidden border border-zinc-800" style={{ height: '400px' }} />
  )
}
