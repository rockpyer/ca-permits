import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import maplibregl from 'maplibre-gl';
import { WORK_GROUP_LABELS, classifyWork, countBy, type WorkGroup } from '../lib/summary';
import type { FieldBoundary, PermitActivity } from '../lib/types';

type Props = {
  rows: PermitActivity[];
  fields: FieldBoundary[];
  selected: PermitActivity | null;
  onSelect: (row: PermitActivity) => void;
};

type LegendType = 'permit_scope' | 'well_type' | 'operator' | 'date';

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
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
} as maplibregl.StyleSpecification;

const GROUP_COLORS: Record<WorkGroup, string> = {
  new_drill: '#36d399',
  reentry: '#c084fc',
  injection: '#60a5fa',
  abandonment: '#ef6767'
};

const CATEGORY_COLORS = ['#36d399', '#60a5fa', '#c084fc', '#f5b84b', '#ef6767', '#2dd4bf', '#f472b6'];

export function ActivityMap({ rows, fields, selected, onSelect }: Props) {
  const [legendType, setLegendType] = useState<LegendType>('permit_scope');
  const [showFields, setShowFields] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const rowsRef = useRef<PermitActivity[]>(rows);
  const selectedRef = useRef<PermitActivity | null>(selected);
  const onSelectRef = useRef(onSelect);
  const showFieldsRef = useRef(showFields);
  const hasFitBoundsRef = useRef(false);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const geojsonRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Point>>({ type: 'FeatureCollection', features: [] });
  const fieldGeojsonRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>>({
    type: 'FeatureCollection',
    features: []
  });

  const colorModel = useMemo(() => buildColorModel(rows, legendType), [rows, legendType]);

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: rows
        .filter((row) => isValidCaliforniaPoint(row))
        .map((row) => ({
          type: 'Feature' as const,
          properties: {
            source_key: row.source_key,
            color: colorForRow(row, colorModel),
            operator_name: row.operator_name,
            field_name: row.field_name
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [row.longitude as number, row.latitude as number]
          }
        }))
    }),
    [colorModel, rows]
  );

  const fieldGeojson = useMemo(() => buildFieldGeojson(fields), [fields]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    showFieldsRef.current = showFields;
  }, [showFields]);

  useEffect(() => {
    geojsonRef.current = geojson;
  }, [geojson]);

  useEffect(() => {
    fieldGeojsonRef.current = fieldGeojson;
  }, [fieldGeojson]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-119.4, 36.4],
      zoom: 5.6,
      attributionControl: false
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      addFieldLayers(map, fieldGeojsonRef.current);
      setFieldLayerVisibility(map, showFieldsRef.current);
      renderHtmlMarkers(map, geojsonRef.current, markerRefs, rowsRef, selectedRef, onSelectRef);
      fitToFeatures(map, geojsonRef.current, hasFitBoundsRef);
    });
    mapRef.current = map;
    return () => {
      clearMarkers(markerRefs);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const fieldSource = map.getSource('fields') as maplibregl.GeoJSONSource | undefined;
    if (fieldSource) fieldSource.setData(fieldGeojson);
    setFieldLayerVisibility(map, showFields);
  }, [fieldGeojson, showFields]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    renderHtmlMarkers(map, geojson, markerRefs, rowsRef, selectedRef, onSelectRef);
    fitToFeatures(map, geojson, hasFitBoundsRef);
  }, [geojson, selected]);

  useEffect(() => {
    if (!selected || !isValidCaliforniaPoint(selected) || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [selected.longitude as number, selected.latitude as number],
      zoom: Math.max(mapRef.current.getZoom(), 8)
    });
  }, [selected]);

  return (
    <div className="relative h-[420px] min-h-[360px] overflow-hidden border border-line bg-panel sm:h-[460px] xl:h-[590px]">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute left-3 top-3 z-30 flex flex-wrap gap-2 border border-line bg-ink/90 p-2 text-xs text-slate-300">
        <label className="map-control">
          Legend
          <select value={legendType} onChange={(event) => setLegendType(event.target.value as LegendType)}>
            <option value="permit_scope">Permit Scope</option>
            <option value="well_type">Well Type</option>
            <option value="operator">Operator</option>
            <option value="date">Date</option>
          </select>
        </label>
        <label className="map-control">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-accent"
            checked={showFields}
            onChange={(event) => setShowFields(event.target.checked)}
          />
          Fields
        </label>
      </div>
      <MapLegend colorModel={colorModel} />
    </div>
  );
}

