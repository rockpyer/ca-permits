import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import maplibregl from 'maplibre-gl';
import {
  FUNCTIONAL_TYPE_GROUPS,
  WORK_ACTIVITY_GROUPS,
  functionalTypeGroup,
  functionalTypeLabel,
  noticeType,
  sourceType,
  workActivityColor,
  workActivityGroup,
  workActivityLabel,
  type FunctionalTypeGroup,
  type WorkActivityGroup
} from '../lib/grouping';
import type { FieldBoundary, PermitActivity } from '../lib/types';

type Props = {
  rows: PermitActivity[];
  fields: FieldBoundary[];
  selected: PermitActivity | null;
  onSelect: (row: PermitActivity) => void;
};

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

export function ActivityMap({ rows, fields, selected, onSelect }: Props) {
  const [showFields, setShowFields] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null);
  const rowsRef = useRef<PermitActivity[]>(rows);
  const onSelectRef = useRef(onSelect);
  const showFieldsRef = useRef(showFields);
  const hasFitBoundsRef = useRef(false);
  const geojsonRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Point>>({ type: 'FeatureCollection', features: [] });
  const fieldGeojsonRef = useRef<GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>>({
    type: 'FeatureCollection',
    features: []
  });

  const geojson = useMemo(() => buildPermitGeojson(rows, selected), [rows, selected]);
  const fieldGeojson = useMemo(() => buildFieldGeojson(fields), [fields]);
  const activeFunctionalTypes = useMemo(() => activeFunctionalTypeDefinitions(rows), [rows]);
  const activeWorkActivities = useMemo(() => activeWorkActivityDefinitions(rows), [rows]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

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
    map.on('load', async () => {
      await loadPermitSymbolImages(map);
      addFieldLayers(map, fieldGeojsonRef.current);
      setFieldLayerVisibility(map, showFieldsRef.current);
      addPermitLayers(map, geojsonRef.current);
      fitToFeatures(map, geojsonRef.current, hasFitBoundsRef);
      map.on('click', 'permit-symbols', (event) => {
        const feature = event.features?.[0];
        const key = String(feature?.properties?.source_key || '');
        const row = rowsRef.current.find((item) => item.source_key === key);
        if (row) onSelectRef.current(row);
      });
      map.on('mouseenter', 'permit-symbols', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mousemove', 'permit-symbols', (event) => {
        const feature = event.features?.[0];
        const key = String(feature?.properties?.source_key || '');
        const row = rowsRef.current.find((item) => item.source_key === key);
        const coordinates = feature?.geometry.type === 'Point' ? (feature.geometry.coordinates as [number, number]) : null;
        if (!row || !coordinates) return;
        if (!hoverPopupRef.current) {
          hoverPopupRef.current = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 16,
            className: 'well-map-popup'
          });
        }
        hoverPopupRef.current.setLngLat(coordinates).setHTML(renderTooltip(row)).addTo(map);
      });
      map.on('mouseleave', 'permit-symbols', () => {
        map.getCanvas().style.cursor = '';
        hoverPopupRef.current?.remove();
      });
    });
    mapRef.current = map;

    return () => {
      hoverPopupRef.current?.remove();
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
    const permitSource = map.getSource('permits') as maplibregl.GeoJSONSource | undefined;
    if (permitSource) permitSource.setData(geojson);
    fitToFeatures(map, geojson, hasFitBoundsRef);
  }, [geojson]);

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
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-accent"
            checked={showFields}
            onChange={(event) => setShowFields(event.target.checked)}
          />
          Fields
        </label>
      </div>
      <WorkColorStrip activities={activeWorkActivities} />
      <MapLegend symbols={activeFunctionalTypes} activities={activeWorkActivities} />
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

function addPermitLayers(map: maplibregl.Map, data: GeoJSON.FeatureCollection<GeoJSON.Point>) {
  if (!map.getSource('permits')) {
    map.addSource('permits', {
      type: 'geojson',
      data
    });
  }

  if (!map.getLayer('permit-selection-halo')) {
    map.addLayer({
      id: 'permit-selection-halo',
      type: 'circle',
      source: 'permits',
      filter: ['==', ['get', 'selected'], true],
      paint: {
        'circle-radius': 14,
        'circle-color': '#f8fafc',
        'circle-opacity': 0.82,
        'circle-stroke-color': '#07110f',
        'circle-stroke-width': 2
      }
    });
  }

  if (!map.getLayer('permit-symbol-backplates')) {
    map.addLayer({
      id: 'permit-symbol-backplates',
      type: 'circle',
      source: 'permits',
      paint: {
        'circle-radius': ['case', ['==', ['get', 'selected'], true], 16, 10],
        'circle-color': '#07110f',
        'circle-opacity': ['case', ['==', ['get', 'selected'], true], 0.86, 0.62],
        'circle-stroke-color': ['case', ['==', ['get', 'selected'], true], '#f8fafc', '#dbeafe'],
        'circle-stroke-opacity': ['case', ['==', ['get', 'selected'], true], 1, 0.7],
        'circle-stroke-width': ['case', ['==', ['get', 'selected'], true], 2.5, 1]
      }
    });
  }

  if (!map.getLayer('permit-symbols')) {
    map.addLayer({
      id: 'permit-symbols',
      type: 'symbol',
      source: 'permits',
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': ['case', ['==', ['get', 'selected'], true], 0.72, 0.55],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      }
    });
  }
}

