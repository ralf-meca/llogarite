import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { login, loginWithGoogle, register, type AuthResponse } from '../lib/authApi';

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </Svg>
  );
}

type LoginScreenProps = {
  onAuthenticated: (auth: AuthResponse) => void;
};

type Mode = 'login' | 'register';

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
  }, []);

  const handleSubmit = () => {
    setError(null);
    setIsSubmitting(true);
    const submit = mode === 'login' ? login : register;
    submit(email, password)
      .then((auth) => {
        setIsSubmitting(false);
        onAuthenticated(auth);
      })
      .catch((submitError: Error) => {
        setIsSubmitting(false);
        setError(submitError.message);
      });
  };

  const handleGoogleSignIn = () => {
    if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
      setError('Kyçja me Google nuk është konfiguruar.');
      return;
    }
    setError(null);
    setIsGoogleSubmitting(true);
    GoogleSignin.signOut()
      .catch(() => null)
      .then(() => GoogleSignin.hasPlayServices())
      .then(() => GoogleSignin.signIn())
      .then((response) => {
        if (!isSuccessResponse(response) || !response.data.idToken) {
          setIsGoogleSubmitting(false);
          return;
        }
        return loginWithGoogle(response.data.idToken).then((auth) => {
          setIsGoogleSubmitting(false);
          onAuthenticated(auth);
        });
      })
      .catch((googleError: Error) => {
        setIsGoogleSubmitting(false);
        setError(googleError.message);
      });
  };

  const toggleMode = () => {
    setError(null);
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Llogarite</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <View style={styles.passwordContainer}>
        <TextInput
          style={styles.passwordInput}
          placeholder="Fjalëkalimi"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable
          style={styles.eyeButton}
          onPress={() => setShowPassword((prev) => !prev)}
        >
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#6b7280" />
        </Pressable>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={isSubmitting || isGoogleSubmitting}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting
            ? mode === 'login'
              ? 'Duke u kyçur...'
              : 'Duke u regjistruar...'
            : mode === 'login'
              ? 'Kyçu'
              : 'Regjistrohu'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.googleButton}
        onPress={handleGoogleSignIn}
        disabled={isSubmitting || isGoogleSubmitting}
      >
        <GoogleLogo size={20} />
        <Text style={styles.googleButtonText}>Vazhdo me Google</Text>
      </Pressable>
      {isGoogleSubmitting && <Text style={styles.googleLoadingText}>Duke u kyçur me Google...</Text>}

      <Pressable onPress={toggleMode}>
        <Text style={styles.toggleText}>
          {mode === 'login' ? 'Nuk ke llogari? Regjistrohu' : 'Ke llogari? Kyçu'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 12,
  },
  errorText: {
    color: '#dc2626',
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 48,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  googleButtonText: {
    color: '#1f2937',
    fontWeight: '600',
    fontSize: 16,
  },
  googleLoadingText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 8,
  },
  toggleText: {
    textAlign: 'center',
    color: '#2563eb',
    marginTop: 16,
  },
});
