import { distanceInMeters } from '../utils/geo';

const PUBLIC_SAFETY_URL =
  'https://gis.dentoncounty.gov/arcgis/rest/services/Public_Safety/MapServer';
const ROADS_URL = 'https://gis.dentoncounty.gov/arcgis/rest/services/Roads/MapServer/0';

const DENTON_BOUNDS = {
  south: 32.987,
  north: 33.431,
  west: -97.399,
  east: -96.833,
};

function isInDentonCounty(latitude, longitude) {
  return (
    latitude >= DENTON_BOUNDS.south &&
    latitude <= DENTON_BOUNDS.north &&
    longitude >= DENTON_BOUNDS.west &&
    longitude <= DENTON_BOUNDS.east
  );
}

function queryUrl(layerUrl, latitude, longitude, distance, outFields) {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    geometry: `${longitude},${latitude}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    distance: String(distance),
    units: 'esriSRUnit_Meter',
    outFields,
    returnGeometry: 'true',
    outSR: '4326',
  });
  return `${layerUrl}/query?${params.toString()}`;
}

async function queryFeatures(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Denton County GIS returned ${response.status}`);
  const result = await response.json();
  if (result.error) throw new Error(result.error.message || 'Denton County GIS query failed');
  return result.features || [];
}

function nearestPoint(features, location) {
  return features
    .map((feature) => ({
      ...feature,
      distanceMeters: distanceInMeters(location, {
        latitude: feature.geometry.y,
        longitude: feature.geometry.x,
      }),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null;
}

function metersPerLongitudeDegree(latitude) {
  return 111320 * Math.cos((latitude * Math.PI) / 180);
}

function pointToSegmentMeters(location, start, end) {
  const lonScale = metersPerLongitudeDegree(location.latitude);
  const ax = (start[0] - location.longitude) * lonScale;
  const ay = (start[1] - location.latitude) * 110540;
  const bx = (end[0] - location.longitude) * lonScale;
  const by = (end[1] - location.latitude) * 110540;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

function distanceToRoad(feature, location) {
  let nearest = Infinity;
  for (const path of feature.geometry?.paths || []) {
    for (let index = 1; index < path.length; index += 1) {
      nearest = Math.min(nearest, pointToSegmentMeters(location, path[index - 1], path[index]));
    }
  }
  return nearest;
}

function nearestRoad(features, location) {
  return features
    .map((feature) => ({ ...feature, distanceMeters: distanceToRoad(feature, location) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null;
}

function nearbyCrossStreet(features, location, primaryRoad) {
  const primaryName = normalizedStreet(primaryRoad?.attributes?.Street);
  return features
    .filter((feature) => {
      const name = normalizedStreet(feature.attributes?.Street);
      return name && name !== primaryName;
    })
    .map((feature) => ({ ...feature, distanceMeters: distanceToRoad(feature, location) }))
    .filter((feature) => feature.distanceMeters <= 90)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)[0] || null;
}

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizedStreet(value) {
  return clean(value)?.replace(/\s+/g, ' ').toUpperCase() || '';
}

function addressFromCounty(feature, road) {
  const attributes = feature?.attributes;
  if (!attributes) return null;
  const roadName = clean(road?.attributes?.Street);
  return {
    streetNumber: clean(attributes.HSNUM),
    street: roadName || clean(attributes.STREET),
    city: clean(attributes.NEWCITST) || clean(road?.attributes?.LTwn) || clean(road?.attributes?.RTwn),
    region: 'TX',
    postalCode: clean(attributes.NEWZIP),
    name: clean(attributes.NEW_ADDRES),
    source: 'Denton County 911 GIS',
  };
}

function roadRouteNumber(road) {
  const routeNumber = clean(road?.attributes?.RTNO)?.match(/\d+/)?.[0];
  if (routeNumber) return String(Number.parseInt(routeNumber, 10));
  const streetNumber = clean(road?.attributes?.Street)?.match(/\b(?:I|IH|US|SH|FM)[- ]?(\d+)\b/i)?.[1];
  return streetNumber ? String(Number.parseInt(streetNumber, 10)) : null;
}

function isHighwayRoad(road) {
  if (!road || road.distanceMeters > 45) return false;
  const value = `${road.attributes.MAJOR_RDS || ''} ${road.attributes.Street || ''}`.toUpperCase();
  return Boolean(roadRouteNumber(road)) && /\b(INT|INTERSTATE|IH|I[- ]?\d|US|SH|STATE HWY|FM|TOLL)\b/.test(value);
}

function formatRouteName(attributes) {
  const encoded = clean(attributes.RTE_NM) || '';
  if (encoded.startsWith('IH')) return `I-${Number.parseInt(attributes.RTE_NBR, 10)}`;
  if (encoded.startsWith('US')) return `US ${Number.parseInt(attributes.RTE_NBR, 10)}`;
  if (encoded.startsWith('FM')) return `FM ${Number.parseInt(attributes.RTE_NBR, 10)}`;
  if (encoded.startsWith('SH')) return `SH ${Number.parseInt(attributes.RTE_NBR, 10)}`;
  return clean(attributes.RTE_NBR) || encoded.split('-')[0];
}

export async function lookupDentonCountyLocation(latitude, longitude) {
  if (!isInDentonCounty(latitude, longitude)) return null;

  const location = { latitude, longitude };
  const [addressFeatures, roadFeatures, markerFeatures] = await Promise.all([
    queryFeatures(
      queryUrl(
        `${PUBLIC_SAFETY_URL}/8`,
        latitude,
        longitude,
        120,
        'HSNUM,STREET,NEWCITST,NEWZIP,NEW_ADDRES',
      ),
    ),
    queryFeatures(
      queryUrl(
        ROADS_URL,
        latitude,
        longitude,
        75,
        'Street,RTNO,LLO,LHI,RLO,RHI,LTwn,RTwn,MAJOR_RDS',
      ),
    ),
    queryFeatures(
      queryUrl(
        `${PUBLIC_SAFETY_URL}/7`,
        latitude,
        longitude,
        3219,
        'RTE_NM,RTE_NBR,DFO,MRKR_NBR,MRKR_SFX,RDBD_TYPE',
      ),
    ),
  ]);

  const road = nearestRoad(roadFeatures, location);
  const crossStreet = nearbyCrossStreet(roadFeatures, location, road);
  const roadStreet = normalizedStreet(road?.attributes?.Street);
  const sameRoadAddresses = addressFeatures.filter(
    (feature) => normalizedStreet(feature.attributes.STREET) === roadStreet,
  );
  const address = nearestPoint(sameRoadAddresses.length ? sameRoadAddresses : addressFeatures, location);
  const routeNumber = roadRouteNumber(road);
  const matchingMarkers = markerFeatures.filter(
    (feature) => String(Number.parseInt(feature.attributes.RTE_NBR, 10)) === routeNumber,
  );
  const marker = isHighwayRoad(road) ? nearestPoint(matchingMarkers, location) : null;

  return {
    address: addressFromCounty(address, road),
    road: road
      ? {
          name: clean(road.attributes.Street),
          distanceMeters: road.distanceMeters,
          source: 'Denton County Roads GIS',
        }
      : null,
    crossStreet: crossStreet
      ? {
          name: clean(crossStreet.attributes.Street),
          distanceMeters: crossStreet.distanceMeters,
          source: 'Denton County Roads GIS',
        }
      : null,
    mileMarker: marker
      ? {
          route: formatRouteName(marker.attributes),
          marker: `${marker.attributes.MRKR_NBR}${clean(marker.attributes.MRKR_SFX) || ''}`,
          distanceMeters: marker.distanceMeters,
          source: 'Denton County / TxDOT GIS',
        }
      : null,
  };
}
