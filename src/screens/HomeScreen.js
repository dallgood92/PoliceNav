import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import LocationHero from '../components/LocationHero';
import LocationStats from '../components/LocationStats';
import PartnerRow from '../components/PartnerRow';
import DutyAssignmentCard from '../components/DutyAssignmentCard';
import { colors } from '../theme/colors';

export default function HomeScreen({ live, partners, department, squads, officer, duty, onDutyChange, onManageDepartment, onSelectPartner }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {department ? <Pressable onPress={onManageDepartment} style={styles.departmentBar}><View><Text style={styles.departmentName}>{department.name}</Text><Text style={styles.squadName}>{squads?.map((squad) => squad.name).join(' · ') || 'Awaiting squad assignment'}</Text></View><Text style={styles.manage}>MANAGE ›</Text></Pressable> : null}
      <LocationHero {...live} />
      <LocationStats location={live.location} />
      <DutyAssignmentCard officer={officer} assignment={duty} onChange={onDutyChange} />
      {live.error ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeIcon}>!</Text>
          <Text style={styles.noticeText}>{live.error}</Text>
        </View>
      ) : null}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>PARTNERS</Text>
        <Text style={styles.mockLabel}>DEMO DATA</Text>
      </View>
      <View style={styles.partnerList}>
        {partners.map((partner) => (
          <PartnerRow
            key={partner.id}
            partner={partner}
            userLocation={live.location}
            onPress={onSelectPartner}
          />
        ))}
      </View>
      <Text style={styles.disclaimer}>Verify location before operational use. GPS and geocoded addresses can be inaccurate.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 28 },
  notice: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, borderLeftColor: colors.warning, borderLeftWidth: 4, borderRadius: 8, marginHorizontal: 14, marginTop: 12, paddingHorizontal: 13, paddingVertical: 11 },
  noticeIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.warning, color: colors.background, fontSize: 16, fontWeight: '900', textAlign: 'center', lineHeight: 24, marginRight: 10 },
  noticeText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginHorizontal: 16, marginBottom: 9 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900', letterSpacing: 1.4 },
  mockLabel: { color: colors.warning, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  partnerList: { marginHorizontal: 14, borderRadius: 12 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginHorizontal: 28, marginTop: 22 },
  departmentBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 14, marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: colors.panel },
  departmentName: { color: colors.text, fontSize: 14, fontWeight: '900' }, squadName: { color: colors.muted, fontSize: 11, marginTop: 2 }, manage: { color: colors.accent, fontSize: 11, fontWeight: '900' },
});
