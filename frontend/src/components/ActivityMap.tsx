import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import maplibregl from 'maplibre-gl';
import type { FieldBoundary, PermitActivity } from '../lib/types';

type Props = {
  rows: PermitActivity[];
  fields: FieldBoundary[];
  selected: PermitActivity | null;
  onSelect: (row: PermitActivity) => void;
};

type SymbolKey =
  | 'dry_gas'
  | 'gas'
  | 'liquefied_gas'
  | 'oil_gas'
  | 'water_source'
  | 'air_injection'
  | 'gas_disposal'
  | 'injection'
  | 'pressure_maintenance'
  | 'steamflood'
  | 'water_disposal'
  | 'waterflood'
  | 'cyclic_steam'
  | 'gas_storage'
  | 'multi_purpose'
  | 'core_hole'
  | 'dry_hole'
  | 'observation'
  | 'unknown'
  | 'gas_injection'
  | 'stratigraphic';

type ActivityKey = 'new_drill' | 'deepen' | 'sidetrack' | 'rework' | 'abandon' | 're_abandon' | 'other';

type SymbolDefinition = {
  key: SymbolKey;
  label: string;
  asset: string;
};

type ActivityDefinition = {
  key: ActivityKey;
  label: string;
  color: string;
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

const SYMBOL_DEFINITIONS: SymbolDefinition[] = [
  { key: 'dry_gas', label: 'Dry Gas', asset: 'dry-gas.svg' },
  { key: 'gas', label: 'Gas', asset: 'gas.svg' },
  { key: 'liquefied_gas', label: 'Liquefied Gas', asset: 'liquefied-gas.svg' },
  { key: 'oil_gas', label: 'Oil & Gas', asset: 'oil-gas.svg' },
  { key: 'water_source', label: 'Water Source', asset: 'water-source.svg' },
  { key: 'air_injection', label: 'Air Injection', asset: 'air-injection.svg' },
  { key: 'gas_disposal', label: 'Gas Disposal', asset: 'gas-disposal.svg' },
  { key: 'injection', label: 'Injection', asset: 'injection.svg' },
  { key: 'pressure_maintenance', label: 'Pressure Maintenance', asset: 'pressure-maintenance.svg' },
  { key: 'steamflood', label: 'Steamflood', asset: 'steamflood.svg' },
  { key: 'water_disposal', label: 'Water Disposal', asset: 'water-disposal.svg' },
  { key: 'waterflood', label: 'Waterflood', asset: 'waterflood.svg' },
  { key: 'cyclic_steam', label: 'Cyclic Steam', asset: 'cyclic-steam.svg' },
  { key: 'gas_storage', label: 'Gas Storage', asset: 'gas-storage.svg' },
  { key: 'multi_purpose', label: 'Multi Purpose', asset: 'multi-purpose.svg' },
  { key: 'core_hole', label: 'Core Hole', asset: 'core-hole.svg' },
  { key: 'dry_hole', label: 'Dry Hole', asset: 'dry-hole.svg' },
  { key: 'observation', label: 'Observation', asset: 'observation.svg' },
  { key: 'unknown', label: 'Unknown', asset: 'unknown.svg' },
  { key: 'gas_injection', label: 'Gas Injection', asset: 'gas-injection.svg' },
  { key: 'stratigraphic', label: 'Stratigraphic', asset: 'stratigraphic.svg' }
];

const ACTIVITY_DEFINITIONS: ActivityDefinition[] = [
  { key: 'new_drill', label: 'New Drill', color: '#36d399' },
  { key: 'deepen', label: 'Deepen', color: '#7dd3fc' },
  { key: 'sidetrack', label: 'Sidetrack', color: '#c084fc' },
  { key: 'rework', label: 'Rework', color: '#f5b84b' },
  { key: 'abandon', label: 'Abandon', color: '#ef6767' },
  { key: 're_abandon', label: 'Re-Abandon', color: '#fb7185' },
  { key: 'other', label: 'Other', color: '#94a3b8' }
];

const ACTIVITY_BY_KEY = new Map(ACTIVITY_DEFINITIONS.map((definition) => [definition.key, definition]));

export function ActivityMap({ rows, fields, selected, onSelect }: Props) {
  const [showFields, setShowFields] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
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
  const activeSymbols = useMemo(() => activeSymbolDefinitions(rows), [rows]);
  const activeActivities = useMemo(() => activeActivityDefinitions(rows), [rows]);

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
      map.on('mouseleave', 'permit-symbols', () => {
        map.getCanvas().style.cursor = '';
      });
    });
    mapRef.current = map;

    return () => {
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
      <MapLegend symbols={activeSymbols} activities={activeActivities} />
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
        'circle-radius': 17,
        'circle-color': '#f8fafc',
        'circle-opacity': 0.95,
        'circle-stroke-color': '#07110f',
        'circle-stroke-width': 3
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
        'icon-size': ['case', ['==', ['get', 'selected'], true], 0.46, 0.34],
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

function MapLegend({ symbols, activities }: { symbols: SymbolDefinition[]; activities: ActivityDefinition[] }) {
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 right-3 z-30 max-h-[52%] max-w-[430px] overflow-auto border border-line bg-ink/90 px-3 py-2 text-xs text-slate-300 sm:right-auto">
      <div className="mb-2 font-semibold uppercase tracking-wide text-slate-400">Map Legend</div>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Color = Work Activity</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {activities.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Shape = Well Type</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {symbols.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-1.5">
                <span
                  className="h-3.5 w-3.5 bg-slate-300"
                  style={{
                    WebkitMask: `url(/map-symbols/${item.asset}) center / contain no-repeat`,
                    mask: `url(/map-symbols/${item.asset}) center / contain no-repeat`
                  }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </div>
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
        const symbol = symbolKeyForWellType(row);
        const workActivity = activityKeyForPermit(row);
        const activity = ACTIVITY_BY_KEY.get(workActivity) || ACTIVITY_BY_KEY.get('other');
        return {
          type: 'Feature' as const,
          properties: {
            source_key: row.source_key,
            symbol,
            work_group: activity?.label || 'Other',
            color: activity?.color || '#94a3b8',
            icon: iconId(symbol, workActivity),
            selected: selected?.source_key === row.source_key,
            operator_name: row.operator_name,
            field_name: row.field_name,
            well_type_label: row.well_type_label
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [row.longitude as number, row.latitude as number]
          }
        };
      })
  };
}

function activeSymbolDefinitions(rows: PermitActivity[]) {
  const present = new Set(rows.map(symbolKeyForWellType));
  return SYMBOL_DEFINITIONS.filter((definition) => present.has(definition.key)).slice(0, 10);
}

function activeActivityDefinitions(rows: PermitActivity[]) {
  const present = new Set(rows.map(activityKeyForPermit));
  return ACTIVITY_DEFINITIONS.filter((definition) => present.has(definition.key));
}

async function loadPermitSymbolImages(map: maplibregl.Map) {
  await Promise.all(
    SYMBOL_DEFINITIONS.flatMap((symbol) =>
      ACTIVITY_DEFINITIONS.map(async (activity) => {
        const id = iconId(symbol.key, activity.key);
        if (map.hasImage(id)) return;
        const svg = await fetch(`/map-symbols/${symbol.asset}`).then((response) => response.text());
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

function iconId(symbol: SymbolKey, activity: ActivityKey) {
  return `${symbol}-${activity}`;
}

function symbolKeyForWellType(row: PermitActivity): SymbolKey {
  const value = normalizeWellType(`${row.well_type_label || ''} ${row.well_type || ''}`);
  if (value.includes('drygas')) return 'dry_gas';
  if (value.includes('liquefiedgas')) return 'liquefied_gas';
  if (value.includes('oilgas')) return 'oil_gas';
  if (value.includes('watersource')) return 'water_source';
  if (value.includes('airinjection')) return 'air_injection';
  if (value.includes('gasdisposal')) return 'gas_disposal';
  if (value.includes('pressuremaintenance')) return 'pressure_maintenance';
  if (value.includes('steamflood')) return 'steamflood';
  if (value.includes('waterdisposal')) return 'water_disposal';
  if (value.includes('waterflood')) return 'waterflood';
  if (value.includes('cyclicsteam')) return 'cyclic_steam';
  if (value.includes('gasstorage')) return 'gas_storage';
  if (value.includes('multipurpose')) return 'multi_purpose';
  if (value.includes('corehole')) return 'core_hole';
  if (value.includes('dryhole')) return 'dry_hole';
  if (value.includes('observation')) return 'observation';
  if (value.includes('gasinjection')) return 'gas_injection';
  if (value.includes('stratigraphic')) return 'stratigraphic';
  if (value.includes('injection')) return 'injection';
  if (value.includes('gas')) return 'gas';
  return 'unknown';
}

function normalizeWellType(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

function activityKeyForPermit(row: PermitActivity): ActivityKey {
  const noticeType = row.notice_type || row.notice_type_label || '';
  if (noticeType.includes('Re-Abandon')) return 're_abandon';
  if (noticeType.includes('Abandon')) return 'abandon';
  if (noticeType.includes('New Drill')) return 'new_drill';
  if (noticeType.includes('Deepen')) return 'deepen';
  if (noticeType.includes('Sidetrack')) return 'sidetrack';
  if (noticeType.includes('Rework')) return 'rework';
  return 'other';
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
