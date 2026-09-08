import { useEffect, useRef, useState } from 'react';
import { lookupDentonCountyLocation } from '../services/dentonCountyService';
import { reverseGeocode } from '../services/geocodingService';
import { distanceInMeters } from '../utils/geo';

const LOOKUP_DISTANCE_METERS = 20;
const LOOKUP_MAX_AGE_MS = 10_000;

export function usePartnerLocationDetails(location) {
  const [details, setDetails] = useState({ address: null, crossStreet: null, loading: true });
  const lastLookup = useRef({ location: null, timestamp: 0 });
  const requestId = useRef(0);

  useEffect(() => {
    if (!location) return;
    const now = Date.now();
    const moved = distanceInMeters(lastLookup.current.location, location);
    const expired = now - lastLookup.current.timestamp >= LOOKUP_MAX_AGE_MS;
    if (moved < LOOKUP_DISTANCE_METERS && !expired) return;

    lastLookup.current = { location, timestamp: now };
    const currentRequest = ++requestId.current;
    setDetails((current) => ({ ...current, loading: !current.address }));

    (async () => {
      try {
        const county = await lookupDentonCountyLocation(location.latitude, location.longitude);
        const address = county?.address || await reverseGeocode(location.latitude, location.longitude);
        if (requestId.current === currentRequest) {
          setDetails({ address, crossStreet: county?.crossStreet || null, loading: false });
        }
      } catch {
        if (requestId.current === currentRequest) {
          setDetails((current) => ({ ...current, loading: false }));
        }
      }
    })();
  }, [location?.latitude, location?.longitude]);

  return details;
}
