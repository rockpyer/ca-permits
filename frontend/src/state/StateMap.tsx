import { useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { ChartFilter } from './ui';

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

export type MapPoint = {
  key: string;
  latitude: number | null;
  longitude: number | null;
  /** Bottom hole, drawn as a line from the surface location when present. */
  bhlLatitude?: number | null;
  bhlLongitude?: number | null;
  color: string;
  stage: string;
  title: string;
  detail: string;
};

type Props = {
  title: string;
  subtitle: string;
  ariaLabel: string;
  bounds: [[number, number], [number, number]];
  points: MapPoint[];
  legend: Array<{ key: string; label: string; color: string }>;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** When set, legend entries toggle this page filter (values are legend labels). */
  legendFilter?: ChartFilter;
};

/** Surface locations colored by stage, with optional surface-to-bottom-hole lines. */
export function StateMap({ title, subtitle, ariaLabel, bounds, points, legend, selectedKey, onSelect, legendFilter }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  const readyRef = useRef(false);
  const data = useMemo(() => buildGeojson(points, selectedKey), [points, selectedKey]);
  const dataRef = useRef(data);
  const present = useMemo(() => new Set(points.map((point) => point.stage)), [points]);

  onSelectRef.current = onSelect;
  dataRef.current = data;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      bounds,
      fitBoundsOptions: { padding: 16 },
      attributionControl: { compact: true }
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.once('style.load', () => {
      map.addSource('laterals', { type: 'geojson', data: dataRef.current.lines });
      map.addSource('permits', { type: 'geojson', data: dataRef.current.points });
      map.addLayer({
        id: 'laterals',
        type: 'line',
        source: 'laterals',
        minzoom: 7,
        paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1, 12, 2.5], 'line-opacity': 0.75 }
      });
      map.addLayer({
        id: 'permits',
        type: 'circle',
        source: 'permits',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, ['case', ['get', 'selected'], 7, 3.5], 11, ['case', ['get', 'selected'], 10, 7]],
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
        const heading = document.createElement('div');
        heading.className = 'well-map-popup__title';
        heading.textContent = props.title;
        const detail = document.createElement('div');
        detail.className = 'well-map-popup__muted';
        detail.textContent = props.detail;
        body.append(heading, detail);
        popup.setLngLat(event.lngLat).setDOMContent(body).addTo(map);
      });
      map.on('mouseleave', 'permits', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
      });
      map.on('click', 'permits', (event) => {
        const key = String(event.features?.[0]?.properties?.key || '');
        if (key) onSelectRef.current(key);
      });
      readyRef.current = true;
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // The map is created once; data updates go through setData below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!readyRef.current || !mapRef.current) return;
    (mapRef.current.getSource('permits') as maplibregl.GeoJSONSource | undefined)?.setData(data.points);
    (mapRef.current.getSource('laterals') as maplibregl.GeoJSONSource | undefined)?.setData(data.lines);
  }, [data]);

  return (
    <div className="border border-line bg-panel/60 p-3">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400" aria-label="Map legend">
          {legend
            .filter((item) => present.has(item.key) || legendFilter)
            .map((item) => {
              const swatch = <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} aria-hidden="true" />;
              if (!legendFilter)
                return (
                  <li key={item.key} className="flex items-center gap-1.5">
                    {swatch}
                    {item.label}
                  </li>
                );
              const on = legendFilter.active.includes(item.label);
              const dim = legendFilter.active.length > 0 && !on;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    aria-pressed={on}
                    title={on ? `Remove the ${item.label} filter` : `Filter the page to ${item.label}`}
                    className={`flex items-center gap-1.5 hover:text-slate-200 ${on ? 'font-semibold text-slate-200 underline' : ''}`}
                    style={{ opacity: dim ? 0.55 : 1 }}
                    onClick={() => legendFilter.toggle(item.label)}
                  >
                    {swatch}
                    {item.label}
                  </button>
                </li>
              );
            })}
        </ul>
      </div>
      <div ref={containerRef} className="h-[340px] w-full sm:h-[430px]" role="region" aria-label={ariaLabel} />
    </div>
  );
}

function buildGeojson(points: MapPoint[], selectedKey: string | null) {
  const located = points.filter((point) => point.latitude !== null && point.longitude !== null);
  const pointFeatures = located
    .map((point) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [point.longitude as number, point.latitude as number] },
      properties: { key: point.key, color: point.color, stage: point.stage, title: point.title, detail: point.detail, selected: point.key === selectedKey }
    }))
    // Selected last so it draws on top.
    .sort((a, b) => Number(a.properties.selected) - Number(b.properties.selected));
  const lineFeatures = located
    .filter((point) => typeof point.bhlLatitude === 'number' && typeof point.bhlLongitude === 'number')
    .map((point) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [point.longitude as number, point.latitude as number],
          [point.bhlLongitude as number, point.bhlLatitude as number]
        ]
      },
      properties: { color: point.color }
    }));
  return {
    points: { type: 'FeatureCollection', features: pointFeatures } as GeoJSON.FeatureCollection,
    lines: { type: 'FeatureCollection', features: lineFeatures } as GeoJSON.FeatureCollection
  };
}
