const ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';

export async function fetchDrivingRoute(origin, destination, signal) {
  if (![origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude].every(Number.isFinite)) return [];
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const response = await fetch(`${ROUTE_URL}/${coordinates}?overview=full&geometries=geojson&steps=false`, { signal });
  if (!response.ok) {
    const error = new Error(response.status === 429 ? 'Route service throttled.' : 'Route request failed.');
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  if (payload?.code !== 'Ok' || !Array.isArray(payload.routes?.[0]?.geometry?.coordinates)) return [];
  return payload.routes[0].geometry.coordinates.map(([longitude, latitude]) => ({ latitude, longitude }));
}
