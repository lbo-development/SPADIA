import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';

const TILES = {
  plan: {
    url:           'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:   '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
    maxZoom:       22,
  },
  satellite: {
    url:           'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:   'Tiles &copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
    maxNativeZoom: 18,
    maxZoom:       22,
  },
};

export function useGeoMap(
  setZoom: (z: number) => void,
  onMapClick: (lat: number, lng: number) => void,
) {
  const mapRef          = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef    = useRef<L.TileLayer | null>(null);
  const [basemap, setBasemap] = useState<'plan' | 'satellite'>('plan');

  // Keep latest callback accessible from the stable Leaflet handler
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; });

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center:      [46.2276, 2.2137],
      zoom:        6,
      zoomControl: false,
      maxZoom:     22,
    });

    const cfg = TILES.plan;
    tileLayerRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxNativeZoom: cfg.maxNativeZoom, maxZoom: cfg.maxZoom })
      .addTo(mapRef.current);

    mapRef.current.on('zoomend', () => setZoom(mapRef.current!.getZoom()));

    mapRef.current.on('click', (e: L.LeafletMouseEvent) => {
      onMapClickRef.current(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => mapRef.current?.invalidateSize(), 0);

    return () => {
      mapRef.current?.remove();
      mapRef.current     = null;
      tileLayerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function switchBasemap(next: 'plan' | 'satellite') {
    if (!mapRef.current) return;
    tileLayerRef.current?.remove();
    const cfg = TILES[next];
    tileLayerRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxNativeZoom: cfg.maxNativeZoom, maxZoom: cfg.maxZoom })
      .addTo(mapRef.current);
    setBasemap(next);
  }

  return { mapRef, mapContainerRef, tileLayerRef, basemap, switchBasemap };
}
