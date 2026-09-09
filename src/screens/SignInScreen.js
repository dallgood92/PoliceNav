import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme/colors';

export default function SignInScreen({ session }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [callSign, setCallSign] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const complete = [firstName, lastName, callSign, unitNumber].every((value) => value.trim());

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Text style={styles.brand}>SQUADNAV</Text>
      <Text style={styles.title}>Set up this device</Text>
      <Text style={styles.body}>Enter the officer and unit assigned to this phone. SquadNav will remember them on this device.</Text>
      <View style={styles.nameRow}>
        <TextInput autoCapitalize="words" autoComplete="given-name" onChangeText={setFirstName} placeholder="First name" placeholderTextColor={colors.muted} style={[styles.input, styles.halfInput]} value={firstName} />
        <TextInput autoCapitalize="words" autoComplete="family-name" onChangeText={setLastName} placeholder="Last name" placeholderTextColor={colors.muted} style={[styles.input, styles.halfInput]} value={lastName} />
      </View>
      <TextInput autoCapitalize="characters" onChangeText={setCallSign} placeholder="Call sign" placeholderTextColor={colors.muted} style={styles.input} value={callSign} />
      <TextInput onChangeText={setUnitNumber} placeholder="Unit number" placeholderTextColor={colors.muted} style={styles.input} value={unitNumber} />
      <Pressable disabled={!complete || session.loading} onPress={() => session.register({ firstName, lastName, callSign, unitNumber })} style={[styles.button, (!complete || session.loading) && styles.buttonDisabled]}>
        {session.loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.buttonText}>SAVE AND CONTINUE</Text>}
      </Pressable>
      {session.error ? <Text style={styles.error}>{session.error}</Text> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: colors.background },
  brand: { color: colors.accent, fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 12 },
  body: { color: colors.muted, fontSize: 17, lineHeight: 25, marginTop: 14 },
  nameRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  input: { minHeight: 54, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, fontSize: 17, paddingHorizontal: 15, marginTop: 10 },
  halfInput: { flex: 1, marginTop: 0 },
  button: { minHeight: 58, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: colors.background, fontSize: 15, fontWeight: '900' },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 12 },
});
