import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import LocationHero from '../components/LocationHero';
import LocationStats from '../components/LocationStats';
import PartnerRow from '../components/PartnerRow';
import DutyAssignmentCard from '../components/DutyAssignmentCard';
import { useMapPreference } from '../hooks/useMapPreference';
import { colors } from '../theme/colors';

export default function HomeScreen({ live, partners, department, squads, officer, duty, onDutyChange, onManageDepartment, onSelectPartner }) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [menuOpen, setMenuOpen] = useState(false);
  const [partnerPage, setPartnerPage] = useState(0);
  const { preference, setPreference } = useMapPreference();
  const pageSize = landscape ? 2 : 1;
  const pages = Math.max(1, Math.ceil(partners.length / pageSize));
  useEffect(() => { if (partnerPage >= pages) setPartnerPage(pages - 1); }, [partnerPage, pages]);
  const visiblePartners = useMemo(() => partners.slice(partnerPage * pageSize, partnerPage * pageSize + pageSize), [partners, partnerPage, pageSize]);
  const selectedMap = preference === 'google' ? 'google' : 'apple';

  const locationPanel = <View style={styles.locationPanel}><LocationHero {...live} compact />{!landscape ? <LocationStats location={live.location} compact /> : null}</View>;
  const controlsPanel = (
    <View style={styles.controlsPanel}>
      <DutyAssignmentCard officer={officer} partners={partners} assignment={duty} onChange={onDutyChange} compact />
      {live.error ? <Text numberOfLines={2} style={styles.notice}>{live.error}</Text> : null}
      <View style={styles.partnerHeader}>
        <Text style={styles.sectionTitle}>PARTNERS</Text>
        {pages > 1 ? <View style={styles.pager}><Pressable disabled={partnerPage === 0} onPress={() => setPartnerPage((page) => page - 1)} style={styles.pageButton}><Text style={styles.pageText}>‹</Text></Pressable><Text style={styles.pageCount}>{partnerPage + 1}/{pages}</Text><Pressable disabled={partnerPage === pages - 1} onPress={() => setPartnerPage((page) => page + 1)} style={styles.pageButton}><Text style={styles.pageText}>›</Text></Pressable></View> : null}
      </View>
      <View style={[styles.partnerList, landscape && styles.partnerListLandscape]}>
        {visiblePartners.map((partner) => <PartnerRow key={partner.id} partner={partner} userLocation={live.location} onPress={onSelectPartner} compact />)}
        {!partners.length ? <Text style={styles.emptyPartners}>No squad partners are sharing yet.</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Open menu" accessibilityRole="button" onPress={() => setMenuOpen(true)} style={styles.menuButton}><Text style={styles.menuGlyph}>☰</Text></Pressable>
        <View style={styles.mapToggle}><Text style={styles.mapLabel}>MAP</Text><Pressable onPress={() => setPreference('apple')} style={[styles.mapOption, selectedMap === 'apple' && styles.mapOptionActive]}><Text style={[styles.mapOptionText, selectedMap === 'apple' && styles.mapOptionTextActive]}>APPLE</Text></Pressable><Pressable onPress={() => setPreference('google')} style={[styles.mapOption, selectedMap === 'google' && styles.mapOptionActive]}><Text style={[styles.mapOptionText, selectedMap === 'google' && styles.mapOptionTextActive]}>GOOGLE</Text></Pressable></View>
      </View>
      <View style={[styles.body, landscape && styles.bodyLandscape]}>{locationPanel}{landscape ? <View style={styles.verticalRule} /> : null}{controlsPanel}</View>
      <Modal visible={menuOpen} transparent animationType="fade" supportedOrientations={['portrait', 'landscape']} onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={[styles.scrim, landscape && styles.scrimLandscape]} onPress={() => setMenuOpen(false)}><Pressable style={[styles.menu, landscape && styles.menuLandscape]} onPress={() => {}}>
          <Text style={styles.menuTitle}>SQUADNAV</Text>
          {department ? <><Text style={styles.department}>{department.name}</Text><Text style={styles.squads}>{squads?.map((squad) => squad.name).join(' · ') || 'Awaiting squad assignment'}</Text></> : null}
          {department ? <Pressable style={styles.menuAction} onPress={() => { setMenuOpen(false); onManageDepartment(); }}><Text style={styles.menuActionText}>MANAGE DEPARTMENT</Text></Pressable> : null}
          <Pressable style={styles.closeAction} onPress={() => setMenuOpen(false)}><Text style={styles.closeText}>CLOSE</Text></Pressable>
        </Pressable></Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 12, paddingBottom: 8 }, topBar: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  menuButton: { width: 42, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: colors.panel }, menuGlyph: { color: colors.accent, fontSize: 23, fontWeight: '900', lineHeight: 25 },
  mapToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 }, mapLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginRight: 2 }, mapOption: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 6, borderWidth: 1, borderColor: colors.border }, mapOptionActive: { backgroundColor: colors.accent, borderColor: colors.accent }, mapOptionText: { color: colors.muted, fontSize: 9, fontWeight: '900' }, mapOptionTextActive: { color: colors.background },
  body: { flex: 1 }, bodyLandscape: { flexDirection: 'row', gap: 10 }, locationPanel: { flex: 1, justifyContent: 'center' }, controlsPanel: { flex: 1, justifyContent: 'center' }, verticalRule: { width: 1, marginVertical: 8, backgroundColor: colors.border },
  notice: { color: colors.warning, backgroundColor: colors.panel, fontSize: 11, fontWeight: '700', marginHorizontal: 6, marginTop: 5, padding: 7, borderRadius: 6 }, partnerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32, marginHorizontal: 4, marginTop: 5 }, sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900', letterSpacing: 1.2 },
  pager: { flexDirection: 'row', alignItems: 'center' }, pageButton: { width: 31, height: 28, justifyContent: 'center', alignItems: 'center' }, pageText: { color: colors.accent, fontSize: 25, fontWeight: '900' }, pageCount: { color: colors.muted, fontSize: 10, fontWeight: '800' }, partnerList: { minHeight: 88 }, partnerListLandscape: { minHeight: 0 }, emptyPartners: { color: colors.muted, backgroundColor: colors.panel, borderRadius: 9, padding: 15, textAlign: 'center', fontSize: 12 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'flex-start', paddingTop: 64, paddingHorizontal: 16 }, scrimLandscape: { justifyContent: 'center', alignItems: 'center', paddingTop: 10 }, menu: { width: 290, backgroundColor: colors.panel, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 18 }, menuLandscape: { width: '68%', maxWidth: 560, paddingVertical: 14, paddingHorizontal: 22 }, menuTitle: { color: colors.accent, fontSize: 18, fontWeight: '900', letterSpacing: 1.5 }, department: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 18 }, squads: { color: colors.muted, fontSize: 12, marginTop: 3 }, menuAction: { backgroundColor: colors.accent, padding: 13, borderRadius: 8, marginTop: 20 }, menuActionText: { color: colors.background, fontSize: 11, fontWeight: '900', textAlign: 'center' }, closeAction: { paddingTop: 16 }, closeText: { color: colors.muted, fontSize: 11, fontWeight: '900', textAlign: 'center' },
});
