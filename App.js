import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import PartnerDetailScreen from './src/screens/PartnerDetailScreen';
import { usePartners } from './src/hooks/usePartners';
import { useLiveLocation } from './src/hooks/useLiveLocation';
import { colors } from './src/theme/colors';
import { configureAlertAudio, observeDirectionNotifications, registerForCoverAlerts } from './src/services/notificationService';
import { openNavigationTo } from './src/services/navigationService';
import { useOfficerSession } from './src/hooks/useOfficerSession';
import { useDepartmentWorkspace } from './src/hooks/useDepartmentWorkspace';
import { isLocationBackendConfigured, publishLocation } from './src/services/locationApi';
import SignInScreen from './src/screens/SignInScreen';
import DepartmentScreen from './src/screens/DepartmentScreen';
import { useDutyAssignment } from './src/hooks/useDutyAssignment';
import { backgroundSharingStatus, startBackgroundSharing } from './src/services/backgroundLocationService';
import PursuitScreen from './src/screens/PursuitScreen';

function createDemoPartner(location) {
  const latitude = location?.coords?.latitude ?? 33.1212;
  const longitude = location?.coords?.longitude ?? -97.1834;
  return {
    id: 'demo-partner',
    name: 'Jordan Martinez',
    unit: 'Unit 52',
    callSign: '742',
    avatarColor: '#2563EB',
    dutyStatus: 'pursuit',
    occupants: ['Jordan Martinez'],
    occupantCallSigns: ['742'],
    connection: { online: true, quality: 'good', lastSeenAt: Date.now() },
    location: { latitude: latitude + 0.003, longitude: longitude + 0.002, accuracy: 16, heading: 45, speed: 18, timestamp: Date.now() },
  };
}

export default function App() {
  const [selectedPartnerId, setSelectedPartnerId] = useState(null);
  const [showDepartment, setShowDepartment] = useState(false);
  const lastForegroundPublish = useRef(0);
  const partnerState = usePartners();
  const partners = partnerState.partners;
  const live = useLiveLocation();
  const session = useOfficerSession();
  const duty = useDutyAssignment();
  const workspaceState = useDepartmentWorkspace(session.officer?.id);
  const workspace = workspaceState.workspace;
  const membershipsEnabled = isLocationBackendConfigured();
  const visiblePartners = membershipsEnabled && workspace?.department
    ? partners.filter((partner) => workspace.visibleDeviceIds.includes(partner.id) && partner.id !== workspace.user.deviceId)
    : partners;
  const demoPartner = useMemo(() => createDemoPartner(live.location), [live.location?.coords?.latitude, live.location?.coords?.longitude]);
  const displayedPartners = __DEV__ && !visiblePartners.length ? [demoPartner] : visiblePartners;
  const selectedPartner = displayedPartners.find((partner) => partner.id === selectedPartnerId);

  useEffect(() => observeDirectionNotifications(
    (partner, provider) => openNavigationTo(partner, provider, { armAlert: false }),
  ), []);

  useEffect(() => { configureAlertAudio().catch(() => {}); }, []);

  useEffect(() => {
    if (session.officer) registerForCoverAlerts().catch(() => {});
  }, [session.officer]);

  useEffect(() => {
    if (!session.officer || duty.assignment.callSign || duty.assignment.unitNumber) return;
    duty.setAssignment((current) => ({
      ...current,
      callSign: session.officer.callSign || '',
      unitNumber: session.officer.unitNumber || '',
    })).catch(() => {});
  }, [session.officer, duty.assignment.callSign, duty.assignment.unitNumber]);

  useEffect(() => {
    if (!session.officer || !workspace?.department) return;
    const enableSharing = async () => {
      if (await backgroundSharingStatus() === 'stopped') await startBackgroundSharing();
    };
    enableSharing().catch(() => {});
  }, [session.officer, workspace?.department?.id]);

  useEffect(() => {
    if (!session.officer || !live.location || !membershipsEnabled) return;
    const now = Date.now();
    if (now - lastForegroundPublish.current < 1000) return;
    lastForegroundPublish.current = now;
    publishLocation(live.location).catch(() => {});
  }, [live.location, membershipsEnabled, session.officer]);

  const changeDuty = async (next) => {
    const statusChanged = next.status !== duty.assignment.status;
    await duty.setAssignment(next);
    if (statusChanged && live.location) publishLocation(live.location).catch(() => {});
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.app} edges={['top', 'right', 'bottom', 'left']}>
        <StatusBar style="light" />
        {!session.officer ? (
          <SignInScreen session={session} />
        ) : membershipsEnabled && session.officer && (!workspace?.department || showDepartment) ? (
          <DepartmentScreen
            officer={session.officer}
            workspace={workspace}
            refresh={workspaceState.refresh}
            onDone={() => setShowDepartment(false)}
            onSignOut={session.signOut}
          />
        ) : duty.assignment.status === 'pursuit' ? (
          <PursuitScreen live={live} onTerminate={() => changeDuty({ ...duty.assignment, status: 'available' })} />
        ) : selectedPartner ? (
          <PartnerDetailScreen
            partner={selectedPartner}
            partners={displayedPartners}
            duty={duty.assignment}
            userLocation={live.location}
            onBack={() => setSelectedPartnerId(null)}
          />
        ) : (
          <HomeScreen
            live={live}
            partners={displayedPartners}
            department={workspace?.department}
            squads={workspace?.squads}
            officer={session.officer}
            duty={duty.assignment}
            onDutyChange={changeDuty}
            onManageDepartment={() => setShowDepartment(true)}
            onSelectPartner={(partner) => setSelectedPartnerId(partner.id)}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
