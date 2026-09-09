import { useEffect, useRef } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useMapPreference } from '../hooks/useMapPreference';
import { usePartnerLocationDetails } from '../hooks/usePartnerLocationDetails';
import { availableMapChoices, openNavigationTo } from '../services/navigationService';
import { colors } from '../theme/colors';
import { getPartnerPresence } from '../utils/presence';
import { deriveHundredBlock, formatStreet } from '../utils/address';
import { formatDirection } from '../utils/direction';
import { lastName } from '../utils/name';

const partnerCrew = (item) => (item.occupants?.length ? item.occupants : [item.name]);
const crewCallSigns = (item) => partnerCrew(item).map((name, index) => item.occupantCallSigns?.[index] || (index === 0 ? item.callSign : null) || '—');

export default function PartnerDetailScreen({ partner, partners, duty, userLocation, onBack }) {
  const mapRef = useRef(null);
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
  const currentUnitCallSigns = [duty?.callSign, duty?.secondOfficerCallSign].filter(Boolean).join('/');
  const mapPartners = userLocation?.coords
    ? (partners || []).filter((item) => item.unit !== currentUnit)
    : (partners || []);
  const unitCallSigns = crewCallSigns(partner).join(' | ');

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
        {partner.dutyStatus === 'cover_requested' ? <Text style={[styles.dutyBanner, styles.coverBanner]}>COVER REQUESTED</Text> : null}
        {partner.dutyStatus === 'traffic_stop' ? <Text style={[styles.dutyBanner, styles.stopBanner]}>TRAFFIC STOP</Text> : null}
        <View style={styles.locationSummary}>
          <Text style={styles.locationLabel}>CURRENT LOCATION</Text>
          {block ? <View style={styles.blockBadge}><Text style={styles.partnerBlock}>{block}</Text></View> : null}
          <Text style={styles.partnerStreet} numberOfLines={1}>
            {locationDetails.loading ? 'LOCATING STREET…' : formatStreet(locationDetails.address)}
          </Text>
          {locationDetails.crossStreet?.name ? (
            <Text style={styles.crossStreet} numberOfLines={1}>
              NEAREST CROSS · <Text style={styles.crossStreetName}>{locationDetails.crossStreet.name.toUpperCase()}</Text> · {Math.round(locationDetails.crossStreet.distanceMeters * 3.28084)} FT
            </Text>
          ) : <Text style={styles.crossStreet}>NEAREST CROSS STREET · NOT AVAILABLE</Text>}
          <Text style={styles.travelDirection}>{travelDirection.label}</Text>
        </View>
        <View style={[styles.mapFrame, isLandscape && styles.mapFrameLandscape]}>
          <MapView
            ref={mapRef}
            style={styles.map}
            onMapReady={frameBothLocations}
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
                anchor={{ x: 0.5, y: 1 }}
              >
                <View style={styles.markerStack}>
                  <View style={[styles.partnerMarker, styles.currentUnitMarker, { backgroundColor: duty?.avatarColor || '#2563EB' }]}><Text style={styles.markerCallSign}>{currentUnitCallSigns || '—'}</Text></View>
                  <View style={[styles.markerPointer, { borderTopColor: duty?.avatarColor || '#1677FF' }]} />
                </View>
              </Marker>
            ) : null}
            {mapPartners.map((mapPartner) => (
              <Marker key={mapPartner.id} coordinate={mapPartner.location} title={`${mapPartner.unit} ${lastName(mapPartner.name)}`} description={mapPartner.id === partner.id ? 'Selected partner' : 'Squad partner'} anchor={{ x: 0.5, y: 1 }} zIndex={mapPartner.id === partner.id ? 10 : 1}>
                <View style={styles.markerStack}>
                  <View style={[styles.partnerMarker, { backgroundColor: mapPartner.avatarColor || '#2563EB' }, mapPartner.id === partner.id && styles.selectedMarker]}>
                    {crewCallSigns(mapPartner).map((callSign, index) => <View key={`marker-${callSign}`} style={styles.markerLine}>{index ? <View style={[styles.markerDivider, mapPartner.id === partner.id && styles.selectedMarkerDivider]} /> : null}<Text style={[styles.markerCallSign, mapPartner.id === partner.id && styles.selectedMarkerText]}>{callSign}</Text></View>)}
                  </View>
                  <View style={[styles.markerPointer, { borderTopColor: mapPartner.id === partner.id ? colors.accent : mapPartner.avatarColor || colors.accent }]} />
                </View>
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
  unit: { color: colors.accent, fontSize: 25, fontWeight: '900', letterSpacing: 0.8 },
  unitCallSigns: { color: colors.muted, fontSize: 12, fontWeight: '900', letterSpacing: 1.1, marginTop: 3 },
  dutyBanner: { width: '100%', textAlign: 'center', borderWidth: 2, borderRadius: 9, paddingVertical: 9, marginTop: 12, fontWeight: '900', letterSpacing: 1.2 },
  stopBanner: { color: colors.background, borderColor: colors.accent, backgroundColor: colors.accent },
  coverBanner: { color: colors.background, borderColor: colors.danger, backgroundColor: colors.danger },
  locationSummary: { alignItems: 'center', width: '100%', marginTop: 24 },
  locationLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 12 },
  blockBadge: { backgroundColor: colors.accent, borderColor: colors.accent, borderWidth: 1, borderRadius: 9, paddingHorizontal: 15, paddingVertical: 7, marginBottom: 12 },
  partnerBlock: { color: colors.background, fontSize: 18, fontWeight: '900', letterSpacing: 0.7 },
  partnerStreet: { color: colors.text, fontSize: 19, fontWeight: '900' },
  crossStreet: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.7, marginTop: 10 },
  crossStreetName: { color: colors.accent },
  travelDirection: { color: colors.text, fontSize: 15, fontWeight: '900', letterSpacing: 1, marginTop: 14 },
  presenceDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  goodDot: { backgroundColor: colors.success },
  weakDot: { backgroundColor: colors.warning },
  offlineDot: { backgroundColor: colors.muted },
  mapFrame: { width: '100%', height: 370, borderRadius: 12, overflow: 'hidden', marginTop: 14, borderWidth: 1, borderColor: colors.border },
  mapFrameLandscape: { height: 430, maxWidth: 760 },
  map: { flex: 1 },
  markerStack: { alignItems: 'center' },
  partnerMarker: { minWidth: 50, minHeight: 46, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(255,255,255,0.75)', alignItems: 'stretch', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 4 },
  selectedMarker: { backgroundColor: colors.accent, borderColor: '#FFFFFF', borderWidth: 4 },
  selectedMarkerText: { color: colors.background },
  selectedMarkerDivider: { backgroundColor: 'rgba(11,17,24,0.55)' },
  markerLine: { alignItems: 'center' }, markerDivider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.7)', marginVertical: 2 },
  markerCallSign: { color: '#FFFFFF', fontSize: 11, lineHeight: 13, fontWeight: '900' },
  currentUnitMarker: { borderWidth: 4 },
  markerPointer: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2 },
  liveMapBadge: { position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  liveMapText: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  navigateButton: { width: '100%', minHeight: 58, backgroundColor: colors.accent, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  pressed: { opacity: 0.8 },
  navigateText: { color: colors.background, fontSize: 17, fontWeight: '900', letterSpacing: 0.8 },
});
