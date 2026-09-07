import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { lookupDentonCountyLocation } from '../services/dentonCountyService';
import { reverseGeocode } from '../services/geocodingService';
import { distanceInMeters } from '../utils/geo';

// GPS fixes update the screen immediately. Only the slower device geocoder is
// throttled so address lookups never hold up coordinates or direction.
const GEOCODE_MIN_DISTANCE_METERS = 12;
const GEOCODE_MAX_AGE_MS = 5000;
const GEOCODE_ERROR_BACKOFF_MS = 30000;

export function useLiveLocation() {
  const [location, setLocation] = useState(null);
  const [heading, setHeading] = useState(null);
  const [address, setAddress] = useState(null);
  const [mileMarker, setMileMarker] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('checking');
  const [error, setError] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const lastGeocodeRef = useRef({ location: null, timestamp: 0 });
  const geocodeInFlightRef = useRef(false);
  const geocodeBackoffUntilRef = useRef(0);

  const updateAddressIfNeeded = useCallback(async (nextLocation, force = false) => {
    const now = Date.now();
    const last = lastGeocodeRef.current;
    const moved = distanceInMeters(last.location, nextLocation.coords);
    const expired = now - last.timestamp >= GEOCODE_MAX_AGE_MS;
    if (!force && moved < GEOCODE_MIN_DISTANCE_METERS && !expired) return;
    if (!force && now < geocodeBackoffUntilRef.current) return;
    if (geocodeInFlightRef.current) return;

    geocodeInFlightRef.current = true;
    setIsGeocoding(true);
    try {
      const { latitude, longitude } = nextLocation.coords;
      let countyResult = null;
      try {
        countyResult = await lookupDentonCountyLocation(latitude, longitude);
      } catch {
        // The public county service may be unavailable or the device may be
        // offline. Continue immediately with the native geocoder fallback.
      }

      if (countyResult?.address) {
        setAddress(countyResult.address);
        setMileMarker(countyResult.mileMarker);
      } else {
        const result = await reverseGeocode(latitude, longitude);
        if (result) setAddress(result);
        setMileMarker(null);
      }
      geocodeBackoffUntilRef.current = 0;
      setError(null);
      lastGeocodeRef.current = { location: nextLocation.coords, timestamp: now };
    } catch {
      // Record the failed attempt and pause before retrying. Without this,
      // every fast GPS fix would immediately hit the geocoder again.
      lastGeocodeRef.current = { location: nextLocation.coords, timestamp: now };
      geocodeBackoffUntilRef.current = now + GEOCODE_ERROR_BACKOFF_MS;
      setError('Address is temporarily unavailable. Location is still updating.');
    } finally {
      geocodeInFlightRef.current = false;
      setIsGeocoding(false);
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const permission = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(permission.status);
    if (permission.status !== 'granted') {
      setError('Location permission is required to show your block and direction.');
      return () => {};
    }

    const initial = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });
    setLocation(initial);
    updateAddressIfNeeded(initial, true);

    const [locationSubscription, headingSubscription] = await Promise.all([
      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          // Android uses timeInterval as a hint. iOS delivers updates as the
          // native location manager makes them available.
          timeInterval: 250,
          distanceInterval: 0,
          mayShowUserSettingsDialog: true,
        },
        (nextLocation) => {
          setLocation(nextLocation);
          updateAddressIfNeeded(nextLocation);
        },
        () => setError('Location signal interrupted. Trying again…'),
      ),
      Location.watchHeadingAsync(
        (nextHeading) => setHeading(nextHeading),
        () => {},
      ),
    ]);

    return () => {
      locationSubscription.remove();
      headingSubscription.remove();
    };
  }, [updateAddressIfNeeded]);

  useEffect(() => {
    let stop = () => {};
    let mounted = true;
    start()
      .then((cleanup) => {
        if (mounted) stop = cleanup;
        else cleanup();
      })
      .catch(() => setError('Unable to start location. Check Location Services and try again.'));
    return () => {
      mounted = false;
      stop();
    };
  }, [start]);

  return {
    location,
    heading,
    address,
    mileMarker,
    permissionStatus,
    error,
    isGeocoding,
  };
}
