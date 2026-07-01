import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type ConnectionStatus = 'checking' | 'connected' | 'failed';

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>('checking');

  useEffect(() => {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) {
      setStatus('failed');
      return;
    }
    fetch(`${apiUrl}/health`)
      .then((res) => setStatus(res.ok ? 'connected' : 'failed'))
      .catch(() => setStatus('failed'));
  }, []);

  return (
    <View style={styles.container}>
      <Text>Llogarite</Text>
      <Text>Backend status: {status}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
