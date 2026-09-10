import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { usePartnerLocationDetails } from '../hooks/usePartnerLocationDetails';
import { fetchDrivingRoute } from '../services/routeService';
import { lookupNearbyDentonCountyAddresses } from '../services/dentonCountyService';
import { colors } from '../theme/colors';
import { getPartnerPresence } from '../utils/presence';
import { deriveHundredBlock, formatLocality, formatStreet } from '../utils/address';
import { formatDirection } from '../utils/direction';
import { distanceInMeters } from '../utils/geo';
import { lastName } from '../utils/name';

const partnerCrew = (item) => (item.occupants?.length ? item.occupants : [item.name]);
const crewCallSigns = (item) => partnerCrew(item).map((name, index) => item.occupantCallSigns?.[index] || (index === 0 ? item.callSign : null) || '—');
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#17212B' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#AAB6C2' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#101820' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#354555' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#18242D' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1E2D36' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#8FA0AE' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2B3947' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111A22' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#D7DEE5' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#495867' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#24323D' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#091B2C' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#718596' }] },
];
const locationAge = (timestamp) => {
  if (!Number.isFinite(timestamp)) return 'UPDATE TIME UNAVAILABLE';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `UPDATED ${seconds} SEC AGO`;
  return `UPDATED ${Math.round(seconds / 60)} MIN AGO`;
};
const bearingBetween = (from, to) => {
  if (!from || !to) return 0;
  const radians = (value) => value * Math.PI / 180;
  const degrees = (value) => value * 180 / Math.PI;
  const startLatitude = radians(from.latitude);
  const endLatitude = radians(to.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const y = Math.sin(longitudeDelta) * Math.cos(endLatitude);
  const x = Math.cos(startLatitude) * Math.sin(endLatitude) - Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDelta);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
};
const trimRouteFromPosition = (coordinates, position) => {
  if (coordinates.length < 2 || !position) return coordinates;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  coordinates.forEach((coordinate, index) => {
    const distance = distanceInMeters(position, coordinate);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return coordinates.slice(Math.min(nearestIndex + 1, coordinates.length - 1));
};

function PartnerCarMarker({ callSigns, dutyStatus, mode }) {
  const pursuitPulse = useRef(new Animated.Value(0)).current;
  const pursuitRotation = useRef(new Animated.Value(0)).current;
  const isPursuit = dutyStatus === 'pursuit';
  const lightsActive = ['traffic_stop', 'pursuit'].includes(dutyStatus);
  const hasUnderGlow = ['traffic_stop', 'cover_requested', 'pursuit'].includes(dutyStatus);
  useEffect(() => {
    if (!lightsActive) { pursuitPulse.stopAnimation(); pursuitPulse.setValue(0); return undefined; }
    const duration = isPursuit ? 280 : 600;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pursuitPulse, { toValue: 1, duration, useNativeDriver: false }),
      Animated.timing(pursuitPulse, { toValue: 0, duration, useNativeDriver: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [isPursuit, lightsActive, pursuitPulse]);
  useEffect(() => {
    if (!isPursuit) { pursuitRotation.stopAnimation(); pursuitRotation.setValue(0); return undefined; }
    const animation = Animated.loop(Animated.timing(pursuitRotation, { toValue: 1, duration: 850, easing: Easing.linear, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [isPursuit, pursuitRotation]);
  const pursuitLeft = pursuitPulse.interpolate({ inputRange: [0, 1], outputRange: ['#EF233C', '#3478F6'] });
  const pursuitRight = pursuitPulse.interpolate({ inputRange: [0, 1], outputRange: ['#3478F6', '#EF233C'] });
  const glowColor = lightsActive ? pursuitLeft : dutyStatus === 'cover_requested' ? colors.danger : colors.success;
  const label = callSigns.length > 1 ? `${callSigns[0]} +${callSigns.length - 1}` : callSigns[0];
  return (
    <View style={[styles.partnerCarStack, mode === 'compact' && styles.partnerCarStackCompact, mode === 'dot' && styles.partnerCarStackDot]}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={[styles.partnerCallSignText, mode === 'compact' && styles.partnerCallSignTextCompact, mode === 'dot' && styles.partnerCallSignTextDot]}>{label}</Text>
      <View style={styles.partnerCarImageWrap}>
        {isPursuit ? <Animated.View style={[styles.partnerPursuitOrbit, mode === 'compact' && styles.partnerPursuitOrbitCompact, mode === 'dot' && styles.partnerPursuitOrbitDot, { transform: [{ rotate: pursuitRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}><View style={[styles.partnerOrbitLight, styles.partnerOrbitTop, styles.partnerOrbitRed]} /><View style={[styles.partnerOrbitLight, styles.partnerOrbitBottom, styles.partnerOrbitBlue]} /></Animated.View> : null}
        {hasUnderGlow ? <><Animated.View style={[styles.partnerUnderGlow, mode === 'compact' && styles.partnerUnderGlowCompact, mode === 'dot' && styles.partnerUnderGlowDot, { backgroundColor: glowColor, shadowColor: glowColor }]} /><View style={[styles.partnerUnderGlowMask, mode === 'compact' && styles.partnerUnderGlowMaskCompact, mode === 'dot' && styles.partnerUnderGlowMaskDot]} /></> : null}
        <Image source={require('../../assets/partner-unit-car.png')} resizeMode="contain" fadeDuration={0} tintColor={null} style={[styles.partnerCarImage, mode === 'compact' && styles.partnerCarImageCompact, mode === 'dot' && styles.partnerCarImageDot]} />
        <View style={[styles.partnerLightBar, mode === 'compact' && styles.partnerLightBarCompact, mode === 'dot' && styles.partnerLightBarDot]}>{lightsActive ? <><Animated.View style={[styles.partnerBlueLight, { backgroundColor: pursuitLeft }]} /><Animated.View style={[styles.partnerRedLight, { backgroundColor: pursuitRight }]} /></> : null}</View>
      </View>
    </View>
  );
}

function CurrentUnitMarker({ callSign, secondOfficerCallSign, sharedUnit, fullscreen, dutyStatus, heading, mode }) {
  const lightPulse = useRef(new Animated.Value(0)).current;
  const lightsActive = ['traffic_stop', 'cover_requested', 'pursuit'].includes(dutyStatus);
  useEffect(() => {
    if (!lightsActive) { lightPulse.stopAnimation(); lightPulse.setValue(0); return undefined; }
    const duration = dutyStatus === 'pursuit' ? 280 : 600;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(lightPulse, { toValue: 1, duration, useNativeDriver: false }),
      Animated.timing(lightPulse, { toValue: 0, duration, useNativeDriver: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [dutyStatus, lightPulse, lightsActive]);
  const rotation = Number.isFinite(heading) && heading >= 0 ? `${heading}deg` : '0deg';
  const pairedCallSign = sharedUnit ? secondOfficerCallSign : null;
  const leftLight = lightPulse.interpolate({ inputRange: [0, 1], outputRange: ['#3478F6', '#EF233C'] });
  const rightLight = lightPulse.interpolate({ inputRange: [0, 1], outputRange: ['#EF233C', '#3478F6'] });
  return (
    <View style={[styles.currentUnitMarker, { transform: [{ rotate: rotation }] }]}>
      {callSign && pairedCallSign ? <Text style={[styles.currentUnitSideCallSign, styles.currentUnitLeftCallSign, mode !== 'detail' && styles.currentUnitSideCallSignCompact, mode !== 'detail' && styles.currentUnitLeftCallSignCompact]}>{callSign}</Text> : null}
      {callSign && !pairedCallSign ? <Text style={[styles.currentUnitCallSign, mode !== 'detail' && styles.currentUnitCallSignCompact]}>{callSign}</Text> : null}
      <Image source={require('../../assets/current-unit-car.png')} resizeMode="contain" fadeDuration={0} tintColor={null} style={[styles.currentUnitCar, mode === 'compact' && styles.currentUnitCarCompact, mode === 'dot' && styles.currentUnitCarDot]} />
      <View style={[styles.currentLightBar, mode === 'compact' && styles.currentLightBarCompact, mode === 'dot' && styles.currentLightBarDot]}>{lightsActive ? <><Animated.View style={[styles.partnerBlueLight, { backgroundColor: leftLight }]} /><Animated.View style={[styles.partnerRedLight, { backgroundColor: rightLight }]} /></> : null}</View>
      {pairedCallSign ? <Text style={[styles.currentUnitSideCallSign, styles.currentUnitRightCallSign, mode !== 'detail' && styles.currentUnitSideCallSignCompact, mode !== 'detail' && styles.currentUnitRightCallSignCompact]}>{pairedCallSign}</Text> : null}
    </View>
  );
}

export default function PartnerDetailScreen({ partner, partners, duty, sharedUnit = false, userLocation, fullscreenRequestKey = 0, onBack }) {
  const mapRef = useRef(null);
  const lastRouteRequestRef = useRef({ origin: null, destination: null });
  const routeAbortRef = useRef(null);
  const followResumeTimerRef = useRef(null);
  const cameraTiltTimerRef = useRef(null);
  const lastCameraFrameRef = useRef(null);
  const houseNumberLookupRef = useRef({ location: null, request: 0 });
  const [markerMode, setMarkerMode] = useState('detail');
  const [autoFrame, setAutoFrame] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeHealth, setRouteHealth] = useState('loading');
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [nearbyHouseNumbers, setNearbyHouseNumbers] = useState([]);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const presence = getPartnerPresence(partner);
  const locationDetails = usePartnerLocationDetails(partner.location);
  const block = deriveHundredBlock(locationDetails.address);
  const partnerSpeed = partner.location?.speed;
  const travelDirection = Number.isFinite(partnerSpeed) && partnerSpeed < 1.5
    ? { label: 'STOPPED' }
    : formatDirection({
        course: partner.location?.heading,
        speed: partnerSpeed,
        compassHeading: null,
      });
  const currentUnit = `Unit ${duty?.unitNumber || ''}`;
  const normalizedCurrentUnit = currentUnit.replace(/\s+/g, '').toLowerCase();
  const normalizedCurrentCallSign = String(duty?.callSign || '').trim().toLowerCase();
  const mapPartners = userLocation?.coords
    ? (partners || []).filter((item) => {
        const sameUnit = duty?.unitNumber && String(item.unit || '').replace(/\s+/g, '').toLowerCase() === normalizedCurrentUnit;
        const sameCallSign = normalizedCurrentCallSign && crewCallSigns(item).some((callSign) => String(callSign).trim().toLowerCase() === normalizedCurrentCallSign);
        return !sameUnit && !sameCallSign;
      })
    : (partners || []);
  const unitCallSigns = crewCallSigns(partner).join(' | ');

  useEffect(() => {
    if (fullscreenRequestKey > 0) setMapFullscreen(true);
  }, [fullscreenRequestKey]);
  const liveRouteCoordinates = routeCoordinates.length > 1 && userLocation?.coords
    ? [
        { latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude },
        ...trimRouteFromPosition(routeCoordinates.slice(1, -1), userLocation.coords),
        { latitude: partner.location.latitude, longitude: partner.location.longitude },
      ]
    : routeCoordinates;

  useEffect(() => {
    const origin = userLocation?.coords;
    const destination = partner.location;
    if (![origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude].every(Number.isFinite)) {
      setRouteCoordinates([]);
      setRouteHealth('unavailable');
      return undefined;
    }
    const previous = lastRouteRequestRef.current;
    const coordinatesChanged = !previous.origin || !previous.destination
      || origin.latitude !== previous.origin.latitude
      || origin.longitude !== previous.origin.longitude
      || destination.latitude !== previous.destination.latitude
      || destination.longitude !== previous.destination.longitude;
    if (!coordinatesChanged) return undefined;
    lastRouteRequestRef.current = { origin, destination };
    routeAbortRef.current?.abort();
    const controller = new AbortController();
    routeAbortRef.current = controller;
    fetchDrivingRoute(origin, destination, controller.signal).then((coordinates) => {
      const exactRoute = coordinates.length > 1
        ? [
            { latitude: origin.latitude, longitude: origin.longitude },
            ...coordinates,
            { latitude: destination.latitude, longitude: destination.longitude },
          ]
        : coordinates;
      setRouteCoordinates(exactRoute);
      setRouteHealth(exactRoute.length > 1 ? 'current' : 'unavailable');
    }).catch((error) => {
      if (error?.name !== 'AbortError') setRouteHealth(error?.status === 429 ? 'throttled' : 'unavailable');
    });
    return undefined;
  }, [partner.location.latitude, partner.location.longitude, userLocation?.coords.latitude, userLocation?.coords.longitude]);
  useEffect(() => () => routeAbortRef.current?.abort(), []);
  useEffect(() => () => clearTimeout(followResumeTimerRef.current), []);
  useEffect(() => () => clearTimeout(cameraTiltTimerRef.current), []);

  useEffect(() => {
    if (!mapFullscreen || !userLocation?.coords) {
      setNearbyHouseNumbers([]);
      houseNumberLookupRef.current.location = null;
      houseNumberLookupRef.current.request += 1;
      return;
    }
    const center = userLocation.coords;
    if (distanceInMeters(houseNumberLookupRef.current.location, center) < 55) return;
    houseNumberLookupRef.current.location = center;
    const request = houseNumberLookupRef.current.request + 1;
    houseNumberLookupRef.current.request = request;
    lookupNearbyDentonCountyAddresses(center.latitude, center.longitude, 340)
      .then((addresses) => {
        if (houseNumberLookupRef.current.request === request && addresses.length) {
          setNearbyHouseNumbers((current) => {
            const merged = new Map(current.map((address) => [address.id, address]));
            addresses.forEach((address) => merged.set(address.id, address));
            return [...merged.values()]
              .filter((address) => distanceInMeters(center, address.coordinate) <= 420)
              .slice(0, 70);
          });
        }
      })
      .catch(() => { /* Keep the last successful address overlay during a temporary GIS failure. */ });
  }, [mapFullscreen, userLocation?.coords?.latitude, userLocation?.coords?.longitude]);

  const updateMarkerMode = (region) => {
    const nextMode = region.latitudeDelta > 0.5 ? 'dot' : region.latitudeDelta > 0.08 ? 'compact' : 'detail';
    setMarkerMode((current) => current === nextMode ? current : nextMode);
  };

  const frameBothLocations = (force = false) => {
    if (!mapRef.current || (!autoFrame && !force)) return;
    const userCoords = userLocation?.coords;
    const selectedPartnerCoords = partner.location;
    const previousFrame = lastCameraFrameRef.current;
    const routeEnd = liveRouteCoordinates[liveRouteCoordinates.length - 1];
    const routeRevision = liveRouteCoordinates.length
      ? `${liveRouteCoordinates.length}:${liveRouteCoordinates[0]?.latitude}:${liveRouteCoordinates[0]?.longitude}:${routeEnd?.latitude}:${routeEnd?.longitude}`
      : 'direct';
    const frameChanged = !previousFrame
      || previousFrame.width !== width
      || previousFrame.height !== height
      || previousFrame.fullscreen !== mapFullscreen
      || previousFrame.routeRevision !== routeRevision
      || distanceInMeters(previousFrame.user, userCoords) >= 8
      || distanceInMeters(previousFrame.partner, selectedPartnerCoords) >= 8;
    if (!force && !frameChanged) return;
    lastCameraFrameRef.current = { user: userCoords, partner: selectedPartnerCoords, width, height, fullscreen: mapFullscreen, routeRevision };
    const coordinates = [
      ...(userCoords ? [{ latitude: userCoords.latitude, longitude: userCoords.longitude }] : []),
      ...(Number.isFinite(selectedPartnerCoords?.latitude) && Number.isFinite(selectedPartnerCoords?.longitude)
        ? [{ latitude: selectedPartnerCoords.latitude, longitude: selectedPartnerCoords.longitude }]
        : []),
    ];
    if (coordinates.length < 2) {
      mapRef.current.animateToRegion({
        latitude: partner.location.latitude,
        longitude: partner.location.longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      }, 400);
      return;
    }
    const distance = distanceInMeters(userCoords, selectedPartnerCoords);
    const nearby = distance < 805;
    const closeDrivingView = distance < 400;
    const forwardRoutePoint = liveRouteCoordinates.find((coordinate) => distanceInMeters(userCoords, coordinate) >= 20);
    const drivingHeading = Number.isFinite(userCoords.heading) && userCoords.heading >= 0 && (userCoords.speed || 0) >= 1.5
      ? userCoords.heading
      : bearingBetween(userCoords, forwardRoutePoint || selectedPartnerCoords);
    if (mapFullscreen) {
      const altitude = distance < 500 ? 105 : distance < 1_600 ? 130 : 160;
      mapRef.current.animateCamera({
        center: {
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
        },
        heading: drivingHeading,
        pitch: 65,
        altitude,
      }, { duration: 450 });
      return;
    }
    const routeToFrame = liveRouteCoordinates.length > 1 ? liveRouteCoordinates : coordinates;
    const edgePadding = nearby
      ? { top: 58, right: 52, bottom: 58, left: 52 }
      : { top: 105, right: 90, bottom: 105, left: 90 };
    mapRef.current.fitToCoordinates(routeToFrame, { edgePadding, animated: true });
    clearTimeout(cameraTiltTimerRef.current);
    cameraTiltTimerRef.current = setTimeout(async () => {
      try {
        if (!mapRef.current) return;
        const camera = await mapRef.current.getCamera();
        const nextPitch = closeDrivingView ? 52 : 0;
        const nextHeading = closeDrivingView ? drivingHeading : 0;
        if (Math.abs((camera.pitch || 0) - nextPitch) < 1 && Math.abs((camera.heading || 0) - nextHeading) < 1) return;
        mapRef.current?.animateCamera({ ...camera, heading: nextHeading, pitch: nextPitch }, { duration: 350 });
      } catch { /* Keep the fitted overhead view when camera tilt is unavailable. */ }
    }, 450);
  };

  const pauseAutoFrame = () => {
    setAutoFrame(false);
    clearTimeout(cameraTiltTimerRef.current);
    clearTimeout(followResumeTimerRef.current);
    followResumeTimerRef.current = setTimeout(() => setAutoFrame(true), 8_000);
  };

  const resumeAutoFrame = () => {
    clearTimeout(followResumeTimerRef.current);
    setAutoFrame(true);
    frameBothLocations(true);
  };

  useEffect(frameBothLocations, [
    partner.location.latitude,
    partner.location.longitude,
    duty?.unitNumber,
    userLocation?.coords.latitude,
    userLocation?.coords.longitude,
    liveRouteCoordinates,
    mapFullscreen,
    width,
    height,
    autoFrame,
  ]);

  const statusBanner = partner.dutyStatus === 'cover_requested'
    ? <Text style={[styles.dutyBanner, styles.coverBanner]}>COVER REQUESTED</Text>
    : partner.dutyStatus === 'traffic_stop'
      ? <Text style={[styles.dutyBanner, styles.stopBanner]}>TRAFFIC STOP</Text>
      : partner.dutyStatus === 'pursuit' ? <Text style={[styles.dutyBanner, styles.pursuitBanner]}>PURSUIT</Text> : null;
  const selectedAddress = [locationDetails.address?.streetNumber, formatStreet(locationDetails.address)].filter(Boolean).join(' ');
  const identityAndLocation = (
    <>
      <View style={styles.unitHeader}><Text style={styles.unit}>{unitCallSigns}</Text><Text style={styles.unitCallSigns}>{partner.unit.toUpperCase()}</Text></View>
      <View style={styles.sectionDivider} />
      {statusBanner}
      <View style={[styles.locationSummary, isLandscape && styles.locationSummaryLandscape]}>
        <Text style={styles.locationLabel}>CURRENT LOCATION</Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.partnerStreet, isLandscape && styles.partnerStreetLandscape]} numberOfLines={1}>{locationDetails.loading ? 'LOCATING STREET…' : [locationDetails.address?.streetNumber, formatStreet(locationDetails.address)].filter(Boolean).join(' ')}</Text>
        {block ? <Text style={styles.partnerBlock}>{block}</Text> : null}
        <Text style={styles.locality}>{formatLocality(locationDetails.address).toUpperCase()}</Text>
        <View style={styles.locationDivider} />
        {locationDetails.crossStreet?.name ? <View style={styles.crossStreetGroup}><Text style={styles.crossStreetLabel}>CROSS STREET</Text><Text adjustsFontSizeToFit minimumFontScale={0.65} style={styles.crossStreetName} numberOfLines={1}>{locationDetails.crossStreet.name.toUpperCase()} <Text style={styles.crossStreetDistance}>· {Math.round(locationDetails.crossStreet.distanceMeters * 3.28084)} FT</Text></Text></View> : <Text style={styles.crossStreetUnavailable}>CROSS STREET · NOT AVAILABLE</Text>}
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.travelDirection}><Text style={travelDirection.label !== 'STOPPED' ? styles.travelDirectionMoving : null}>{travelDirection.label}</Text> · {locationAge(partner.location?.timestamp)}</Text>
      </View>
    </>
  );
  const mapPanel = (frameStyle) => (
    <View style={[styles.mapFrame, frameStyle]}>
          <MapView
            key={mapFullscreen ? 'fullscreen-driving-map' : 'embedded-route-map'}
            ref={mapRef}
            style={styles.map}
            userInterfaceStyle="dark"
            customMapStyle={DARK_MAP_STYLE}
            showsBuildings
            pitchEnabled
            rotateEnabled
            scrollEnabled
            zoomEnabled
            onMapReady={() => frameBothLocations(true)}
            onRegionChangeComplete={updateMarkerMode}
            onPanDrag={pauseAutoFrame}
            initialRegion={{
              latitude: partner.location.latitude,
              longitude: partner.location.longitude,
              latitudeDelta: 0.025,
              longitudeDelta: 0.025,
            }}
          >
            {liveRouteCoordinates.length > 1 ? <Polyline coordinates={liveRouteCoordinates} strokeColor={colors.accent} strokeWidth={6} lineCap="round" lineJoin="round" zIndex={2} /> : null}
            {mapFullscreen ? nearbyHouseNumbers.map((address) => (
              <Marker
                key={`house-${address.id}`}
                coordinate={address.coordinate}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges
                zIndex={50}
              >
                <View pointerEvents="none" style={styles.houseNumberBadge}>
                  <Text style={styles.houseNumberText}>{address.houseNumber}</Text>
                </View>
              </Marker>
            )) : null}
            {userLocation?.coords ? (
              <Marker
                coordinate={{
                  latitude: userLocation.coords.latitude,
                  longitude: userLocation.coords.longitude,
                }}
                title={currentUnit}
                description="Your unit's live GPS location"
              anchor={{ x: 0.5, y: 0.5 }}
              >
                <CurrentUnitMarker callSign={duty?.callSign} secondOfficerCallSign={duty?.secondOfficerCallSign} sharedUnit={sharedUnit} fullscreen={mapFullscreen} dutyStatus={duty?.status} heading={mapFullscreen ? 0 : userLocation.coords.heading} mode={markerMode} />
              </Marker>
            ) : null}
            {mapPartners.map((mapPartner) => (
              <Marker key={mapPartner.id} coordinate={mapPartner.location} title={`${mapPartner.unit} ${lastName(mapPartner.name)}`} description={mapPartner.id === partner.id ? 'Selected partner' : 'Squad partner'} anchor={{ x: 0.5, y: 0.5 }} zIndex={mapPartner.id === partner.id ? 10 : 1}>
                <PartnerCarMarker callSigns={crewCallSigns(mapPartner)} dutyStatus={mapPartner.dutyStatus} mode={markerMode} />
              </Marker>
            ))}
          </MapView>
          {!mapFullscreen ? (
            <View style={styles.liveMapBadge}>
              <View style={[styles.presenceDot, styles[`${presence.quality}Dot`]]} />
              <Text style={[styles.liveMapText, presence.online ? styles.partnerOnlineText : styles.partnerOfflineText]}>
                {presence.online ? 'PARTNER ONLINE' : `PARTNER ${presence.label.toUpperCase()}`}
              </Text>
            </View>
          ) : null}
          {routeHealth === 'throttled' ? <View style={styles.routeWarning}><Text style={styles.routeWarningText}>ROUTE THROTTLED · MAY BE OUTDATED</Text></View> : null}
          {routeHealth === 'unavailable' ? <View style={styles.routeWarning}><Text style={styles.routeWarningText}>ROUTE UPDATE DELAYED</Text></View> : null}
          {!autoFrame ? <Pressable accessibilityRole="button" accessibilityLabel="Resume following both units" onPress={resumeAutoFrame} style={styles.followButton}><Text style={styles.followText}>FOLLOW</Text></Pressable> : null}
          {mapFullscreen ? (
            <View pointerEvents="none" style={styles.fullscreenAddressBadge}>
              <View style={styles.fullscreenAddressHeader}>
                <Text style={styles.fullscreenAddressLabel}>PARTNER LOCATION</Text>
                <Text style={[styles.fullscreenPresenceText, presence.online ? styles.partnerOnlineText : styles.partnerOfflineText]}>{presence.label.toUpperCase()}</Text>
              </View>
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={styles.fullscreenAddressText}>
                {locationDetails.loading ? 'LOCATING ADDRESS…' : selectedAddress || 'HOUSE NUMBER UNAVAILABLE'}
              </Text>
            </View>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel={mapFullscreen ? 'Exit full-screen map' : 'Open full-screen map'} onPress={() => setMapFullscreen((current) => !current)} style={styles.fullscreenButton}><Text style={styles.fullscreenButtonText}>{mapFullscreen ? '×' : '⛶'}</Text></Pressable>
    </View>
  );
  if (mapFullscreen) return <View style={styles.container}>{mapPanel(styles.fullscreenMapFrame)}</View>;

  return (
    <View style={styles.container}>
      {!isLandscape ? <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹ PARTNERS</Text></Pressable> : null}
      {isLandscape ? (
        <View style={styles.landscapeContent}>
          <Pressable accessibilityLabel="Back to partners" accessibilityRole="button" onPress={onBack} style={styles.landscapeBackButton}><Text style={styles.landscapeBackText}>‹</Text></Pressable>
          <View style={styles.landscapeInfo}>{identityAndLocation}</View>
          <View style={styles.landscapeMap}>{mapPanel(styles.mapFrameFill)}</View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>{identityAndLocation}{mapPanel({ height: Math.max(310, Math.min(410, height * 0.48)) })}</ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backButton: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 18 },
  backText: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 18, paddingTop: 4, paddingBottom: 24 },
  landscapeContent: { flex: 1, flexDirection: 'row', paddingLeft: 22, gap: 16, position: 'relative' },
  landscapeInfo: { width: '34%', justifyContent: 'center', alignItems: 'center' },
  landscapeMap: { flex: 1, position: 'relative' },
  landscapeBackButton: { position: 'absolute', zIndex: 20, top: 8, left: 8, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: 'rgba(23,33,43,0.92)' },
  landscapeBackText: { color: colors.accent, fontSize: 31, lineHeight: 32, fontWeight: '800' },
  unitHeader: { alignItems: 'center', justifyContent: 'center' },
  unit: { color: colors.accent, fontSize: 21, fontWeight: '900', letterSpacing: 0.8 },
  unitCallSigns: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 2 },
  sectionDivider: { width: '68%', height: 1, backgroundColor: colors.border, marginTop: 11 },
  dutyBanner: { width: '100%', textAlign: 'center', borderWidth: 2, borderRadius: 9, paddingVertical: 9, marginTop: 12, fontWeight: '900', letterSpacing: 1.2 },
  stopBanner: { color: colors.background, borderColor: colors.accent, backgroundColor: colors.accent },
  coverBanner: { color: colors.background, borderColor: colors.danger, backgroundColor: colors.danger },
  pursuitBanner: { color: colors.text, borderColor: '#3478F6', backgroundColor: '#B91C2C' },
  locationSummary: { alignItems: 'center', width: '100%', marginTop: 12 },
  locationSummaryLandscape: { marginTop: 9 },
  locationLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 9 },
  partnerStreet: { color: colors.text, fontSize: 28, lineHeight: 33, fontWeight: '900' },
  partnerStreetLandscape: { fontSize: 23, lineHeight: 27 },
  partnerBlock: { color: colors.success, fontSize: 20, fontWeight: '900', letterSpacing: 0.8, marginTop: 5 },
  locality: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginTop: 6 },
  locationDivider: { width: '42%', height: 1, backgroundColor: colors.border, marginTop: 15 },
  crossStreetGroup: { alignItems: 'center', marginTop: 13 },
  crossStreetLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  crossStreetName: { color: colors.accent, fontSize: 17, fontWeight: '900', letterSpacing: 0.5, marginTop: 3 },
  crossStreetDistance: { color: colors.muted, fontSize: 12 },
  crossStreetUnavailable: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.7, marginTop: 15 },
  travelDirection: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginTop: 16 },
  travelDirectionMoving: { color: colors.success },
  presenceDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  goodDot: { backgroundColor: colors.success },
  weakDot: { backgroundColor: colors.warning },
  offlineDot: { backgroundColor: colors.danger },
  mapFrame: { width: '100%', borderRadius: 12, overflow: 'hidden', marginTop: 11, borderWidth: 1, borderColor: colors.border },
  mapFrameLandscape: { maxWidth: 760 },
  mapFrameFill: { flex: 1, height: '100%', marginTop: 0, borderRadius: 0, borderTopWidth: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  map: { flex: 1 },
  markerStack: { alignItems: 'center' },
  mapDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#FFFFFF' },
  compactMarker: { minWidth: 36, minHeight: 23, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  compactMarkerText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', textAlign: 'center', includeFontPadding: false },
  compactMarkerPointer: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },
  partnerMarker: { minWidth: 43, minHeight: 39, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 3 },
  selectedMarkerText: { color: colors.background },
  selectedMarkerDivider: { backgroundColor: 'rgba(11,17,24,0.55)' },
  markerLine: { width: '100%', alignItems: 'center' }, markerDivider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.7)', marginVertical: 2 },
  markerCallSign: { minWidth: 29, color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontWeight: '900', textAlign: 'center', includeFontPadding: false },
  markerPointer: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2 },
  partnerCarStack: { alignItems: 'center', width: 55 },
  partnerCarStackCompact: { width: 31 },
  partnerCarStackDot: { width: 37 },
  partnerCallSignText: { position: 'absolute', zIndex: 5, top: -14, maxWidth: 55, color: colors.accent, fontSize: 12, lineHeight: 14, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(11,17,24,0.95)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  partnerCallSignTextCompact: { top: -9, fontSize: 7, lineHeight: 8 },
  partnerCallSignTextDot: { top: -10, fontSize: 8, lineHeight: 9 },
  partnerCarImageWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  partnerCarImage: { width: 34, height: 51, zIndex: 2 },
  partnerCarImageCompact: { width: 18, height: 27 },
  partnerCarImageDot: { width: 23, height: 35 },
  partnerLightBar: { position: 'absolute', top: 25, width: 11, height: 3, flexDirection: 'row', overflow: 'hidden', borderRadius: 1, backgroundColor: '#111820', zIndex: 3 },
  partnerLightBarCompact: { top: 13, width: 6, height: 2 },
  partnerLightBarDot: { top: 17, width: 8, height: 2 },
  partnerUnderGlow: { position: 'absolute', width: 29, height: 53, borderRadius: 15, opacity: 0.82, shadowOpacity: 1, shadowRadius: 11, shadowOffset: { width: 0, height: 0 }, zIndex: 0 },
  partnerUnderGlowCompact: { width: 16, height: 29, borderRadius: 8, shadowRadius: 7 },
  partnerUnderGlowDot: { width: 21, height: 37, borderRadius: 11, shadowRadius: 8 },
  partnerUnderGlowMask: { position: 'absolute', width: 19, height: 46, borderRadius: 10, backgroundColor: 'rgba(11,17,24,0.96)', zIndex: 1 },
  partnerUnderGlowMaskCompact: { width: 10, height: 24, borderRadius: 5 },
  partnerUnderGlowMaskDot: { width: 13, height: 31, borderRadius: 7 },
  partnerPursuitOrbit: { position: 'absolute', width: 47, height: 61, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', zIndex: 4 },
  partnerPursuitOrbitCompact: { width: 27, height: 35, borderRadius: 14 },
  partnerPursuitOrbitDot: { width: 33, height: 43, borderRadius: 17 },
  partnerOrbitLight: { position: 'absolute', left: '42%', width: 7, height: 7, borderRadius: 4, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  partnerOrbitTop: { top: -4 },
  partnerOrbitBottom: { bottom: -4 },
  partnerOrbitRed: { backgroundColor: '#EF233C', shadowColor: '#EF233C' },
  partnerOrbitBlue: { backgroundColor: '#3478F6', shadowColor: '#3478F6' },
  partnerBlueLight: { flex: 1, backgroundColor: '#3478F6' },
  partnerRedLight: { flex: 1, backgroundColor: '#EF233C' },
  currentUnitMarker: { alignItems: 'center', justifyContent: 'center' },
  currentUnitCallSign: { position: 'absolute', zIndex: 4, top: -13, color: '#FFFFFF', fontSize: 11, lineHeight: 12, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(11,17,24,0.95)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  currentUnitCallSignCompact: { top: -9, fontSize: 8, lineHeight: 9 },
  currentUnitSideCallSign: { position: 'absolute', zIndex: 4, top: 21, color: '#FFFFFF', fontSize: 11, lineHeight: 12, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(11,17,24,0.95)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  currentUnitLeftCallSign: { right: 28 },
  currentUnitRightCallSign: { left: 28 },
  currentUnitSideCallSignCompact: { top: 10, fontSize: 8, lineHeight: 9 },
  currentUnitLeftCallSignCompact: { right: 16 },
  currentUnitRightCallSignCompact: { left: 16 },
  currentUnitCar: { width: 36, height: 54 },
  currentUnitCarCompact: { width: 19, height: 29 },
  currentUnitCarDot: { width: 22, height: 33 },
  currentLightBar: { position: 'absolute', top: 26, width: 12, height: 3, flexDirection: 'row', overflow: 'hidden', borderRadius: 1, backgroundColor: '#111820' },
  currentLightBarCompact: { top: 14, width: 6, height: 2 },
  currentLightBarDot: { top: 17, width: 7, height: 2 },
  liveMapBadge: { position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  liveMapText: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  partnerOnlineText: { color: colors.success },
  partnerOfflineText: { color: colors.danger },
  routeWarning: { position: 'absolute', left: 8, top: 43, maxWidth: '70%', borderRadius: 5, borderWidth: 1, borderColor: colors.warning, backgroundColor: 'rgba(11,17,24,0.94)', paddingHorizontal: 8, paddingVertical: 5 },
  routeWarningText: { color: colors.warning, fontSize: 8, fontWeight: '900', letterSpacing: 0.55 },
  followButton: { position: 'absolute', right: 8, top: 8, backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 11, paddingVertical: 7 },
  followText: { color: colors.background, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  fullscreenAddressBadge: { position: 'absolute', left: 10, bottom: 10, maxWidth: '72%', borderRadius: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(11,17,24,0.94)', paddingHorizontal: 10, paddingVertical: 7 },
  fullscreenAddressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  fullscreenAddressLabel: { color: colors.muted, fontSize: 7, lineHeight: 9, fontWeight: '900', letterSpacing: 0.75 },
  fullscreenPresenceText: { fontSize: 7, lineHeight: 9, fontWeight: '900', letterSpacing: 0.5 },
  fullscreenAddressText: { color: colors.accent, fontSize: 12, lineHeight: 15, fontWeight: '900', letterSpacing: 0.25, marginTop: 2 },
  houseNumberBadge: { borderRadius: 3, borderWidth: 1, borderColor: 'rgba(255,213,74,0.75)', backgroundColor: 'rgba(11,17,24,0.94)', paddingHorizontal: 4, paddingVertical: 2 },
  houseNumberText: { color: colors.accent, fontSize: 9, lineHeight: 11, fontWeight: '900', textShadowColor: '#000000', textShadowRadius: 2 },
  fullscreenMapFrame: { flex: 1, height: '100%', marginTop: 0, borderRadius: 0, borderWidth: 0 },
  fullscreenButton: { position: 'absolute', right: 9, bottom: 9, width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(11,17,24,0.92)' },
  fullscreenButtonText: { color: colors.accent, fontSize: 25, lineHeight: 27, fontWeight: '900' },
});