function setFieldLayerVisibility(map: maplibregl.Map, visible: boolean) {
  const visibility = visible ? 'visible' : 'none';
  ['field-fills', 'field-lines'].forEach((layer) => {
    if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', visibility);
  });
}

function WorkColorStrip({ activities }: { activities: typeof WORK_ACTIVITY_GROUPS }) {
  return (
    <div className="pointer-events-none absolute right-14 top-3 z-30 hidden max-w-[58%] flex-wrap gap-1.5 border border-line bg-ink/90 px-2 py-1.5 text-[11px] text-slate-300 md:flex">
      {activities.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function MapLegend({ symbols, activities }: { symbols: typeof FUNCTIONAL_TYPE_GROUPS; activities: typeof WORK_ACTIVITY_GROUPS }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-30 max-h-[38%] max-w-[360px] overflow-auto border border-line bg-ink/90 px-3 py-2 text-xs text-slate-300 sm:right-auto">
      <div className="mb-2 font-semibold uppercase tracking-wide text-slate-400">Map Legend</div>
      <div className="mb-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Color = Work Activity</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {activities.map((item) => (
            <span key={item.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Shape = Functional Type</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {symbols.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5">
            <span
              className="h-4 w-4 bg-slate-300"
              style={{
                WebkitMask: `url(/map-symbols/${item.symbol}) center / contain no-repeat`,
                mask: `url(/map-symbols/${item.symbol}) center / contain no-repeat`
              }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function buildPermitGeojson(rows: PermitActivity[], selected: PermitActivity | null): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: rows
      .filter((row) => isValidCaliforniaPoint(row))
      .map((row) => {
        const functionalType = functionalTypeGroup(row);
        const workActivity = workActivityGroup(row);
        const color = workActivityColor(workActivity);
        return {
          type: 'Feature' as const,
          properties: {
            source_key: row.source_key,
            functionalTypeGroup: functionalType,
            functionalType: functionalTypeLabel(functionalType),
            sourceType: sourceType(row),
            workActivityGroup: workActivity,
            workActivity: workActivityLabel(workActivity),
            noticeType: noticeType(row),
            color,
            icon: iconId(functionalType, workActivity),
            selected: selected?.source_key === row.source_key,
            operator_name: row.operator_name,
            field_name: row.field_name,
            well_type_label: row.well_type_label,
            notice_type_label: row.notice_type_label,
            api_10: row.api_10
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [row.longitude as number, row.latitude as number]
          }
        };
      })
  };
}

function activeFunctionalTypeDefinitions(rows: PermitActivity[]) {
  const present = new Set(rows.map(functionalTypeGroup));
  return FUNCTIONAL_TYPE_GROUPS.filter((definition) => present.has(definition.key));
}

function activeWorkActivityDefinitions(rows: PermitActivity[]) {
  const present = new Set(rows.map(workActivityGroup));
  return WORK_ACTIVITY_GROUPS.filter((definition) => present.has(definition.key));
}

async function loadPermitSymbolImages(map: maplibregl.Map) {
  await Promise.all(
    FUNCTIONAL_TYPE_GROUPS.flatMap((symbol) =>
      WORK_ACTIVITY_GROUPS.map(async (activity) => {
        const id = iconId(symbol.key, activity.key);
        if (map.hasImage(id)) return;
        const svg = await fetch(`/map-symbols/${symbol.symbol}`).then((response) => response.text());
        const imageData = await svgToImageData(svg.replace(/currentColor/g, activity.color));
        map.addImage(id, imageData, { pixelRatio: 2 });
      })
    )
  );
}

function svgToImageData(svg: string) {
  return new Promise<ImageData>((resolve, reject) => {
    const image = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error('Unable to create map symbol canvas'));
        return;
      }
      context.drawImage(image, 0, 0, 64, 64);
      const imageData = context.getImageData(0, 0, 64, 64);
      URL.revokeObjectURL(url);
      resolve(imageData);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to load map symbol SVG'));
    };
    image.src = url;
  });
}

function iconId(symbol: FunctionalTypeGroup, activity: WorkActivityGroup) {
  return `${symbol}-${activity}`;
}

function renderTooltip(row: PermitActivity) {
  const workGroup = workActivityGroup(row);
  const typeGroup = functionalTypeGroup(row);
  return `
    <div class="well-map-popup__body">
      <div class="well-map-popup__title">${escapeHtml(row.operator_name || 'Unknown operator')}</div>
      <div><strong>Work Activity:</strong> ${escapeHtml(workActivityLabel(workGroup))}</div>
      <div><strong>Activity Detail:</strong> ${escapeHtml(noticeType(row))}</div>
      <div><strong>Functional Type:</strong> ${escapeHtml(functionalTypeLabel(typeGroup))}</div>
      <div><strong>Source Type:</strong> ${escapeHtml(sourceType(row))}</div>
      <div>${escapeHtml(row.field_name || 'Unknown field')}${row.county ? `, ${escapeHtml(row.county)}` : ''}</div>
      <div class="well-map-popup__muted">API ${escapeHtml(row.api_display || row.api_10 || 'not available')}</div>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
