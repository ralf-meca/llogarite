import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useToasts } from '../hooks/useToasts';
import { login, loginWithGoogle, register, type AuthResponse } from '../lib/authApi';
import { HEADER_INSET, colors, radius } from '../lib/theme';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { LegalScreen } from './LegalScreen';
import { ToastHost } from './ToastHost';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  caption: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'qr-code-outline',
    title: 'Skano faturat në sekonda',
    caption: 'Skano kodin QR ose bëj një foto të faturës — pjesën tjetër e bëjmë ne.',
  },
  {
    icon: 'people-outline',
    title: 'Ndaj shpenzimet me shokë',
    caption: 'Lidhu me shokët e tu dhe ndaj faturat e përbashkëta pa telashe.',
  },
  {
    icon: 'pie-chart-outline',
    title: 'Ndiq buxhetin tënd',
    caption: 'Shiko ku shkojnë paratë e tua me grafikë të thjeshtë dhe të qartë.',
  },
];

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
  const [activeSlide, setActiveSlide] = useState(0);
  const [pagerHeight, setPagerHeight] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [legalPage, setLegalPage] = useState<'privacy' | 'terms' | null>(null);
  const fingerX = useRef(new Animated.Value(0)).current;
  const fingerOpacity = useRef(new Animated.Value(0)).current;
  const fingerScale = useRef(new Animated.Value(0.6)).current;
  const googleSpin = useRef(new Animated.Value(0)).current;
  const { toasts, showError, dismissToast } = useToasts();

  useEffect(() => {
    GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
  }, []);

  useEffect(() => {
    if (!isGoogleSubmitting) {
      googleSpin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(googleSpin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [isGoogleSubmitting, googleSpin]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSwipeHint(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showSwipeHint) {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(fingerOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(fingerScale, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]),
        Animated.delay(150),
        Animated.timing(fingerX, { toValue: -42, duration: 650, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(fingerOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
          Animated.timing(fingerScale, { toValue: 0.6, duration: 150, useNativeDriver: true }),
        ]),
        Animated.timing(fingerX, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(700),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showSwipeHint, fingerX, fingerOpacity, fingerScale]);

  const handleSubmit = () => {
    setIsSubmitting(true);
    const submit = mode === 'login' ? login : register;
    submit(email, password)
      .then((auth) => {
        setIsSubmitting(false);
        onAuthenticated(auth);
      })
      .catch((submitError: Error) => {
        setIsSubmitting(false);
        showError(submitError.message);
      });
  };

  const handleGoogleSignIn = () => {
    if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
      showError('Kyçja me Google nuk është konfiguruar.');
      return;
    }
    setIsGoogleSubmitting(true);
    const clearPreviousSession = GoogleSignin.hasPreviousSignIn() ? GoogleSignin.signOut().catch(() => null) : null;
    Promise.resolve(clearPreviousSession)
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
        showError(googleError.message);
      });
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
  };

  const handleCarouselScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveSlide(index);
  };

  if (legalPage) {
    return <LegalScreen type={legalPage} onBack={() => setLegalPage(null)} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>Llogarite</Text>

      <View style={styles.pagerContainer} onLayout={(event) => setPagerHeight(event.nativeEvent.layout.height)}>
        {pagerHeight > 0 && (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleCarouselScrollEnd}
            style={{ height: pagerHeight }}
          >
            {SLIDES.map((slide) => (
              <View key={slide.title} style={[styles.slide, { width: SCREEN_WIDTH, height: pagerHeight }]}>
                <View style={styles.photoPlaceholder}>
                  <Ionicons name={slide.icon} size={48} color={colors.white} />
                </View>
                <Text style={styles.slideTitle}>{slide.title}</Text>
                <Text style={styles.slideCaption}>{slide.caption}</Text>
                {showSwipeHint && (
                  <View style={styles.swipeHintWrap}>
                    <Text style={styles.swipeHintLabel}>Rrëshqit për të vazhduar</Text>
                    <View style={styles.swipeHintTrack}>
                      <Animated.View
                        style={[
                          styles.fingerIconWrap,
                          { opacity: fingerOpacity, transform: [{ translateX: fingerX }, { scale: fingerScale }] },
                        ]}
                      >
                        <MaterialCommunityIcons name="gesture-swipe-horizontal" size={30} color={colors.white} />
                      </Animated.View>
                    </View>
                  </View>
                )}
              </View>
            ))}

            <View style={[styles.authPage, { width: SCREEN_WIDTH, height: pagerHeight }]}>
              <Text style={styles.formTitle}>{mode === 'login' ? 'Mirë se erdhe përsëri' : 'Krijo një llogari'}</Text>

              <GlassTextInput
                style={styles.input}
                placeholder="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <GlassView style={styles.passwordContainer}>
                <GlassTextInput
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
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color={colors.textMuted} />
                </Pressable>
              </GlassView>

              <GlassButton
                label={
                  isSubmitting
                    ? mode === 'login'
                      ? 'Duke u kyçur...'
                      : 'Duke u regjistruar...'
                    : mode === 'login'
                      ? 'Kyçu'
                      : 'Regjistrohu'
                }
                variant="accent"
                style={styles.submitButton}
                onPress={handleSubmit}
                disabled={isSubmitting || isGoogleSubmitting}
              />

              <GlassButton
                label={isGoogleSubmitting ? 'Duke u kyçur me Google...' : 'Vazhdo me Google'}
                icon={
                  <Animated.View
                    style={{
                      transform: [
                        {
                          rotate: googleSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
                        },
                      ],
                    }}
                  >
                    <GoogleLogo size={20} />
                  </Animated.View>
                }
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={isSubmitting || isGoogleSubmitting}
              />

              <Pressable onPress={toggleMode}>
                <Text style={styles.toggleText}>
                  {mode === 'login' ? 'Nuk ke llogari? Regjistrohu' : 'Ke llogari? Kyçu'}
                </Text>
              </Pressable>

              <Text style={styles.disclaimerText}>
                Duke u kyçur ose regjistruar, ti pranon{' '}
                <Text style={styles.disclaimerLink} onPress={() => setLegalPage('terms')}>
                  Kushtet e Përdorimit
                </Text>{' '}
                dhe{' '}
                <Text style={styles.disclaimerLink} onPress={() => setLegalPage('privacy')}>
                  Politikën e Privatësisë
                </Text>{' '}
                tona.
              </Text>
            </View>
          </ScrollView>
        )}

        {activeSlide < SLIDES.length && (
          <View style={styles.dotsRow}>
            {SLIDES.map((slide, index) => (
              <View key={slide.title} style={[styles.dot, index === activeSlide && styles.dotActive]} />
            ))}
            <Ionicons name="log-in-outline" size={14} color={colors.primarySubtle} />
          </View>
        )}
      </View>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: -HEADER_INSET,
    paddingTop: HEADER_INSET,
    backgroundColor: colors.primary,
  },
  brand: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.white,
    textAlign: 'center',
    paddingTop: 32,
    paddingBottom: 12,
  },
  pagerContainer: {
    flex: 1,
  },
  slide: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  photoPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  slideTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  slideCaption: {
    fontSize: 13,
    color: colors.primarySubtle,
    textAlign: 'center',
    lineHeight: 18,
  },
  swipeHintWrap: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
    marginBottom: 5,
  },
  swipeHintLabel: {
    fontSize: 12,
    color: colors.primarySubtle,
  },
  swipeHintTrack: {
    width: 70,
    height: 28,
    justifyContent: 'center',
  },
  fingerIconWrap: {
    position: 'absolute',
    right: 0,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 28,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primarySubtle,
  },
  dotActive: {
    width: 18,
    backgroundColor: colors.white,
  },
  authPage: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 24,
    paddingTop: 28,
    justifyContent: 'center',
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textDark,
    marginBottom: 20,
  },
  input: {
    marginBottom: 12,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingRight: 4,
  },
  passwordInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  eyeButton: {
    paddingHorizontal: 12,
  },
  submitButton: {
    marginTop: 8,
  },
  googleButton: {
    marginTop: 12,
  },
  toggleText: {
    textAlign: 'center',
    color: colors.primary,
    marginTop: 16,
  },
  disclaimerText: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
  disclaimerLink: {
    color: colors.primary,
    fontWeight: '600',
  },
});