function addFieldLayers(
  map: maplibregl.Map,
  data: GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>
) {
  if (map.getSource('fields')) return;

  map.addSource('fields', {
    type: 'geojson',
    data
  });
  map.addLayer({
    id: 'field-fills',
    type: 'fill',
    source: 'fields',
    paint: {
      'fill-color': '#19352f',
      'fill-opacity': 0.22
    }
  });
  map.addLayer({
    id: 'field-lines',
    type: 'line',
    source: 'fields',
    paint: {
      'line-color': '#36d399',
      'line-opacity': 0.55,
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 9, 1.4, 12, 2]
    }
  });
}

function setFieldLayerVisibility(map: maplibregl.Map, visible: boolean) {
  const visibility = visible ? 'visible' : 'none';
  ['field-fills', 'field-lines'].forEach((layer) => {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visibility);
  });
}

function MapLegend({ colorModel }: { colorModel: ColorModel }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-30 max-w-[360px] border border-line bg-ink/90 px-3 py-2 text-xs text-slate-300 sm:right-auto">
      <div className="mb-1 font-semibold uppercase tracking-wide text-slate-400">Map Legend</div>
      {colorModel.type === 'date' ? (
        <div className="space-y-1">
          <div className="h-2 w-56 bg-gradient-to-r from-[#60a5fa] via-[#36d399] to-[#ef6767]" />
          <div className="flex justify-between text-slate-400">
            <span>{colorModel.minDate || 'Older'}</span>
            <span>{colorModel.maxDate || 'Newer'}</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {colorModel.legend.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type ColorModel =
  | { type: 'date'; min: number; max: number; minDate: string | null; maxDate: string | null }
  | { type: 'category'; field: 'permit_scope' | 'well_type' | 'operator'; colors: Map<string, string>; legend: LegendItem[] };

type LegendItem = { label: string; color: string };

function buildColorModel(rows: PermitActivity[], legendType: LegendType): ColorModel {
  if (legendType === 'date') {
    const dated = rows
      .map((row) => row.notice_dated)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => a.localeCompare(b));
    const maxDate = dated[dated.length - 1] || null;
    return {
      type: 'date',
      min: dated[0] ? new Date(`${dated[0]}T00:00:00`).getTime() : 0,
      max: maxDate ? new Date(`${maxDate}T00:00:00`).getTime() : 0,
      minDate: dated[0] || null,
      maxDate
    };
  }

  if (legendType === 'permit_scope') {
    const colors = new Map<string, string>(
      (Object.keys(WORK_GROUP_LABELS) as WorkGroup[]).map((group) => [group, GROUP_COLORS[group]])
    );
    return {
      type: 'category',
      field: 'permit_scope',
      colors,
      legend: (Object.keys(WORK_GROUP_LABELS) as WorkGroup[]).map((group) => ({
        label: WORK_GROUP_LABELS[group],
        color: GROUP_COLORS[group]
      }))
    };
  }

  const key = legendType === 'well_type' ? 'well_type_label' : 'operator_name';
  const top = countBy(rows, key, 6).map((item) => item.name);
  const colors = new Map<string, string>(top.map((name, index) => [name, CATEGORY_COLORS[index % CATEGORY_COLORS.length]]));
  colors.set('Other', '#94a3b8');
  return {
    type: 'category',
    field: legendType,
    colors,
    legend: [...top.map((name) => ({ label: truncateLabel(name, 24), color: colors.get(name) || '#94a3b8' })), { label: 'Other', color: '#94a3b8' }]
  };
}

function colorForRow(row: PermitActivity, colorModel: ColorModel) {
  if (colorModel.type === 'date') {
    if (!row.notice_dated || colorModel.min === colorModel.max) return '#94a3b8';
    const value = new Date(`${row.notice_dated}T00:00:00`).getTime();
    const ratio = Math.max(0, Math.min(1, (value - colorModel.min) / (colorModel.max - colorModel.min)));
    return interpolateColor('#60a5fa', '#ef6767', ratio);
  }
  if (colorModel.field === 'permit_scope') {
    const group = classifyWork(row);
    return (group && colorModel.colors.get(group)) || '#94a3b8';
  }
  const value = colorModel.field === 'well_type' ? row.well_type_label : row.operator_name;
  return colorModel.colors.get(value || '') || colorModel.colors.get('Other') || '#94a3b8';
}

function renderHtmlMarkers(
  map: maplibregl.Map,
  data: GeoJSON.FeatureCollection<GeoJSON.Point>,
  markerRefs: MutableRefObject<maplibregl.Marker[]>,
  rowsRef: MutableRefObject<PermitActivity[]>,
  selectedRef: MutableRefObject<PermitActivity | null>,
  onSelectRef: MutableRefObject<(row: PermitActivity) => void>
) {
  clearMarkers(markerRefs);
  data.features.slice(0, 1000).forEach((feature) => {
    const key = String(feature.properties?.source_key || '');
    const row = rowsRef.current.find((item) => item.source_key === key);
    const element = document.createElement('button');
    element.type = 'button';
    element.className = `permit-marker${selectedRef.current?.source_key === key ? ' selected' : ''}`;
    element.style.backgroundColor = String(feature.properties?.color || '#94a3b8');
    element.title = [row?.notice_type_label, row?.operator_name, row?.field_name].filter(Boolean).join(' - ');
    element.addEventListener('click', () => {
      if (row) onSelectRef.current(row);
    });
    const marker = new maplibregl.Marker({ element, anchor: 'center' })
      .setLngLat(feature.geometry.coordinates as [number, number])
      .addTo(map);
    markerRefs.current.push(marker);
  });
}

function clearMarkers(markerRefs: MutableRefObject<maplibregl.Marker[]>) {
  markerRefs.current.forEach((marker) => marker.remove());
  markerRefs.current = [];
}

function buildFieldGeojson(fields: FieldBoundary[]): GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
  return {
    type: 'FeatureCollection',
    features: fields.flatMap((field) => {
      const geometry = esriPolygonToGeojson(field.geometry);
      if (!geometry) return [];
      return [
        {
          type: 'Feature' as const,
          properties: {
            source_object_id: field.source_object_id,
            field_name: field.field_name,
            field_code: field.field_code,
            district: field.district
          },
          geometry
        }
      ];
    })
  };
}

function esriPolygonToGeojson(geometry: unknown): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  if (!geometry || typeof geometry !== 'object' || !('rings' in geometry)) return null;
  const rings = (geometry as { rings?: unknown }).rings;
  if (!Array.isArray(rings) || rings.length === 0) return null;

  const validRings = rings.filter(isLinearRing).map(simplifyRingForDisplay);
  if (!validRings.length) return null;

  if (validRings.length === 1) {
    return {
      type: 'Polygon',
      coordinates: validRings
    };
  }

  return {
    type: 'MultiPolygon',
    coordinates: validRings.map((ring) => [ring])
  };
}

function isLinearRing(value: unknown): value is GeoJSON.Position[] {
  return (
    Array.isArray(value) &&
    value.length >= 4 &&
    value.every(
      (point) =>
        Array.isArray(point) &&
        point.length >= 2 &&
        typeof point[0] === 'number' &&
        typeof point[1] === 'number' &&
        point[0] >= -180 &&
        point[0] <= 180 &&
        point[1] >= -90 &&
        point[1] <= 90
    )
  );
}

function simplifyRingForDisplay(ring: GeoJSON.Position[]) {
  const maxPoints = 240;
  if (ring.length <= maxPoints) return ring;

  const step = Math.ceil(ring.length / maxPoints);
  const simplified = ring.filter((_, index) => index % step === 0);
  const first = simplified[0];
  const last = simplified[simplified.length - 1];

  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    simplified.push(first);
  }
  return simplified;
}

function fitToFeatures(
  map: maplibregl.Map,
  data: GeoJSON.FeatureCollection<GeoJSON.Point>,
  hasFitBoundsRef: MutableRefObject<boolean>
) {
  if (hasFitBoundsRef.current || data.features.length === 0) return;
  const bounds = new maplibregl.LngLatBounds();
  data.features.forEach((feature) => {
    bounds.extend(feature.geometry.coordinates as [number, number]);
  });
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 48, maxZoom: 8, duration: 0 });
    hasFitBoundsRef.current = true;
  }
}

function isValidCaliforniaPoint(row: PermitActivity) {
  return Boolean(
    row.latitude &&
      row.longitude &&
      row.latitude >= 32 &&
      row.latitude <= 43 &&
      row.longitude >= -125 &&
      row.longitude <= -113
  );
}

function interpolateColor(start: string, end: string, ratio: number) {
  const a = hexToRgb(start);
  const b = hexToRgb(end);
  const mixed = a.map((channel, index) => Math.round(channel + (b[index] - channel) * ratio));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function hexToRgb(hex: string) {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}

function truncateLabel(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
