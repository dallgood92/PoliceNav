import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import LocationHero from '../components/LocationHero';
import LocationStats from '../components/LocationStats';
import PartnerRow from '../components/PartnerRow';
import DutyAssignmentCard from '../components/DutyAssignmentCard';
import { colors } from '../theme/colors';

function MapIcon() {
  return (
    <View style={styles.mapIcon}>
      <View style={[styles.mapFold, styles.mapFoldLeft]} />
      <View style={[styles.mapFold, styles.mapFoldMiddle]} />
      <View style={[styles.mapFold, styles.mapFoldRight]} />
      <View style={styles.mapRouteDot} />
    </View>
  );
}

export default function HomeScreen({ live, partners, unitPartners = partners, department, squads, officer, duty, onDutyChange, onManageDepartment, onOpenSquadMap, onSelectPartner, pushAlertsEnabled, onPushAlertsChange }) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [menuOpen, setMenuOpen] = useState(false);
  const compressedPartners = landscape && partners.length >= 5;
  const sortedPartners = useMemo(() => {
    const priority = { pursuit: 0, cover_requested: 1, traffic_stop: 2, available: 3 };
    return partners.map((partner, index) => ({ partner, index })).sort((a, b) => (priority[a.partner.dutyStatus] ?? 3) - (priority[b.partner.dutyStatus] ?? 3) || a.index - b.index).map(({ partner }) => partner);
  }, [partners]);

  const locationPanel = <View style={styles.locationPanel}><LocationHero {...live} compact />{!landscape ? <LocationStats location={live.location} compact /> : null}</View>;
  const controlsPanel = (
    <View style={[styles.controlsPanel, landscape && styles.controlsPanelLandscape]}>
      <DutyAssignmentCard officer={officer} partners={unitPartners} assignment={duty} onChange={onDutyChange} compact dense={landscape} />
      {live.error ? <Text numberOfLines={2} style={styles.notice}>{live.error}</Text> : null}
      <View style={styles.partnerHeader}>
        <Text style={styles.sectionTitle}>PARTNERS</Text>
        <Text style={styles.partnerCount}>{partners.length}</Text>
      </View>
      <ScrollView style={[styles.partnerScroller, landscape && styles.partnerScrollerLandscape]} contentContainerStyle={[styles.partnerList, landscape && styles.partnerListLandscape]} nestedScrollEnabled showsVerticalScrollIndicator={partners.length > 6}>
        {sortedPartners.map((partner) => <PartnerRow key={partner.id} partner={partner} userLocation={live.location} onPress={onSelectPartner} compact dense compressed={compressedPartners} tile={!landscape} />)}
        {!partners.length ? <Text style={styles.emptyPartners}>No squad partners are sharing yet.</Text> : null}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Open menu" accessibilityRole="button" onPress={() => setMenuOpen(true)} style={styles.menuButton}><Text style={styles.menuGlyph}>☰</Text></Pressable>
        <Pressable accessibilityLabel="Open squad overview map" accessibilityRole="button" onPress={onOpenSquadMap} style={styles.mapButton}><MapIcon /></Pressable>
      </View>
      <View style={[styles.body, landscape && styles.bodyLandscape]}>{locationPanel}{landscape ? <View style={styles.verticalRule} /> : null}{controlsPanel}</View>
      <Modal visible={menuOpen} transparent animationType="fade" supportedOrientations={['portrait', 'landscape']} onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={[styles.scrim, landscape && styles.scrimLandscape]} onPress={() => setMenuOpen(false)}><Pressable style={[styles.menu, landscape && styles.menuLandscape]} onPress={() => {}}>
          <Text style={styles.menuTitle}>SQUADNAV</Text>
          {department ? <><Text style={styles.department}>{department.name}</Text><Text style={styles.squads}>{squads?.map((squad) => squad.name).join(' · ') || 'Awaiting squad assignment'}</Text></> : null}
          <View style={styles.notificationRow}>
            <View style={styles.notificationCopy}><Text style={styles.notificationTitle}>PUSH NOTIFICATIONS</Text><Text style={styles.notificationHint}>{pushAlertsEnabled ? 'Cover and pursuit alerts are active' : 'Test mode — no push alerts sent or received'}</Text></View>
            <Switch accessibilityLabel="Push notifications" value={pushAlertsEnabled} onValueChange={onPushAlertsChange} trackColor={{ false: colors.border, true: colors.success }} thumbColor={colors.text} />
          </View>
          {department ? <Pressable style={styles.menuAction} onPress={() => { setMenuOpen(false); onManageDepartment(); }}><Text style={styles.menuActionText}>MANAGE DEPARTMENT</Text></Pressable> : null}
          <Pressable style={styles.closeAction} onPress={() => setMenuOpen(false)}><Text style={styles.closeText}>CLOSE</Text></Pressable>
        </Pressable></Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 12, paddingBottom: 8 }, topBar: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuButton: { width: 42, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: colors.panel }, menuGlyph: { color: colors.accent, fontSize: 23, fontWeight: '900', lineHeight: 25 },
  mapButton: { width: 42, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: colors.panel },
  mapIcon: { width: 23, height: 21, position: 'relative', flexDirection: 'row', transform: [{ rotate: '-2deg' }] },
  mapFold: { width: 8, height: 20, borderColor: colors.accent, borderTopWidth: 2, borderBottomWidth: 2 },
  mapFoldLeft: { borderLeftWidth: 2, transform: [{ skewY: '-12deg' }] },
  mapFoldMiddle: { borderLeftWidth: 2, borderRightWidth: 2, transform: [{ skewY: '12deg' }] },
  mapFoldRight: { width: 7, borderRightWidth: 2, transform: [{ skewY: '-12deg' }] },
  mapRouteDot: { position: 'absolute', right: 3, top: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  notificationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 16, padding: 12, borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }, notificationCopy: { flex: 1 }, notificationTitle: { color: colors.text, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 }, notificationHint: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 3 },
  body: { flex: 1 }, bodyLandscape: { flexDirection: 'row', gap: 10 }, locationPanel: { flex: 1, justifyContent: 'center' }, controlsPanel: { flex: 1, justifyContent: 'center' }, controlsPanelLandscape: { justifyContent: 'flex-start', paddingTop: 2 }, verticalRule: { width: 1, marginVertical: 8, backgroundColor: colors.border },
  notice: { color: colors.warning, backgroundColor: colors.panel, fontSize: 11, fontWeight: '700', marginHorizontal: 6, marginTop: 5, padding: 7, borderRadius: 6 }, partnerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32, marginHorizontal: 4, marginTop: 5 }, sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900', letterSpacing: 1.2 },
  partnerCount: { color: colors.muted, fontSize: 11, fontWeight: '900' }, partnerScroller: { flexShrink: 1 }, partnerScrollerLandscape: { flex: 1 }, partnerList: { minHeight: 88, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }, partnerListLandscape: { minHeight: 0, flexDirection: 'column', flexWrap: 'nowrap' }, emptyPartners: { width: '100%', color: colors.muted, backgroundColor: colors.panel, borderRadius: 9, padding: 15, textAlign: 'center', fontSize: 12 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'flex-start', paddingTop: 64, paddingHorizontal: 16 }, scrimLandscape: { justifyContent: 'center', alignItems: 'center', paddingTop: 10 }, menu: { width: 290, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 18 }, menuLandscape: { width: '68%', maxWidth: 560, paddingVertical: 14, paddingHorizontal: 22 }, menuTitle: { color: colors.accent, fontSize: 18, fontWeight: '900', letterSpacing: 1.5 }, department: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 18 }, squads: { color: colors.muted, fontSize: 12, marginTop: 3 }, menuAction: { backgroundColor: colors.accent, padding: 13, borderRadius: 8, marginTop: 16 }, menuActionText: { color: colors.background, fontSize: 11, fontWeight: '900', textAlign: 'center' }, closeAction: { paddingTop: 16 }, closeText: { color: colors.muted, fontSize: 11, fontWeight: '900', textAlign: 'center' },
});
