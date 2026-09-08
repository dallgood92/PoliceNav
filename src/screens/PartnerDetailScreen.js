import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useMapPreference } from '../hooks/useMapPreference';
import { usePartnerLocationDetails } from '../hooks/usePartnerLocationDetails';
import { availableMapChoices, mapLabel, mapOptions, openNavigationTo } from '../services/navigationService';
import { colors } from '../theme/colors';
import { getPartnerPresence } from '../utils/presence';
import { deriveHundredBlock, formatStreet } from '../utils/address';
import { lastName } from '../utils/name';

const KNOWN_CALL_SIGNS = { 'Dylan Allgood': '875', 'Jeremy Rogers': '861', 'Trey Humphries': '874', 'Jared Ramm': '869' };
const partnerCrew = (item) => (item.occupants?.length ? item.occupants : [item.name]);
const crewCallSigns = (item) => partnerCrew(item).map((name) => name === item.name ? item.callSign || '—' : KNOWN_CALL_SIGNS[name] || '—');

export default function PartnerDetailScreen({ partner, partners, duty, userLocation, onUpdatePartner, onBack }) {
  const mapRef = useRef(null);
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const presence = getPartnerPresence(partner);
  const { preference, setPreference } = useMapPreference();
  const locationDetails = usePartnerLocationDetails(partner.location);
  const block = deriveHundredBlock(locationDetails.address);
  const [editingUnit, setEditingUnit] = useState(false);
  const currentUnit = `Unit ${duty?.unitNumber || ''}`;
  const currentUnitCallSigns = [duty?.callSign, duty?.secondOfficerCallSign].filter(Boolean).join('/');
  const mapPartners = userLocation?.coords
    ? (partners || []).filter((item) => item.unit !== currentUnit)
    : (partners || []);
  const availableRiders = [
    { name: 'None — one officer', value: null },
    { name: 'Dylan Allgood', value: 'Dylan Allgood' },
    { name: 'Jeremy Rogers', value: 'Jeremy Rogers' },
    { name: 'Trey Humphries', value: 'Trey Humphries' },
    { name: 'Jared Ramm', value: 'Jared Ramm' },
  ].filter((rider) => rider.value !== partner.name);
  const secondRider = partner.occupants?.find((name) => name !== partner.name) || null;
  const crew = [
    `${lastName(partner.name).toUpperCase()} (${partner.callSign || '—'})`,
    secondRider ? `${lastName(secondRider).toUpperCase()} (${KNOWN_CALL_SIGNS[secondRider] || '—'})` : null,
  ].filter(Boolean).join(' / ');

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
        <View style={[styles.badge, { backgroundColor: partner.avatarColor || '#2563EB' }]}>
          {crewCallSigns(partner).map((callSign, index) => <View key={`detail-${callSign}`} style={styles.badgeLine}>{index ? <View style={styles.badgeDivider} /> : null}<Text style={styles.badgeText}>{callSign}</Text></View>)}
        </View>
        <Text style={styles.name}>{lastName(partner.name)} {partner.callSign ? `(${partner.callSign})` : ''}</Text>
        <View style={styles.unitRow}><Text style={styles.unit}>{partner.unit}</Text><Pressable onPress={() => setEditingUnit((value) => !value)}><Text style={styles.editUnit}>{editingUnit ? 'DONE' : 'EDIT UNIT'}</Text></Pressable></View>
        <Text style={styles.crewLabel}>UNIT CREW</Text>
        <Text style={styles.riders}>{crew}</Text>
        {editingUnit ? (
          <View style={styles.unitEditor}>
            <View style={styles.unitInputs}>
              <View style={styles.unitInputGroup}><Text style={styles.unitInputLabel}>UNIT NUMBER</Text><TextInput value={partner.unit.replace(/^Unit\s*/i, '')} onChangeText={(value) => onUpdatePartner({ ...partner, unit: `Unit ${value}` })} placeholder="47" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.unitInput} /></View>
              <View style={styles.unitInputGroup}><Text style={styles.unitInputLabel}>CALL SIGN</Text><TextInput value={partner.callSign || ''} onChangeText={(callSign) => onUpdatePartner({ ...partner, callSign })} placeholder="861" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.unitInput} /></View>
            </View>
            <Text style={styles.riderLabel}>SECOND OFFICER</Text>
            <View style={styles.riderChoices}>{availableRiders.map((rider) => <Pressable key={rider.name} onPress={() => onUpdatePartner({ ...partner, occupants: [partner.name, rider.value].filter(Boolean) })} style={[styles.riderChoice, secondRider === rider.value && styles.riderChoiceActive]}><Text style={styles.riderChoiceText}>{rider.value ? lastName(rider.name) : rider.name}</Text></Pressable>)}</View>
          </View>
        ) : null}
        {partner.dutyStatus === 'cover_requested' ? <Text style={[styles.dutyBanner, styles.coverBanner]}>COVER REQUESTED</Text> : null}
        {partner.dutyStatus === 'traffic_stop' ? <Text style={[styles.dutyBanner, styles.stopBanner]}>TRAFFIC STOP</Text> : null}
        <View style={styles.locationSummary}>
          {block ? <View style={styles.blockBadge}><Text style={styles.partnerBlock}>{block}</Text></View> : null}
          <Text style={styles.partnerStreet} numberOfLines={1}>
            {locationDetails.loading ? 'LOCATING STREET…' : formatStreet(locationDetails.address)}
          </Text>
          <Text style={styles.crossStreet} numberOfLines={1}>
            {locationDetails.crossStreet?.name
              ? `NEAREST CROSS · ${locationDetails.crossStreet.name.toUpperCase()} · ${Math.round(locationDetails.crossStreet.distanceMeters * 3.28084)} FT`
              : 'NEAREST CROSS STREET · NOT AVAILABLE'}
          </Text>
        </View>
        <View style={styles.statusPill}>
          <View style={[styles.presenceDot, styles[`${presence.quality}Dot`]]} />
          <Text style={[styles.status, styles[`${presence.quality}Text`]]}>{presence.label.toUpperCase()}</Text>
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
                  <View style={[styles.partnerMarker, styles.currentUnitMarker, { backgroundColor: duty?.avatarColor || '#2563EB' }]}><Text style={styles.markerCallSign}>{currentUnitCallSigns || '875'}</Text></View>
                  <View style={[styles.markerPointer, { borderTopColor: duty?.avatarColor || '#1677FF' }]} />
                </View>
              </Marker>
            ) : null}
            {mapPartners.map((mapPartner) => (
              <Marker key={mapPartner.id} coordinate={mapPartner.location} title={`${mapPartner.unit} ${lastName(mapPartner.name)}`} description={mapPartner.id === partner.id ? 'Selected partner' : 'Squad partner'} anchor={{ x: 0.5, y: 1 }} zIndex={mapPartner.id === partner.id ? 10 : 1}>
                <View style={styles.markerStack}>
                  <View style={[styles.partnerMarker, { backgroundColor: mapPartner.avatarColor || '#2563EB' }, mapPartner.id === partner.id && styles.selectedMarker]}>
                    {crewCallSigns(mapPartner).map((callSign, index) => <View key={`marker-${callSign}`} style={styles.markerLine}>{index ? <View style={styles.markerDivider} /> : null}<Text style={styles.markerCallSign}>{callSign}</Text></View>)}
                  </View>
                  <View style={[styles.markerPointer, { borderTopColor: mapPartner.avatarColor || colors.accent }]} />
                </View>
              </Marker>
            ))}
          </MapView>
          <View style={styles.liveMapBadge}>
            <View style={[styles.presenceDot, styles[`${presence.quality}Dot`]]} />
            <Text style={styles.liveMapText}>LIVE PARTNER MAP</Text>
          </View>
        </View>
        <Text style={styles.mapLabel}>PREFERRED MAP</Text>
        <View style={styles.mapOptions}>
          {mapOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: preference === option.value }}
              onPress={() => setPreference(option.value)}
              style={[styles.mapOption, preference === option.value && styles.mapOptionSelected]}
            >
              <Text style={[styles.mapOptionText, preference === option.value && styles.mapOptionTextSelected]}>
                {option.value === 'automatic' ? 'AUTO' : option.value === 'ask' ? 'ASK' : option.value.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.mapChoice}>{mapLabel(preference)}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={confirmAndNavigate}
          style={({ pressed }) => [styles.navigateButton, pressed && styles.pressed]}
        >
          <Text style={styles.navigateText}>OPEN DIRECTIONS</Text>
        </Pressable>
        <Text style={styles.note}>
          {partner.mock
            ? 'Demo coordinates are shown until a live-location server is configured.'
            : 'The marker updates from the live server. External directions use the latest position available when opened.'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backButton: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 18 },
  backText: { color: colors.accent, fontSize: 16, fontWeight: '800' },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 24 },
  badge: { width: 66, minHeight: 68, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', alignItems: 'stretch', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 7 },
  badgeLine: { alignItems: 'center' }, badgeDivider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.7)', marginVertical: 4 },
  badgeText: { color: colors.text, fontSize: 17, lineHeight: 19, fontWeight: '900', letterSpacing: 0.8 },
  name: { color: colors.text, fontSize: 29, fontWeight: '900', marginTop: 8 },
  unit: { color: colors.muted, fontSize: 19, marginTop: 4 },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, editUnit: { color: colors.accent, fontSize: 11, fontWeight: '900', marginTop: 5 },
  crewLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 8 },
  riders: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 3 },
  unitEditor: { width: '100%', backgroundColor: colors.panel, borderRadius: 10, padding: 12, marginTop: 10 }, unitInputs: { flexDirection: 'row', gap: 8 },
  unitInputGroup: { flex: 1 }, unitInputLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', marginBottom: 5, letterSpacing: 0.7 },
  unitInput: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 8, color: colors.text, paddingHorizontal: 12, backgroundColor: colors.background },
  riderLabel: { color: colors.muted, fontSize: 10, fontWeight: '900', marginTop: 12, marginBottom: 4 }, riderChoices: { gap: 5 },
  riderChoice: { padding: 9, backgroundColor: colors.background, borderRadius: 7 }, riderChoiceActive: { borderWidth: 1, borderColor: colors.accent }, riderChoiceText: { color: colors.text, fontWeight: '700' },
  dutyBanner: { width: '100%', textAlign: 'center', borderWidth: 2, borderRadius: 9, paddingVertical: 9, marginTop: 12, fontWeight: '900', letterSpacing: 1.2 },
  stopBanner: { color: colors.background, borderColor: colors.accent, backgroundColor: colors.accent },
  coverBanner: { color: colors.background, borderColor: colors.danger, backgroundColor: colors.danger },
  locationSummary: { alignItems: 'center', width: '100%', marginTop: 11 },
  blockBadge: { backgroundColor: '#176B3A', borderColor: colors.success, borderWidth: 1, borderRadius: 9, paddingHorizontal: 15, paddingVertical: 7, marginBottom: 5 },
  partnerBlock: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.7 },
  partnerStreet: { color: colors.text, fontSize: 19, fontWeight: '900', marginTop: 1 },
  crossStreet: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, marginTop: 3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, marginTop: 10 },
  presenceDot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  goodDot: { backgroundColor: colors.success },
  weakDot: { backgroundColor: colors.warning },
  offlineDot: { backgroundColor: colors.muted },
  status: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  goodText: { color: colors.success },
  weakText: { color: colors.warning },
  offlineText: { color: colors.muted },
  mapFrame: { width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', marginTop: 14, borderWidth: 1, borderColor: colors.border },
  mapFrameLandscape: { height: 260, maxWidth: 760 },
  map: { flex: 1 },
  markerStack: { alignItems: 'center' },
  partnerMarker: { minWidth: 50, minHeight: 46, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(255,255,255,0.75)', alignItems: 'stretch', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 4 },
  selectedMarker: { borderWidth: 4 },
  markerLine: { alignItems: 'center' }, markerDivider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.7)', marginVertical: 2 },
  markerCallSign: { color: '#FFFFFF', fontSize: 11, lineHeight: 13, fontWeight: '900' },
  currentUnitMarker: { borderWidth: 4 },
  markerPointer: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', marginTop: -2 },
  liveMapBadge: { position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6 },
  liveMapText: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  mapLabel: { color: colors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: 14 },
  mapOptions: { flexDirection: 'row', width: '100%', marginTop: 9, gap: 7 },
  mapOption: { flex: 1, minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  mapOptionSelected: { borderColor: colors.accent, backgroundColor: colors.panelRaised },
  mapOptionText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  mapOptionTextSelected: { color: colors.accent },
  mapChoice: { color: colors.muted, fontSize: 12, marginTop: 7 },
  navigateButton: { width: '100%', minHeight: 58, backgroundColor: colors.accent, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  pressed: { opacity: 0.8 },
  navigateText: { color: colors.background, fontSize: 17, fontWeight: '900', letterSpacing: 0.8 },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 18 },
});
