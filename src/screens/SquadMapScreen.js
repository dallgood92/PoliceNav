import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { colors } from '../theme/colors';
import { getPartnerPresence } from '../utils/presence';
import { usePartnerLocationDetails } from '../hooks/usePartnerLocationDetails';
import { deriveHundredBlock, formatStreet } from '../utils/address';

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#17212B' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#AAB6C2' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#101820' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#18242D' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1E2D36' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2B3947' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111A22' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#D7DEE5' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#495867' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#091B2C' }] },
];

const validCoordinate = (location) => Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude);
function OfficerMarker({ partner, onPress }) {
  const presence = getPartnerPresence(partner);
  const pursuitFlash = useRef(new Animated.Value(0)).current;
  const pursuitRotation = useRef(new Animated.Value(0)).current;
  const isPursuit = partner.dutyStatus === 'pursuit';
  const flashesRedBlue = isPursuit || partner.dutyStatus === 'traffic_stop';
  const hasUnderGlow = flashesRedBlue || partner.dutyStatus === 'cover_requested';
  useEffect(() => {
    if (!flashesRedBlue) {
      pursuitFlash.stopAnimation();
      pursuitFlash.setValue(0);
      return undefined;
    }
    const duration = isPursuit ? 220 : 420;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pursuitFlash, { toValue: 1, duration, useNativeDriver: false }),
      Animated.timing(pursuitFlash, { toValue: 0, duration, useNativeDriver: false }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [flashesRedBlue, isPursuit, pursuitFlash]);
  useEffect(() => {
    if (!isPursuit) {
      pursuitRotation.stopAnimation();
      pursuitRotation.setValue(0);
      return undefined;
    }
    const animation = Animated.loop(Animated.timing(pursuitRotation, {
      toValue: 1,
      duration: 850,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [isPursuit, pursuitRotation]);
  const staticGlow = partner.dutyStatus === 'cover_requested'
    ? colors.danger
    : colors.success;
  const leftEmergencyColor = pursuitFlash.interpolate({ inputRange: [0, 1], outputRange: ['#EF233C', '#3478F6'] });
  const rightEmergencyColor = pursuitFlash.interpolate({ inputRange: [0, 1], outputRange: ['#3478F6', '#EF233C'] });
  const glowColor = flashesRedBlue
    ? leftEmergencyColor
    : staticGlow;
  return (
    <Pressable
      accessibilityLabel={`Show ${partner.callSign || 'partner'} location`}
      accessibilityRole="button"
      hitSlop={18}
      onPress={onPress}
      style={styles.markerTouchTarget}
    >
    <View style={styles.marker} pointerEvents="none">
      <View style={styles.markerIdentity}><View style={[styles.presenceDot, { backgroundColor: presence.online ? colors.success : colors.danger }]} /><Text style={styles.callSign}>{partner.callSign || '—'}</Text></View>
      <View style={styles.partnerCarWrap}>
        {isPursuit ? (
          <Animated.View style={[styles.pursuitOrbit, { transform: [{ rotate: pursuitRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
            <View style={[styles.orbitLight, styles.orbitTop, styles.orbitRed]} />
            <View style={[styles.orbitLight, styles.orbitRight, styles.orbitBlue]} />
            <View style={[styles.orbitLight, styles.orbitBottom, styles.orbitRed]} />
            <View style={[styles.orbitLight, styles.orbitLeft, styles.orbitBlue]} />
          </Animated.View>
        ) : null}
        {hasUnderGlow ? <><Animated.View style={[styles.underGlow, { backgroundColor: glowColor, shadowColor: glowColor }]} /><View style={styles.underGlowMask} /></> : null}
        <Image
          source={require('../../assets/partner-unit-car.png')}
          resizeMode="contain"
          fadeDuration={0}
          style={[styles.partnerCar, !presence.online && styles.offlinePartnerCar]}
        />
        {flashesRedBlue ? (
          <View style={styles.roofLightBar}>
            <Animated.View style={[styles.roofLight, { backgroundColor: leftEmergencyColor }]} />
            <Animated.View style={[styles.roofLight, { backgroundColor: rightEmergencyColor }]} />
          </View>
        ) : null}
      </View>
    </View>
    </Pressable>
  );
}

function SelectedLocationCard({ partner, onClose }) {
  const presence = getPartnerPresence(partner);
  const details = usePartnerLocationDetails(partner.location);
  const block = deriveHundredBlock(details.address)?.replace(/\bBLOCK\b/g, 'BLK') || '';
  const street = formatStreet(details.address);
  const validStreet = street !== 'STREET UNAVAILABLE' ? street : '';
  return (
    <View style={styles.selectedLocationCard}>
      <View style={styles.selectedLocationHeader}>
        <View style={styles.selectedIdentity}><View style={[styles.selectedPresenceDot, { backgroundColor: presence.online ? colors.success : colors.danger }]} /><Text style={styles.selectedCallSign}>{partner.callSign || '—'}</Text><Text style={styles.selectedPresence}>{presence.label.toUpperCase()}</Text></View>
        <Pressable accessibilityLabel="Hide partner location" accessibilityRole="button" onPress={onClose} hitSlop={10}><Text style={styles.locationClose}>×</Text></Pressable>
      </View>
      <Text style={styles.selectedBlock}>{details.loading ? 'LOCATING…' : block || 'BLOCK UNAVAILABLE'}</Text>
      {!details.loading ? <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.selectedStreet}>{validStreet || 'LOCATION UNAVAILABLE'}</Text> : null}
    </View>
  );
}

function CurrentMarker({ callSign }) {
  return (
    <View style={styles.marker}>
      <Text style={styles.youLabel}>{callSign || 'YOU'}</Text>
      <Image source={require('../../assets/current-unit-car.png')} resizeMode="contain" style={styles.currentCar} />
    </View>
  );
}

export default function SquadMapScreen({ partners, userLocation, duty, onClose }) {
  const mapRef = useRef(null);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const coordinates = [
    ...(validCoordinate(userLocation?.coords) ? [{ latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude }] : []),
    ...partners.filter((partner) => validCoordinate(partner.location)).map((partner) => ({ latitude: partner.location.latitude, longitude: partner.location.longitude })),
  ];
  const fitOfficers = () => {
    if (!mapRef.current || !coordinates.length) return;
    if (coordinates.length === 1) {
      mapRef.current.animateToRegion({ ...coordinates[0], latitudeDelta: 0.025, longitudeDelta: 0.025 }, 350);
      return;
    }
    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: landscape
        ? { top: 72, right: 100, bottom: 72, left: 100 }
        : { top: 130, right: 88, bottom: 120, left: 88 },
      animated: true,
    });
  };

  useEffect(fitOfficers, [
    userLocation?.coords?.latitude,
    userLocation?.coords?.longitude,
    partners.map((partner) => `${partner.id}:${partner.location?.latitude}:${partner.location?.longitude}`).join('|'),
    landscape,
  ]);

  const initial = coordinates[0] || { latitude: 33.1212, longitude: -97.1834 };
  const selectPartner = (partner) => setSelectedPartner(partner);
  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        customMapStyle={DARK_MAP_STYLE}
        userInterfaceStyle="dark"
        initialRegion={{ ...initial, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
        onMapReady={fitOfficers}
        onPress={() => setSelectedPartner(null)}
        pitchEnabled={false}
        rotateEnabled={false}
        showsCompass={false}
        showsBuildings
      >
        {validCoordinate(userLocation?.coords) ? (
          <Marker coordinate={userLocation.coords} anchor={{ x: 0.5, y: 0.5 }} zIndex={20} tracksViewChanges>
            <CurrentMarker callSign={duty?.callSign} />
          </Marker>
        ) : null}
        {partners.filter((partner) => validCoordinate(partner.location)).map((partner, index) => (
          <Marker
            key={partner.id || partner.callSign || `partner-${index}`}
            coordinate={partner.location}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges
            tappable
            onPress={() => selectPartner(partner)}
            onSelect={() => selectPartner(partner)}
          >
            <OfficerMarker partner={partner} onPress={() => selectPartner(partner)} />
          </Marker>
        ))}
      </MapView>
      <View pointerEvents="none" style={styles.titleBadge}><Text style={styles.title}>SQUAD OVERVIEW</Text><Text style={styles.subtitle}>{partners.length} PARTNER{partners.length === 1 ? '' : 'S'}</Text></View>
      {selectedPartner ? <SelectedLocationCard partner={selectedPartner} onClose={() => setSelectedPartner(null)} /> : null}
      <Pressable accessibilityLabel="Close squad map" accessibilityRole="button" onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  titleBadge: { position: 'absolute', top: 12, left: 12, borderRadius: 8, backgroundColor: 'rgba(11,17,24,0.94)', paddingHorizontal: 12, paddingVertical: 8 },
  title: { color: colors.text, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  subtitle: { color: colors.muted, fontSize: 8, fontWeight: '800', letterSpacing: 0.8, marginTop: 2 },
  closeButton: { position: 'absolute', right: 12, top: 12, width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(11,17,24,0.94)' },
  closeText: { color: colors.accent, fontSize: 30, lineHeight: 32, fontWeight: '900' },
  marker: { alignItems: 'center', justifyContent: 'center' },
  markerTouchTarget: { minWidth: 58, minHeight: 78, alignItems: 'center', justifyContent: 'center' },
  markerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  callSign: { color: colors.accent, fontSize: 13, lineHeight: 15, fontWeight: '900', textShadowColor: colors.background, textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  youLabel: { color: colors.accent, fontSize: 13, lineHeight: 15, fontWeight: '900', textShadowColor: colors.background, textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  partnerCar: { width: 31, height: 47, zIndex: 2 },
  offlinePartnerCar: { opacity: 0.52 },
  partnerCarWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  underGlow: { position: 'absolute', width: 28, height: 49, borderRadius: 14, opacity: 0.82, shadowOpacity: 1, shadowRadius: 11, shadowOffset: { width: 0, height: 0 }, zIndex: 0 },
  underGlowMask: { position: 'absolute', width: 18, height: 42, borderRadius: 9, backgroundColor: 'rgba(11,17,24,0.96)', zIndex: 1 },
  roofLightBar: { position: 'absolute', top: 23, width: 10, height: 3, flexDirection: 'row', overflow: 'hidden', borderRadius: 1, backgroundColor: '#111820', zIndex: 3 },
  roofLight: { flex: 1 },
  pursuitOrbit: { position: 'absolute', width: 43, height: 57, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', zIndex: 4 },
  orbitLight: { position: 'absolute', width: 7, height: 7, borderRadius: 4, shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  orbitTop: { top: -4, left: 18 },
  orbitRight: { right: -4, top: 25 },
  orbitBottom: { bottom: -4, left: 18 },
  orbitLeft: { left: -4, top: 25 },
  orbitRed: { backgroundColor: '#EF233C', shadowColor: '#EF233C' },
  orbitBlue: { backgroundColor: '#3478F6', shadowColor: '#3478F6' },
  currentCar: { width: 33, height: 50 },
  presenceDot: { width: 7, height: 7, borderRadius: 4 },
  selectedLocationCard: { position: 'absolute', left: 14, right: 74, bottom: 14, maxWidth: 390, zIndex: 100, elevation: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(11,17,24,0.96)', paddingHorizontal: 13, paddingVertical: 10 },
  selectedLocationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectedIdentity: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  selectedPresenceDot: { width: 8, height: 8, borderRadius: 4 },
  selectedCallSign: { color: colors.accent, fontSize: 13, fontWeight: '900' },
  selectedPresence: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  locationClose: { color: colors.muted, fontSize: 22, lineHeight: 23, fontWeight: '800' },
  selectedBlock: { color: colors.accent, fontSize: 14, lineHeight: 17, fontWeight: '900', marginTop: 5 },
  selectedStreet: { color: colors.text, fontSize: 15, lineHeight: 18, fontWeight: '900', marginTop: 1 },
});
