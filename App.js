import { useEffect, useRef, useState } from 'react';
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
  const selectedPartner = visiblePartners.find((partner) => partner.id === selectedPartnerId);

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
            partners={visiblePartners}
            duty={duty.assignment}
            userLocation={live.location}
            onBack={() => setSelectedPartnerId(null)}
          />
        ) : (
          <HomeScreen
            live={live}
            partners={visiblePartners}
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
