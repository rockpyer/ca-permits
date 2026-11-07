import { useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { LIFECYCLE_COLORS, LIFECYCLE_LABELS, LIFECYCLES, lifecycle, type Lifecycle } from './lifecycle';
import { operatorDisplayName } from './operators';
import type { CoPermit } from './types';

const MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
      paint: { 'raster-saturation': -1, 'raster-brightness-min': 0.22, 'raster-contrast': -0.08 }
    }
  ]
} as maplibregl.StyleSpecification;

// Colorado's state line, for the initial view.
const COLORADO_BOUNDS: [[number, number], [number, number]] = [
  [-109.06, 36.99],
  [-102.04, 41.0]
];

type Props = {
  rows: CoPermit[];
  asOf: string;
  selected: CoPermit | null;
  onSelect: (row: CoPermit) => void;
};

export function CoMap({ rows, asOf, selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const rowsRef = useRef(rows);
  const onSelectRef = useRef(onSelect);
  const readyRef = useRef(false);
  const geojson = useMemo(() => buildGeojson(rows, asOf, selected), [rows, asOf, selected]);
  const geojsonRef = useRef(geojson);
  const present = useMemo(() => new Set(geojson.features.map((feature) => feature.properties?.lifecycle as Lifecycle)), [geojson]);

  rowsRef.current = rows;
  onSelectRef.current = onSelect;
  geojsonRef.current = geojson;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      bounds: COLORADO_BOUNDS,
      fitBoundsOptions: { padding: 16 },
      attributionControl: { compact: true }
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.once('style.load', () => {
      map.addSource('permits', { type: 'geojson', data: geojsonRef.current });
      map.addLayer({
        id: 'permits',
        type: 'circle',
        source: 'permits',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, ['case', ['get', 'selected'], 7, 4], 11, ['case', ['get', 'selected'], 10, 7]],
          'circle-stroke-color': ['case', ['get', 'selected'], '#172029', 'rgba(255,255,255,0.9)'],
          'circle-stroke-width': ['case', ['get', 'selected'], 2.5, 1]
        }
      });
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'well-map-popup', offset: 8 });
      map.on('mousemove', 'permits', (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        map.getCanvas().style.cursor = 'pointer';
        const props = feature.properties as Record<string, string>;
        const body = document.createElement('div');
        body.className = 'well-map-popup__body';
        const title = document.createElement('div');
        title.className = 'well-map-popup__title';
        title.textContent = props.well_name;
        const detail = document.createElement('div');
        detail.className = 'well-map-popup__muted';
        detail.textContent = `${props.operator} · ${props.label} · approved ${props.approved}`;
        body.append(title, detail);
        popup.setLngLat(event.lngLat).setDOMContent(body).addTo(map);
      });
      map.on('mouseleave', 'permits', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });
      map.on('click', 'permits', (event) => {
        const key = String(event.features?.[0]?.properties?.source_key || '');
        const row = rowsRef.current.find((item) => item.source_key === key);
        if (row) onSelectRef.current(row);
      });
      readyRef.current = true;
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  useEffect(() => {
    const source = readyRef.current ? (mapRef.current?.getSource('permits') as maplibregl.GeoJSONSource | undefined) : undefined;
    source?.setData(geojson);
  }, [geojson]);

  return (
    <div className="border border-line bg-panel/60 p-3">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Approved permit locations by status</h2>
          <p className="text-xs text-slate-500">Surface locations. Color shows where each permit stands in the wells layer today.</p>
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400" aria-label="Map legend">
          {LIFECYCLES.filter((key) => present.has(key)).map((key) => (
            <li key={key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: LIFECYCLE_COLORS[key] }} aria-hidden="true" />
              {LIFECYCLE_LABELS[key]}
            </li>
          ))}
        </ul>
      </div>
      <div ref={containerRef} className="h-[340px] w-full sm:h-[430px]" role="region" aria-label="Map of approved Colorado permits" />
    </div>
  );
}

function buildGeojson(rows: CoPermit[], asOf: string, selected: CoPermit | null): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features = rows
    .filter((row) => row.latitude !== null && row.longitude !== null)
    .map((row) => {
      const stage = lifecycle(row, asOf);
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [row.longitude as number, row.latitude as number] },
        properties: {
          source_key: row.source_key,
          lifecycle: stage,
          label: LIFECYCLE_LABELS[stage],
          color: LIFECYCLE_COLORS[stage],
          selected: selected?.source_key === row.source_key,
          well_name: row.well_name || row.api_display || '',
          operator: operatorDisplayName(row.operator_name),
          approved: row.approved_date || ''
        }
      };
    })
    // Selected last so it draws on top.
    .sort((a, b) => Number(a.properties.selected) - Number(b.properties.selected));
  return { type: 'FeatureCollection', features };
}
