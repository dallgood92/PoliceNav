import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export default function SignInScreen({ session }) {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>SQUADNAV</Text>
      <Text style={styles.title}>Partner location for your squad</Text>
      <Text style={styles.body}>Sign in to request access to a department and see officers assigned to your squad.</Text>
      <Pressable disabled={!session.configured || !session.request} onPress={session.signIn} style={[styles.button, (!session.configured || !session.request) && styles.buttonDisabled]}>
        {session.loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.buttonText}>SIGN IN WITH GOOGLE</Text>}
      </Pressable>
      {!session.configured ? <Text style={styles.setup}>Google sign-in must be configured before this build can be used.</Text> : null}
      {session.error ? <Text style={styles.error}>{session.error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: colors.background },
  brand: { color: colors.accent, fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  title: { color: colors.text, fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 12 },
  body: { color: colors.muted, fontSize: 17, lineHeight: 25, marginTop: 14 },
  button: { minHeight: 58, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: 30 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: colors.background, fontSize: 15, fontWeight: '900' },
  setup: { color: colors.warning, fontSize: 12, textAlign: 'center', marginTop: 12 },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 12 },
});
