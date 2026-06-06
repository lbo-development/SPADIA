import { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface PlanViewerState {
  url:    string;
  nom:    string;
  width:  number | null;
  height: number | null;
  planId: string;
}

export function usePlanOverlay(
  planViewer:  PlanViewerState | null,
  setZoom:     (z: number) => void,
  geoMapRef:   React.MutableRefObject<L.Map | null>,
  onMapClick:  (x: number, y: number) => void,
) {
  const planMapRef           = useRef<L.Map | null>(null);
  const planMapContainerRef  = useRef<HTMLDivElement>(null);
  const planMarkersRef       = useRef<L.Marker[]>([]);
  const planPendingMarkerRef = useRef<L.CircleMarker | null>(null);

  // Keep latest callback accessible from the stable Leaflet handler
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; });

  useEffect(() => {
    if (!planViewer || !planMapContainerRef.current) return;
    const W = planViewer.width  ?? 1000;
    const H = planViewer.height ?? 1000;
    const bounds: L.LatLngBoundsExpression = [[0, 0], [H, W]];

    const map = L.map(planMapContainerRef.current, {
      crs:               L.CRS.Simple,
      minZoom:           -5,
      maxZoom:           8,
      zoomControl:       false,
      attributionControl: false,
    });

    L.imageOverlay(planViewer.url, bounds).addTo(map);
    map.fitBounds(bounds, { padding: [20, 20] });

    map.on('zoomend', () => setZoom(Math.round(map.getZoom())));

    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClickRef.current(e.latlng.lng, e.latlng.lat);
    });

    planMapRef.current = map;
    return () => {
      map.remove();
      planMapRef.current     = null;
      planMarkersRef.current = [];
      planPendingMarkerRef.current?.remove();
      planPendingMarkerRef.current = null;
      setZoom(Math.round(geoMapRef.current?.getZoom() ?? 6));
    };
  }, [planViewer?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  return { planMapRef, planMapContainerRef, planMarkersRef, planPendingMarkerRef };
}
