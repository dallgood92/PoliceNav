import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useMapPreference } from '../hooks/useMapPreference';
import { usePartnerLocationDetails } from '../hooks/usePartnerLocationDetails';
import { availableMapChoices, openNavigationTo } from '../services/navigationService';
import { fetchDrivingRoute } from '../services/routeService';
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

function PartnerCarMarker({ callSigns, dutyStatus, mode }) {
  const pursuitPulse = useRef(new Animated.Value(0)).current;
  const isPursuit = dutyStatus === 'pursuit';
  const lightsActive = ['traffic_stop', 'cover_requested', 'pursuit'].includes(dutyStatus);
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
  const staticColor = dutyStatus === 'traffic_stop' ? colors.accent : dutyStatus === 'cover_requested' ? colors.danger : '#FFFFFF';
  const pursuitLeft = pursuitPulse.interpolate({ inputRange: [0, 1], outputRange: ['#EF233C', '#3478F6'] });
  const pursuitRight = pursuitPulse.interpolate({ inputRange: [0, 1], outputRange: ['#3478F6', '#EF233C'] });
  const callSignColor = isPursuit ? pursuitLeft : staticColor;
  const label = callSigns.length > 1 ? `${callSigns[0]} +${callSigns.length - 1}` : callSigns[0];
  return (
    <View style={[styles.partnerCarStack, mode === 'dot' && styles.partnerCarStackDot]}>
      <Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.55} style={[styles.partnerCallSignText, mode === 'dot' && styles.partnerCallSignTextDot, { color: callSignColor }]}>{label}</Animated.Text>
      <View style={styles.partnerCarImageWrap}>
        <Image source={require('../../assets/partner-unit-car.png')} resizeMode="contain" fadeDuration={0} tintColor={null} style={[styles.partnerCarImage, mode === 'dot' && styles.partnerCarImageDot]} />
        <View style={[styles.partnerLightBar, mode === 'dot' && styles.partnerLightBarDot]}>{lightsActive ? <><Animated.View style={[styles.partnerBlueLight, { backgroundColor: pursuitLeft }]} /><Animated.View style={[styles.partnerRedLight, { backgroundColor: pursuitRight }]} /></> : null}</View>
      </View>
    </View>
  );
}

function CurrentUnitMarker({ dutyStatus, heading, mode }) {
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
  const leftLight = lightPulse.interpolate({ inputRange: [0, 1], outputRange: ['#3478F6', '#EF233C'] });
  const rightLight = lightPulse.interpolate({ inputRange: [0, 1], outputRange: ['#EF233C', '#3478F6'] });
  return (
    <View style={[styles.currentUnitMarker, { transform: [{ rotate: rotation }] }]}>
      <Image source={require('../../assets/current-unit-car.png')} resizeMode="contain" fadeDuration={0} tintColor={null} style={[styles.currentUnitCar, mode === 'dot' && styles.currentUnitCarDot]} />
      <View style={[styles.currentLightBar, mode === 'dot' && styles.currentLightBarDot]}>{lightsActive ? <><Animated.View style={[styles.partnerBlueLight, { backgroundColor: leftLight }]} /><Animated.View style={[styles.partnerRedLight, { backgroundColor: rightLight }]} /></> : null}</View>
    </View>
  );
}

