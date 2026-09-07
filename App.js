import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import PartnerDetailScreen from './src/screens/PartnerDetailScreen';
import { colors } from './src/theme/colors';

export default function App() {
  const [selectedPartner, setSelectedPartner] = useState(null);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.app} edges={['top', 'right', 'bottom', 'left']}>
        <StatusBar style="light" />
        {selectedPartner ? (
          <PartnerDetailScreen
            partner={selectedPartner}
            onBack={() => setSelectedPartner(null)}
          />
        ) : (
          <HomeScreen onSelectPartner={setSelectedPartner} />
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
