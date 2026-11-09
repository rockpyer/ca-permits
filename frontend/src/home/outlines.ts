// Simplified state boundaries as [longitude, latitude] rings, for the small maps on the states page.
// California is hand-simplified to ~50 vertices (good to a few km at card size); Colorado and Wyoming
// are their survey-line rectangles.

export type Ring = Array<[number, number]>;

const CALIFORNIA: Ring = [
  [-124.21, 42.0], [-120.0, 42.0], [-120.0, 39.0], [-114.63, 35.0], [-114.57, 34.83], [-114.13, 34.29],
  [-114.43, 34.08], [-114.53, 33.92], [-114.5, 33.69], [-114.72, 33.4], [-114.7, 33.07], [-114.51, 32.97],
  [-114.47, 32.84], [-114.72, 32.72], [-117.12, 32.53], [-117.25, 32.88], [-117.33, 33.12], [-117.6, 33.39],
  [-118.0, 33.66], [-118.29, 33.71], [-118.42, 33.77], [-118.39, 33.86], [-118.52, 34.03], [-118.8, 34.0],
  [-119.21, 34.15], [-119.61, 34.42], [-120.47, 34.45], [-120.62, 34.56], [-120.64, 34.97], [-120.63, 35.15],
  [-120.87, 35.37], [-121.29, 35.68], [-121.89, 36.29], [-121.97, 36.58], [-121.8, 36.85], [-122.02, 36.97],
  [-122.39, 37.21], [-122.52, 37.59], [-122.5, 37.83], [-122.97, 37.99], [-123.02, 38.29], [-123.47, 38.71],
  [-123.72, 38.95], [-123.82, 39.37], [-123.85, 39.83], [-124.11, 40.1], [-124.41, 40.44], [-124.16, 40.8],
  [-124.11, 41.03], [-124.22, 41.39], [-124.2, 41.74], [-124.21, 42.0]
];

const COLORADO: Ring = [[-109.05, 41.0], [-102.05, 41.0], [-102.04, 36.99], [-109.04, 36.99], [-109.05, 41.0]];
const WYOMING: Ring = [[-111.05, 45.0], [-104.06, 45.0], [-104.05, 41.0], [-111.05, 40.99], [-111.05, 45.0]];

export const OUTLINES: Record<'ca' | 'co' | 'wy', Ring> = { ca: CALIFORNIA, co: COLORADO, wy: WYOMING };

// Equirectangular projection scaled by cos(mid-latitude), fit into width × height with padding.
export function projector(ring: Ring, width: number, height: number, pad = 6) {
  const lons = ring.map(([lon]) => lon), lats = ring.map(([, lat]) => lat);
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = (maxLon - minLon) * kx, spanY = maxLat - minLat;
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offX = (width - spanX * scale) / 2, offY = (height - spanY * scale) / 2;
  return ([lon, lat]: [number, number]): [number, number] => [offX + (lon - minLon) * kx * scale, offY + (maxLat - lat) * scale];
}