export default function PartnerDetailScreen({ partner, partners, duty, userLocation, onBack }) {
  const mapRef = useRef(null);
  const lastRouteRequestRef = useRef({ origin: null, destination: null });
  const routeAbortRef = useRef(null);
  const followResumeTimerRef = useRef(null);
  const cameraTiltTimerRef = useRef(null);
  const [markerMode, setMarkerMode] = useState('detail');
  const [autoFrame, setAutoFrame] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeHealth, setRouteHealth] = useState('loading');
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const presence = getPartnerPresence(partner);
  const { preference } = useMapPreference();
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
  const mapPartners = userLocation?.coords
    ? (partners || []).filter((item) => item.unit !== currentUnit)
    : (partners || []);
  const unitCallSigns = crewCallSigns(partner).join(' | ');

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
      setRouteCoordinates(coordinates);
      setRouteHealth(coordinates.length > 1 ? 'current' : 'unavailable');
    }).catch((error) => {
      if (error?.name !== 'AbortError') setRouteHealth(error?.status === 429 ? 'throttled' : 'unavailable');
    });
    return undefined;
  }, [partner.location.latitude, partner.location.longitude, userLocation?.coords.latitude, userLocation?.coords.longitude]);
  useEffect(() => () => routeAbortRef.current?.abort(), []);
  useEffect(() => () => clearTimeout(followResumeTimerRef.current), []);
  useEffect(() => () => clearTimeout(cameraTiltTimerRef.current), []);

  const updateMarkerMode = (region) => {
    const nextMode = region.latitudeDelta > 0.5 ? 'dot' : region.latitudeDelta > 0.08 ? 'compact' : 'detail';
    setMarkerMode((current) => current === nextMode ? current : nextMode);
  };

  const launchNavigation = async (provider = preference) => {
    try {
      await openNavigationTo(partner, provider);
    } catch {
      Alert.alert(
        'Refresh alerts unavailable',
        'Directions can still open, but PoliceNav could not arm movement notifications. Check notification permission and the live server.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open without alerts',
            onPress: () => openNavigationTo(partner, provider, { armAlert: false })
              .catch(() => Alert.alert('Directions unavailable', 'We could not open the selected map.')),
          },
        ],
      );
    }
  };

  const chooseMapAndLaunch = () => {
    const choices = availableMapChoices();
    Alert.alert(
      'Open directions with',
      `Route to ${partner.name}'s latest reported location.`,
      [
        ...choices.map((provider) => ({
          text: provider === 'apple' ? 'Apple Maps' : 'Google Maps',
          onPress: () => launchNavigation(provider),
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const confirmAndNavigate = () => {
    const proceed = () => preference === 'ask' ? chooseMapAndLaunch() : launchNavigation();
    if (!presence.online) {
      Alert.alert(
        'Location may be outdated',
        `${partner.name} is ${presence.label.toLowerCase()}. Directions use their last reported position.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: proceed },
        ],
      );
      return;
    }
    proceed();
  };

  const frameBothLocations = (force = false) => {
    if (!mapRef.current || (!autoFrame && !force)) return;
    const userCoords = userLocation?.coords;
    const selectedPartnerCoords = partner.location;
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
    const nearby = distanceInMeters(userCoords, selectedPartnerCoords) < 805;
    const edgePadding = nearby
      ? { top: 58, right: 52, bottom: 58, left: 52 }
      : { top: 105, right: 90, bottom: 105, left: 90 };
    mapRef.current.fitToCoordinates(coordinates, { edgePadding, animated: true });
    const drivingHeading = Number.isFinite(userCoords.heading) && userCoords.heading >= 0
      ? userCoords.heading
      : bearingBetween(userCoords, selectedPartnerCoords);
    clearTimeout(cameraTiltTimerRef.current);
    cameraTiltTimerRef.current = setTimeout(async () => {
      try {
        if (!mapRef.current) return;
        const camera = await mapRef.current.getCamera();
        mapRef.current?.animateCamera({ ...camera, heading: drivingHeading, pitch: 52 }, { duration: 350 });
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
    width,
    height,
    autoFrame,
  ]);

  const statusBanner = partner.dutyStatus === 'cover_requested'
    ? <Text style={[styles.dutyBanner, styles.coverBanner]}>COVER REQUESTED</Text>
    : partner.dutyStatus === 'traffic_stop'
      ? <Text style={[styles.dutyBanner, styles.stopBanner]}>TRAFFIC STOP</Text>
      : partner.dutyStatus === 'pursuit' ? <Text style={[styles.dutyBanner, styles.pursuitBanner]}>PURSUIT</Text> : null;
  const identityAndLocation = (
    <>
      <View style={styles.unitHeader}><Text style={styles.unit}>{unitCallSigns}</Text><Text style={styles.unitCallSigns}>{partner.unit.toUpperCase()}</Text></View>
      <View style={styles.sectionDivider} />
      {statusBanner}
      <View style={[styles.locationSummary, isLandscape && styles.locationSummaryLandscape]}>
        <Text style={styles.locationLabel}>CURRENT LOCATION</Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.6} style={[styles.partnerStreet, isLandscape && styles.partnerStreetLandscape]} numberOfLines={1}>{locationDetails.loading ? 'LOCATING STREET…' : formatStreet(locationDetails.address)}</Text>
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
            ref={mapRef}
            style={styles.map}
            userInterfaceStyle="dark"
            customMapStyle={DARK_MAP_STYLE}
            pitchEnabled
            rotateEnabled
            scrollEnabled
            zoomEnabled
            onMapReady={frameBothLocations}
            onRegionChangeComplete={updateMarkerMode}
            onTouchStart={pauseAutoFrame}
            initialRegion={{
              latitude: partner.location.latitude,
              longitude: partner.location.longitude,
              latitudeDelta: 0.025,
              longitudeDelta: 0.025,
            }}
          >
            {routeCoordinates.length > 1 ? <Polyline coordinates={routeCoordinates} strokeColor={colors.accent} strokeWidth={6} lineCap="round" lineJoin="round" zIndex={2} /> : null}
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
                <CurrentUnitMarker dutyStatus={duty?.status} heading={autoFrame ? 0 : userLocation.coords.heading} mode={markerMode} />
              </Marker>
            ) : null}
            {mapPartners.map((mapPartner) => (
              <Marker key={mapPartner.id} coordinate={mapPartner.location} title={`${mapPartner.unit} ${lastName(mapPartner.name)}`} description={mapPartner.id === partner.id ? 'Selected partner' : 'Squad partner'} anchor={{ x: 0.5, y: markerMode === 'dot' ? 0.5 : 1 }} zIndex={mapPartner.id === partner.id ? 10 : 1}>
                <PartnerCarMarker callSigns={crewCallSigns(mapPartner)} dutyStatus={mapPartner.dutyStatus} mode={markerMode} />
              </Marker>
            ))}
          </MapView>
          <View style={styles.liveMapBadge}>
            <View style={[styles.presenceDot, styles[`${presence.quality}Dot`]]} />
            <Text style={styles.liveMapText}>LIVE PARTNER MAP</Text>
          </View>
          {routeHealth === 'throttled' ? <View style={styles.routeWarning}><Text style={styles.routeWarningText}>ROUTE THROTTLED · MAY BE OUTDATED</Text></View> : null}
          {routeHealth === 'unavailable' ? <View style={styles.routeWarning}><Text style={styles.routeWarningText}>ROUTE UPDATE DELAYED</Text></View> : null}
          {!presence.online ? <View style={[styles.routeWarning, styles.partnerLocationWarning]}><Text style={styles.routeWarningText}>PARTNER LOCATION {presence.label.toUpperCase()}</Text></View> : null}
          {!autoFrame ? <Pressable accessibilityRole="button" accessibilityLabel="Resume following both units" onPress={resumeAutoFrame} style={styles.followButton}><Text style={styles.followText}>FOLLOW</Text></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel={mapFullscreen ? 'Exit full-screen map' : 'Open full-screen map'} onPress={() => setMapFullscreen((current) => !current)} style={styles.fullscreenButton}><Text style={styles.fullscreenButtonText}>{mapFullscreen ? '×' : '⛶'}</Text></Pressable>
    </View>
  );
  const directionsButton = <Pressable accessibilityRole="button" onPress={confirmAndNavigate} style={({ pressed }) => [styles.navigateButton, pressed && styles.pressed]}><Text style={styles.navigateText}>OPEN DIRECTIONS</Text></Pressable>;

  if (mapFullscreen) return <View style={styles.container}>{mapPanel(styles.fullscreenMapFrame)}</View>;

  return (
    <View style={styles.container}>
      {!isLandscape ? <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹ PARTNERS</Text></Pressable> : null}
      {isLandscape ? (
        <View style={styles.landscapeContent}>
          <Pressable accessibilityLabel="Back to partners" accessibilityRole="button" onPress={onBack} style={styles.landscapeBackButton}><Text style={styles.landscapeBackText}>‹</Text></Pressable>
          <View style={styles.landscapeInfo}>{identityAndLocation}{directionsButton}</View>
          <View style={styles.landscapeMap}>{mapPanel(styles.mapFrameFill)}</View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>{identityAndLocation}{mapPanel({ height: Math.max(230, Math.min(315, height * 0.36)) })}{directionsButton}</ScrollView>
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
  offlineDot: { backgroundColor: colors.muted },
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
  partnerCarStackDot: { width: 37 },
  partnerCallSignText: { maxWidth: 55, color: '#64748B', fontSize: 12, lineHeight: 14, fontWeight: '900', textAlign: 'center', marginBottom: 1, textShadowColor: 'rgba(11,17,24,0.95)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  partnerCallSignTextDot: { fontSize: 8, lineHeight: 9 },
  partnerCarImageWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  partnerCarImage: { width: 34, height: 51 },
  partnerCarImageDot: { width: 23, height: 35 },
  partnerLightBar: { position: 'absolute', top: 25, width: 16, height: 4, flexDirection: 'row', overflow: 'hidden', borderRadius: 1, backgroundColor: '#111820' },
  partnerLightBarDot: { top: 17, width: 11, height: 3 },
  partnerBlueLight: { flex: 1, backgroundColor: '#3478F6' },
  partnerRedLight: { flex: 1, backgroundColor: '#EF233C' },
  currentUnitMarker: { alignItems: 'center', justifyContent: 'center' },
  currentUnitCar: { width: 36, height: 54 },
  currentUnitCarDot: { width: 22, height: 33 },
  currentLightBar: { position: 'absolute', top: 27, width: 17, height: 4, flexDirection: 'row', overflow: 'hidden', borderRadius: 1, backgroundColor: '#111820' },
  currentLightBarDot: { top: 16, width: 10, height: 3 },
  liveMapBadge: { position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  liveMapText: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  routeWarning: { position: 'absolute', left: 8, top: 43, maxWidth: '70%', borderRadius: 5, borderWidth: 1, borderColor: colors.warning, backgroundColor: 'rgba(11,17,24,0.94)', paddingHorizontal: 8, paddingVertical: 5 },
  partnerLocationWarning: { top: 8, left: '22%', right: '22%', maxWidth: '56%', alignItems: 'center', borderColor: colors.danger },
  routeWarningText: { color: colors.warning, fontSize: 8, fontWeight: '900', letterSpacing: 0.55 },
  followButton: { position: 'absolute', right: 8, top: 8, backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 11, paddingVertical: 7 },
  followText: { color: colors.background, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  fullscreenMapFrame: { flex: 1, height: '100%', marginTop: 0, borderRadius: 0, borderWidth: 0 },
  fullscreenButton: { position: 'absolute', right: 9, bottom: 9, width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(11,17,24,0.92)' },
  fullscreenButtonText: { color: colors.accent, fontSize: 25, lineHeight: 27, fontWeight: '900' },
  navigateButton: { width: '100%', minHeight: 54, backgroundColor: colors.accent, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 11 },
  pressed: { opacity: 0.8 },
  navigateText: { color: colors.background, fontSize: 17, fontWeight: '900', letterSpacing: 0.8 },
});
