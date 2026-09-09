import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useMapPreference } from '../hooks/useMapPreference';
import { usePartnerLocationDetails } from '../hooks/usePartnerLocationDetails';
import { availableMapChoices, openNavigationTo } from '../services/navigationService';
import { colors } from '../theme/colors';
import { getPartnerPresence } from '../utils/presence';
import { deriveHundredBlock, formatLocality, formatStreet } from '../utils/address';
import { formatDirection } from '../utils/direction';
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

function UnitMapMarker({ callSigns, color, dutyStatus, selected, mode }) {
  const pursuitPulse = useRef(new Animated.Value(0)).current;
  const isPursuit = dutyStatus === 'pursuit';
  useEffect(() => {
    if (!isPursuit) { pursuitPulse.stopAnimation(); pursuitPulse.setValue(0); return undefined; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pursuitPulse, { toValue: 1, duration: 900, useNativeDriver: false }),
      Animated.timing(pursuitPulse, { toValue: 0, duration: 900, useNativeDriver: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [isPursuit, pursuitPulse]);
  const staticColor = dutyStatus === 'traffic_stop' ? colors.accent : dutyStatus === 'cover_requested' ? colors.danger : color;
  const markerColor = isPursuit ? pursuitPulse.interpolate({ inputRange: [0, 1], outputRange: ['#B91C2C', '#174EA6'] }) : staticColor;
  const darkText = dutyStatus === 'traffic_stop';
  if (mode === 'dot') {
    return <Animated.View style={[styles.mapDot, { backgroundColor: markerColor }, selected && styles.selectedMapDot]} />;
  }

  if (mode === 'compact') {
    const label = callSigns.length > 1 ? `${callSigns[0]} +${callSigns.length - 1}` : callSigns[0];
    return (
      <View style={styles.markerStack}>
        <Animated.View style={[styles.compactMarker, { backgroundColor: markerColor }, selected && styles.selectedCompactMarker]}>
          <Text style={[styles.compactMarkerText, darkText && styles.selectedMarkerText]}>{label}</Text>
        </Animated.View>
        <Animated.View style={[styles.compactMarkerPointer, { borderTopColor: markerColor }]} />
      </View>
    );
  }

  return (
    <View style={styles.markerStack}>
      <Animated.View style={[styles.partnerMarker, { backgroundColor: markerColor }, selected && styles.selectedMarker]}>
        {callSigns.map((callSign, index) => <View key={`marker-${callSign}`} style={styles.markerLine}>{index ? <View style={[styles.markerDivider, darkText && styles.selectedMarkerDivider]} /> : null}<Text style={[styles.markerCallSign, darkText && styles.selectedMarkerText]}>{callSign}</Text></View>)}
      </Animated.View>
      <Animated.View style={[styles.markerPointer, { borderTopColor: markerColor }]} />
    </View>
  );
}

export default function PartnerDetailScreen({ partner, partners, duty, userLocation, onBack }) {
  const mapRef = useRef(null);
  const [markerMode, setMarkerMode] = useState('detail');
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
  const currentUnitCallSignList = [duty?.callSign, duty?.secondOfficerCallSign].filter(Boolean);

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

  const frameBothLocations = () => {
    if (!mapRef.current) return;
    const userCoords = userLocation?.coords;
    const squadCoordinates = mapPartners.map((item) => item.location).filter((location) => Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude));
    const coordinates = [
      ...(userCoords ? [{ latitude: userCoords.latitude, longitude: userCoords.longitude }] : []),
      ...squadCoordinates.map((location) => ({ latitude: location.latitude, longitude: location.longitude })),
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
    mapRef.current.fitToCoordinates(coordinates, { edgePadding: { top: 72, right: 52, bottom: 52, left: 52 }, animated: true });
  };

  useEffect(frameBothLocations, [
    partner.location.latitude,
    partner.location.longitude,
    partners,
    duty?.unitNumber,
    userLocation?.coords.latitude,
    userLocation?.coords.longitude,
    width,
    height,
  ]);

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹ PARTNERS</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.unitHeader}>
          <Text style={styles.unit}>{partner.unit.toUpperCase()}</Text>
          <Text style={styles.unitCallSigns}>{unitCallSigns}</Text>
        </View>
        <View style={styles.sectionDivider} />
        {partner.dutyStatus === 'cover_requested' ? <Text style={[styles.dutyBanner, styles.coverBanner]}>COVER REQUESTED</Text> : null}
        {partner.dutyStatus === 'traffic_stop' ? <Text style={[styles.dutyBanner, styles.stopBanner]}>TRAFFIC STOP</Text> : null}
        {partner.dutyStatus === 'pursuit' ? <Text style={[styles.dutyBanner, styles.pursuitBanner]}>PURSUIT</Text> : null}
        <View style={styles.locationSummary}>
          <Text style={styles.locationLabel}>CURRENT LOCATION</Text>
          <Text style={styles.partnerStreet} numberOfLines={1}>
            {locationDetails.loading ? 'LOCATING STREET…' : formatStreet(locationDetails.address)}
          </Text>
          {block ? <Text style={styles.partnerBlock}>{block}</Text> : null}
          <Text style={styles.locality}>{formatLocality(locationDetails.address).toUpperCase()}</Text>
          <View style={styles.locationDivider} />
          {locationDetails.crossStreet?.name ? (
            <View style={styles.crossStreetGroup}>
              <Text style={styles.crossStreetLabel}>CROSS STREET</Text>
              <Text style={styles.crossStreetName} numberOfLines={1}>
                {locationDetails.crossStreet.name.toUpperCase()} <Text style={styles.crossStreetDistance}>· {Math.round(locationDetails.crossStreet.distanceMeters * 3.28084)} FT</Text>
              </Text>
            </View>
          ) : <Text style={styles.crossStreetUnavailable}>CROSS STREET · NOT AVAILABLE</Text>}
          <Text style={[styles.travelDirection, travelDirection.label !== 'STOPPED' && styles.travelDirectionMoving]}>
            {travelDirection.label} · {locationAge(partner.location?.timestamp)}
          </Text>
        </View>
        <View style={[styles.mapFrame, { height: isLandscape ? Math.max(220, height - 120) : Math.max(230, Math.min(315, height * 0.36)) }, isLandscape && styles.mapFrameLandscape]}>
          <MapView
            ref={mapRef}
            style={styles.map}
            userInterfaceStyle="dark"
            customMapStyle={DARK_MAP_STYLE}
            onMapReady={frameBothLocations}
            onRegionChangeComplete={updateMarkerMode}
            initialRegion={{
              latitude: partner.location.latitude,
              longitude: partner.location.longitude,
              latitudeDelta: 0.025,
              longitudeDelta: 0.025,
            }}
          >
            {userLocation?.coords ? (
              <Marker
                coordinate={{
                  latitude: userLocation.coords.latitude,
                  longitude: userLocation.coords.longitude,
                }}
                title={currentUnit}
                description="Your unit's live GPS location"
                anchor={{ x: 0.5, y: markerMode === 'dot' ? 0.5 : 1 }}
              >
                <UnitMapMarker callSigns={currentUnitCallSignList.length ? currentUnitCallSignList : ['—']} color={duty?.avatarColor || '#059669'} dutyStatus={duty?.status} mode={markerMode} />
              </Marker>
            ) : null}
            {mapPartners.map((mapPartner) => (
              <Marker key={mapPartner.id} coordinate={mapPartner.location} title={`${mapPartner.unit} ${lastName(mapPartner.name)}`} description={mapPartner.id === partner.id ? 'Selected partner' : 'Squad partner'} anchor={{ x: 0.5, y: markerMode === 'dot' ? 0.5 : 1 }} zIndex={mapPartner.id === partner.id ? 10 : 1}>
                <UnitMapMarker callSigns={crewCallSigns(mapPartner)} color={mapPartner.avatarColor || '#059669'} dutyStatus={mapPartner.dutyStatus} selected={mapPartner.id === partner.id} mode={markerMode} />
              </Marker>
            ))}
          </MapView>
          <View style={styles.liveMapBadge}>
            <View style={[styles.presenceDot, styles[`${presence.quality}Dot`]]} />
            <Text style={styles.liveMapText}>LIVE PARTNER MAP</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={confirmAndNavigate}
          style={({ pressed }) => [styles.navigateButton, pressed && styles.pressed]}
        >
          <Text style={styles.navigateText}>OPEN DIRECTIONS</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backButton: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 18 },
  backText: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 18, paddingTop: 4, paddingBottom: 24 },
  unitHeader: { alignItems: 'center', justifyContent: 'center' },
  unit: { color: colors.accent, fontSize: 21, fontWeight: '900', letterSpacing: 0.8 },
  unitCallSigns: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 2 },
  sectionDivider: { width: '68%', height: 1, backgroundColor: colors.border, marginTop: 11 },
  dutyBanner: { width: '100%', textAlign: 'center', borderWidth: 2, borderRadius: 9, paddingVertical: 9, marginTop: 12, fontWeight: '900', letterSpacing: 1.2 },
  stopBanner: { color: colors.background, borderColor: colors.accent, backgroundColor: colors.accent },
  coverBanner: { color: colors.background, borderColor: colors.danger, backgroundColor: colors.danger },
  pursuitBanner: { color: colors.text, borderColor: '#3478F6', backgroundColor: '#B91C2C' },
  locationSummary: { alignItems: 'center', width: '100%', marginTop: 12 },
  locationLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 9 },
  partnerStreet: { color: colors.text, fontSize: 28, lineHeight: 33, fontWeight: '900' },
  partnerBlock: { color: colors.accent, fontSize: 20, fontWeight: '900', letterSpacing: 0.8, marginTop: 5 },
  locality: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginTop: 6 },
  locationDivider: { width: '42%', height: 1, backgroundColor: colors.border, marginTop: 15 },
  crossStreetGroup: { alignItems: 'center', marginTop: 13 },
  crossStreetLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  crossStreetName: { color: colors.accent, fontSize: 17, fontWeight: '900', letterSpacing: 0.5, marginTop: 3 },
  crossStreetDistance: { color: colors.muted, fontSize: 12 },
  crossStreetUnavailable: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.7, marginTop: 15 },
  travelDirection: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.8, marginTop: 16 },
  travelDirectionMoving: { color: colors.accent },
  presenceDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  goodDot: { backgroundColor: colors.success },
  weakDot: { backgroundColor: colors.warning },
  offlineDot: { backgroundColor: colors.muted },
  mapFrame: { width: '100%', borderRadius: 12, overflow: 'hidden', marginTop: 11, borderWidth: 1, borderColor: colors.border },
  mapFrameLandscape: { maxWidth: 760 },
  map: { flex: 1 },
  markerStack: { alignItems: 'center' },
  mapDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#FFFFFF' },
  selectedMapDot: { width: 17, height: 17, borderRadius: 9, borderWidth: 3 },
  compactMarker: { minWidth: 42, minHeight: 26, borderRadius: 7, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  selectedCompactMarker: { borderColor: '#FFFFFF', borderWidth: 3 },
  compactMarkerText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', textAlign: 'center', includeFontPadding: false },
  compactMarkerPointer: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -1 },
  partnerMarker: { minWidth: 50, minHeight: 46, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 4 },
  selectedMarker: { borderColor: '#FFFFFF', borderWidth: 4 },
  selectedMarkerText: { color: colors.background },
  selectedMarkerDivider: { backgroundColor: 'rgba(11,17,24,0.55)' },
  markerLine: { width: '100%', alignItems: 'center' }, markerDivider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.7)', marginVertical: 2 },
  markerCallSign: { minWidth: 34, color: '#FFFFFF', fontSize: 11, lineHeight: 13, fontWeight: '900', textAlign: 'center', includeFontPadding: false },
  markerPointer: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2 },
  liveMapBadge: { position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  liveMapText: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  navigateButton: { width: '100%', minHeight: 54, backgroundColor: colors.accent, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 11 },
  pressed: { opacity: 0.8 },
  navigateText: { color: colors.background, fontSize: 17, fontWeight: '900', letterSpacing: 0.8 },
});
