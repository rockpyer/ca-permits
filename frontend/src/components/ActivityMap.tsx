import { useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { PermitActivity } from '../lib/types';

type Props = {
  rows: PermitActivity[];
  selected: PermitActivity | null;
  onSelect: (row: PermitActivity) => void;
};

const STYLE_URL = 'https://demotiles.maplibre.org/style.json';

export function ActivityMap({ rows, selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectedRef = useRef<PermitActivity | null>(selected);
  const rowsRef = useRef<PermitActivity[]>(rows);
  const onSelectRef = useRef(onSelect);

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: rows
        .filter((row) => row.latitude && row.longitude)
        .map((row) => ({
          type: 'Feature' as const,
          properties: {
            source_key: row.source_key,
            notice_type: row.notice_type,
            operator_name: row.operator_name,
            field_name: row.field_name
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [row.longitude as number, row.latitude as number]
          }
        }))
    }),
    [rows]
  );

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [-119.4, 36.4],
      zoom: 5.6,
      attributionControl: false
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      map.addSource('permits', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
        cluster: true,
        clusterRadius: 42
      });
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'permits',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#36d399',
          'circle-radius': ['step', ['get', 'point_count'], 16, 25, 22, 100, 30],
          'circle-opacity': 0.86
        }
      });
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'permits',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12
        },
        paint: { 'text-color': '#07110f' }
      });
      map.addLayer({
        id: 'permit-points',
        type: 'circle',
        source: 'permits',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'notice_type'],
            'NOI - New Drill',
            '#36d399',
            'NOI - Deepen',
            '#60a5fa',
            'NOI - Sidetrack',
            '#f5b84b',
            'NOI - Rework',
            '#c084fc',
            '#ef6767'
          ],
          'circle-radius': 6,
          'circle-stroke-color': '#07110f',
          'circle-stroke-width': 1.5
        }
      });
      map.on('click', 'permit-points', (event) => {
        const key = event.features?.[0]?.properties?.source_key;
        const row = rowsRef.current.find((item) => item.source_key === key);
        if (row) onSelectRef.current(row);
      });
      map.on('mouseenter', 'permit-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'permit-points', () => {
        map.getCanvas().style.cursor = '';
      });
    });
    mapRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    const source = mapRef.current?.getSource('permits') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(geojson);
  }, [geojson]);

  useEffect(() => {
    if (!selected?.latitude || !selected.longitude || !mapRef.current) return;
    mapRef.current.flyTo({ center: [selected.longitude, selected.latitude], zoom: Math.max(mapRef.current.getZoom(), 8) });
  }, [selected]);

  return (
    <div className="relative h-full min-h-[360px] overflow-hidden border border-line bg-panel">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 border border-line bg-ink/90 px-3 py-2 text-xs text-slate-300">
        {geojson.features.length.toLocaleString()} mapped permits
      </div>
    </div>
  );
}
