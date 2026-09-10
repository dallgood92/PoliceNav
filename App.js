import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import PartnerDetailScreen from './src/screens/PartnerDetailScreen';
import { usePartners } from './src/hooks/usePartners';
import { useLiveLocation } from './src/hooks/useLiveLocation';
import { colors } from './src/theme/colors';
import { configureAlertAudio, observeDirectionNotifications, registerForCoverAlerts, setPushAlertsEnabled } from './src/services/notificationService';
import { loadPushNotificationsEnabled } from './src/services/notificationPreferenceService';
import { useOfficerSession } from './src/hooks/useOfficerSession';
import { useDepartmentWorkspace } from './src/hooks/useDepartmentWorkspace';
import { isLocationBackendConfigured, publishLocation } from './src/services/locationApi';
import SignInScreen from './src/screens/SignInScreen';
import DepartmentScreen from './src/screens/DepartmentScreen';
import { useDutyAssignment } from './src/hooks/useDutyAssignment';
import { backgroundSharingStatus, startBackgroundSharing } from './src/services/backgroundLocationService';
import PursuitScreen from './src/screens/PursuitScreen';
import SquadMapScreen from './src/screens/SquadMapScreen';
import { collapseSharedUnitPartners, SHARED_UNIT_DISTANCE_METERS } from './src/utils/unitGrouping';
import { distanceInMeters } from './src/utils/geo';

function createDemoPartners(location) {
  const latitude = location?.coords?.latitude ?? 33.1212;
  const longitude = location?.coords?.longitude ?? -97.1834;
  const samples = [
    ['Jordan Martinez', '52', '742', 'pursuit', '#059669', 0.018, -0.014],
    ['Casey Nguyen', '31', '618', 'traffic_stop', '#059669', -0.017, 0.016],
    ['Taylor Brooks', '18', '405', 'cover_requested', '#059669', 0.012, 0.019],
    ['Morgan Reed', '63', '296', 'available', '#059669', -0.021, -0.012],
    ['Avery Patel', '24', '531', 'available', '#059669', 0.004, -0.024],
    ['Cameron Lewis', '39', '684', 'available', '#059669', 0.024, 0.006],
  ];
  return samples.map(([name, unit, callSign, dutyStatus, avatarColor, latitudeOffset, longitudeOffset], index) => ({
    id: `demo-partner-${index + 1}`, name, unit: `Unit ${unit}`, callSign, avatarColor, dutyStatus,
    occupants: [name], occupantCallSigns: [callSign],
    connection: { online: true, quality: 'good', lastSeenAt: Date.now() },
    location: { latitude: latitude + latitudeOffset, longitude: longitude + longitudeOffset, accuracy: 16, heading: 45 + index * 35, speed: dutyStatus === 'available' ? 0 : 18, timestamp: Date.now() },
  }));
}

export default function App() {
  const [selectedPartnerId, setSelectedPartnerId] = useState(null);
  const [notificationPartner, setNotificationPartner] = useState(null);
  const [fullscreenRequestKey, setFullscreenRequestKey] = useState(0);
  const [showDepartment, setShowDepartment] = useState(false);
  const [showSquadMap, setShowSquadMap] = useState(false);
  const [pushAlertsEnabled, setPushAlertsEnabledState] = useState(null);
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
  const demoPartners = useMemo(() => createDemoPartners(live.location), [live.location?.coords?.latitude, live.location?.coords?.longitude]);
  const assignmentAwareDemoPartners = useMemo(() => demoPartners.map((partner) => {
    if (!duty.assignment.secondOfficerCallSign || partner.callSign !== duty.assignment.secondOfficerCallSign || !live.location?.coords) return partner;
    return {
      ...partner,
      location: {
        ...partner.location,
        latitude: live.location.coords.latitude + 0.000025,
        longitude: live.location.coords.longitude + 0.000015,
        timestamp: Date.now(),
      },
    };
  }), [demoPartners, duty.assignment.secondOfficerCallSign, live.location?.coords?.latitude, live.location?.coords?.longitude]);
  const groupedPartners = useMemo(() => collapseSharedUnitPartners(visiblePartners), [visiblePartners]);
  const displayedPartners = __DEV__ && !groupedPartners.length ? assignmentAwareDemoPartners : groupedPartners;
  const assignedPartnerCallSign = String(duty.assignment.secondOfficerCallSign || '').trim();
  const assignedPartner = assignedPartnerCallSign
    ? displayedPartners.find((partner) => [partner.callSign, ...(partner.occupantCallSigns || [])]
        .some((callSign) => String(callSign || '').trim() === assignedPartnerCallSign))
    : null;
  const assignedPartnerIsWithUnit = Boolean(assignedPartner && live.location?.coords
    && distanceInMeters(live.location.coords, assignedPartner.location) <= SHARED_UNIT_DISTANCE_METERS);
  const homePartners = assignedPartnerIsWithUnit
    ? displayedPartners.filter((partner) => ![partner.callSign, ...(partner.occupantCallSigns || [])]
        .some((callSign) => String(callSign || '').trim() === assignedPartnerCallSign))
    : displayedPartners;
  const selectedPartner = displayedPartners.find((partner) => partner.id === selectedPartnerId)
    || (notificationPartner?.id === selectedPartnerId ? notificationPartner : null);

  useEffect(() => observeDirectionNotifications((partner) => {
    setNotificationPartner(partner);
    setSelectedPartnerId(partner.id);
    setFullscreenRequestKey((current) => current + 1);
  }), []);

  useEffect(() => { configureAlertAudio().catch(() => {}); }, []);

  useEffect(() => { loadPushNotificationsEnabled().then(setPushAlertsEnabledState).catch(() => {}); }, []);

  useEffect(() => {
    if (session.officer && pushAlertsEnabled !== null) registerForCoverAlerts().catch(() => {});
  }, [session.officer, pushAlertsEnabled]);

  useEffect(() => {
    if (!session.officer || duty.assignment.callSign) return;
    duty.setAssignment((current) => ({
      ...current,
      callSign: session.officer.callSign || '',
    })).catch(() => {});
  }, [session.officer, duty.assignment.callSign]);

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
        ) : showSquadMap ? (
          <SquadMapScreen partners={displayedPartners} userLocation={live.location} duty={duty.assignment} onClose={() => setShowSquadMap(false)} />
        ) : selectedPartner ? (
          <PartnerDetailScreen
            partner={selectedPartner}
            partners={homePartners}
            duty={duty.assignment}
            sharedUnit={assignedPartnerIsWithUnit}
            userLocation={live.location}
            fullscreenRequestKey={fullscreenRequestKey}
            onBack={() => { setSelectedPartnerId(null); setNotificationPartner(null); }}
          />
        ) : duty.assignment.status === 'pursuit' ? (
          <PursuitScreen live={live} onTerminate={() => changeDuty({ ...duty.assignment, status: 'available' })} />
        ) : (
          <HomeScreen
            live={live}
            partners={homePartners}
            unitPartners={displayedPartners}
            department={workspace?.department}
            squads={workspace?.squads}
            officer={session.officer}
            duty={duty.assignment}
            onDutyChange={changeDuty}
            onManageDepartment={() => setShowDepartment(true)}
            onOpenSquadMap={() => setShowSquadMap(true)}
            pushAlertsEnabled={pushAlertsEnabled !== false}
            onPushAlertsChange={(enabled) => {
              setPushAlertsEnabledState(enabled);
              setPushAlertsEnabled(enabled).catch(() => {});
            }}
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
