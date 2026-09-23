import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Svg, { Path } from 'react-native-svg';
import {
  ChartPieIcon,
  EyeIcon,
  EyeSlashIcon,
  HandSwipeRightIcon,
  type Icon,
  QrCodeIcon,
  SignInIcon,
  UsersIcon,
} from 'phosphor-react-native';
import { useToasts } from '../hooks/useToasts';
import {
  forgotPassword,
  login,
  loginWithGoogle,
  requestLoginCode,
  setPassword as setAccountPassword,
  verifyLoginCode,
  type AuthResponse,
} from '../lib/authApi';
import { saveToken } from '../lib/authStorage';
import { useTranslation, type TranslationKey } from '../lib/i18n';
import { HEADER_INSET, colors, radius } from '../lib/theme';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { LanguageSwitch } from './LanguageSwitch';
import { LegalScreen } from './LegalScreen';
import { ToastHost } from './ToastHost';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Slide = {
  icon: Icon;
  titleKey: TranslationKey;
  captionKey: TranslationKey;
};

const SLIDES: Slide[] = [
  { icon: QrCodeIcon, titleKey: 'login.slide1Title', captionKey: 'login.slide1Caption' },
  { icon: UsersIcon, titleKey: 'login.slide2Title', captionKey: 'login.slide2Caption' },
  { icon: ChartPieIcon, titleKey: 'login.slide3Title', captionKey: 'login.slide3Caption' },
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

// 'email' asks for the address and mails a code, 'code' takes that code back.
// 'password' is the fallback for anyone who has set one, and 'setPassword' is
// the skippable offer made right after a code sign-in.
type Step = 'email' | 'code' | 'password' | 'setPassword';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

const EMAIL_DOMAINS = ['gmail.com', 'icloud.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];

function getEmailSuggestions(value: string): string[] {
  const at = value.indexOf('@');
  if (at <= 0) {
    return [];
  }
  const local = value.slice(0, at);
  const domainPart = value.slice(at + 1);
  return EMAIL_DOMAINS.filter((domain) => domain !== domainPart && domain.startsWith(domainPart)).map(
    (domain) => `${local}@${domain}`,
  );
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [pendingAuth, setPendingAuth] = useState<AuthResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [pagerHeight, setPagerHeight] = useState(0);
  const pagerRef = useRef<ScrollView>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [legalPage, setLegalPage] = useState<'privacy' | 'terms' | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const fingerX = useRef(new Animated.Value(0)).current;
  const fingerOpacity = useRef(new Animated.Value(0)).current;
  const fingerScale = useRef(new Animated.Value(0.6)).current;
  const { toasts, showError, showSuccess, dismissToast } = useToasts();

  useEffect(() => {
    GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowSwipeHint(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) {
      return;
    }
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

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

  const handleSendCode = (isResend = false) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showError(t('login.emailRequired'));
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      showError(t('login.invalidEmail'));
      return;
    }
    setIsSubmitting(true);
    requestLoginCode(trimmedEmail)
      .then(() => {
        setIsSubmitting(false);
        setCode('');
        setResendIn(RESEND_COOLDOWN_SECONDS);
        setStep('code');
        if (isResend) {
          showSuccess(t('login.codeResent'));
        }
      })
      .catch((sendError: Error) => {
        setIsSubmitting(false);
        showError(sendError.message);
      });
  };

  // The code is passed in rather than read from state, so the auto-submit on the
  // sixth digit doesn't race the state update that triggered it.
  const handleVerifyCode = (value: string) => {
    if (isSubmitting) {
      return;
    }
    if (value.length !== CODE_LENGTH) {
      showError(t('login.codeRequired'));
      return;
    }
    setIsSubmitting(true);
    verifyLoginCode(email.trim(), value)
      .then((auth) => {
        setIsSubmitting(false);
        if (auth.user.hasPassword) {
          onAuthenticated(auth);
          return;
        }
        // Store the token before the offer: setting a password is an
        // authenticated call, and the user is signed in either way from here.
        return saveToken(auth.accessToken).then(() => {
          setPendingAuth(auth);
          setNewPassword('');
          setConfirmPassword('');
          setStep('setPassword');
        });
      })
      .catch((verifyError: Error) => {
        setIsSubmitting(false);
        setCode('');
        showError(verifyError.message);
      });
  };

  const handleCodeChange = (value: string) => {
    const digits = value.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (digits.length === CODE_LENGTH) {
      handleVerifyCode(digits);
    }
  };

  const handlePasswordLogin = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      showError(t('login.fieldsRequired'));
      return;
    }
    setIsSubmitting(true);
    login(trimmedEmail, password)
      .then((auth) => {
        setIsSubmitting(false);
        onAuthenticated(auth);
      })
      .catch((submitError: Error) => {
        setIsSubmitting(false);
        showError(submitError.message);
      });
  };

  const handleSetPassword = () => {
    if (!pendingAuth) {
      return;
    }
    if (newPassword.length < 8) {
      showError(t('login.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      showError(t('login.passwordsDontMatch'));
      return;
    }
    setIsSubmitting(true);
    setAccountPassword(newPassword)
      .then(() => {
        setIsSubmitting(false);
        onAuthenticated({ ...pendingAuth, user: { ...pendingAuth.user, hasPassword: true } });
      })
      .catch((passwordError: Error) => {
        setIsSubmitting(false);
        showError(passwordError.message);
      });
  };

  const handleSkipPassword = () => {
    if (pendingAuth) {
      onAuthenticated(pendingAuth);
    }
  };

  const handleGoogleSignIn = () => {
    if (!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID) {
      showError(t('login.googleNotConfigured'));
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

  const openForgotPassword = () => {
    setForgotEmail(email);
    setIsForgotPasswordOpen(true);
  };

  const handleSendReset = () => {
    if (!forgotEmail.trim()) {
      showError(t('login.forgotPasswordEmailRequired'));
      return;
    }
    setIsSendingReset(true);
    forgotPassword(forgotEmail.trim())
      .then(() => {
        setIsSendingReset(false);
        setIsForgotPasswordOpen(false);
        showSuccess(t('login.forgotPasswordSuccess'));
      })
      .catch((resetError: Error) => {
        setIsSendingReset(false);
        showError(resetError.message);
      });
  };

  const handleCarouselScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveSlide(index);
  };

  // The auth form is the page right after the last slide. The indicator is moved
  // here rather than waiting for onMomentumScrollEnd, so the slide controls hide
  // immediately even if that callback doesn't fire for a programmatic scroll.
  const goToAuthForm = () => {
    setActiveSlide(SLIDES.length);
    pagerRef.current?.scrollTo({ x: SCREEN_WIDTH * SLIDES.length, animated: true });
  };

  const emailField = (
    <>
      <GlassTextInput
        style={styles.input}
        placeholder={t('login.emailPlaceholder')}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {getEmailSuggestions(email).length > 0 && (
        <View style={styles.emailSuggestions}>
          {getEmailSuggestions(email).map((suggestion) => (
            <Pressable key={suggestion} style={styles.emailSuggestionChip} onPress={() => setEmail(suggestion)}>
              <Text style={styles.emailSuggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );

  const googleButton = (
    <Pressable
      onPress={handleGoogleSignIn}
      disabled={isSubmitting || isGoogleSubmitting}
      style={({ pressed }) => [
        styles.googleButton,
        (pressed || isSubmitting || isGoogleSubmitting) && styles.googleButtonPressed,
      ]}
    >
      {isGoogleSubmitting ? <ActivityIndicator size="small" color={colors.primary} /> : <GoogleLogo size={20} />}
      <Text style={styles.googleLabelText} numberOfLines={1}>
        {isGoogleSubmitting ? t('login.signingInWithGoogle') : t('login.continueWithGoogle')}
      </Text>
    </Pressable>
  );

  const disclaimer = (
    <Text style={styles.disclaimerText}>
      {t('login.disclaimerAgree')}{' '}
      <Text style={styles.disclaimerLink} onPress={() => setLegalPage('terms')}>
        {t('login.termsLink')}
      </Text>{' '}
      {t('login.and')}{' '}
      <Text style={styles.disclaimerLink} onPress={() => setLegalPage('privacy')}>
        {t('login.privacyLink')}
      </Text>
      .
    </Text>
  );

  if (legalPage) {
    return <LegalScreen type={legalPage} onBack={() => setLegalPage(null)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topBarSide} />
        <Text style={styles.brand}>Llogarite</Text>
        <View style={styles.topBarSide}>
          <LanguageSwitch />
        </View>
      </View>

      <View style={styles.pagerContainer} onLayout={(event) => setPagerHeight(event.nativeEvent.layout.height)}>
        {pagerHeight > 0 && (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleCarouselScrollEnd}
            style={{ height: pagerHeight }}
          >
            {SLIDES.map((slide) => (
              <View key={slide.titleKey} style={[styles.slide, { width: SCREEN_WIDTH, height: pagerHeight }]}>
                <View style={styles.photoPlaceholder}>
                  <slide.icon size={48} color={colors.white} />
                </View>
                <Text style={styles.slideTitle}>{t(slide.titleKey)}</Text>
                <Text style={styles.slideCaption}>{t(slide.captionKey)}</Text>
                {showSwipeHint && (
                  <View style={styles.swipeHintWrap}>
                    <Text style={styles.swipeHintLabel}>{t('login.swipeHint')}</Text>
                    <View style={styles.swipeHintTrack}>
                      <Animated.View
                        style={[
                          styles.fingerIconWrap,
                          { opacity: fingerOpacity, transform: [{ translateX: fingerX }, { scale: fingerScale }] },
                        ]}
                      >
                        <HandSwipeRightIcon size={30} color={colors.white} />
                      </Animated.View>
                    </View>
                  </View>
                )}
              </View>
            ))}

            <View style={[styles.authPage, { width: SCREEN_WIDTH, height: pagerHeight }]}>
              <KeyboardAvoidingView behavior="padding" style={styles.authPageContent}>
                {step === 'email' && (
                  <>
                    <Text style={styles.formTitle}>{t('login.welcomeBack')}</Text>
                    {emailField}
                    <GlassButton
                      label={isSubmitting ? t('login.sendingCode') : t('login.sendCode')}
                      variant="accent"
                      style={styles.submitButton}
                      onPress={() => handleSendCode()}
                      disabled={isSubmitting || isGoogleSubmitting}
                    />
                    {googleButton}
                    <Pressable onPress={() => setStep('password')}>
                      <Text style={styles.switchMethodText}>{t('login.usePassword')}</Text>
                    </Pressable>
                    {disclaimer}
                  </>
                )}

                {step === 'code' && (
                  <>
                    <Text style={styles.formTitle}>{t('login.codeTitle')}</Text>
                    <Text style={styles.stepSubtitle}>{t('login.codeSubtitle', { email: email.trim() })}</Text>
                    <GlassTextInput
                      style={[styles.input, styles.codeInput]}
                      placeholder={t('login.codePlaceholder')}
                      keyboardType="number-pad"
                      autoFocus
                      maxLength={CODE_LENGTH}
                      value={code}
                      onChangeText={handleCodeChange}
                    />
                    <GlassButton
                      label={isSubmitting ? t('login.verifyingCode') : t('login.verifyCode')}
                      variant="accent"
                      style={styles.submitButton}
                      onPress={() => handleVerifyCode(code)}
                      disabled={isSubmitting}
                    />
                    <Pressable onPress={() => handleSendCode(true)} disabled={resendIn > 0 || isSubmitting}>
                      <Text style={[styles.switchMethodText, resendIn > 0 && styles.switchMethodTextMuted]}>
                        {resendIn > 0 ? t('login.resendCodeIn', { seconds: resendIn }) : t('login.resendCode')}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => setStep('email')}>
                      <Text style={styles.switchMethodText}>{t('login.changeEmail')}</Text>
                    </Pressable>
                  </>
                )}

                {step === 'password' && (
                  <>
                    <Text style={styles.formTitle}>{t('login.welcomeBack')}</Text>
                    {emailField}
                    <GlassView style={styles.passwordContainer}>
                      <GlassTextInput
                        style={styles.passwordInput}
                        placeholder={t('login.passwordPlaceholder')}
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={setPassword}
                      />
                      <Pressable style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)}>
                        {showPassword ? (
                          <EyeSlashIcon size={22} color={colors.textMuted} />
                        ) : (
                          <EyeIcon size={22} color={colors.textMuted} />
                        )}
                      </Pressable>
                    </GlassView>
                    <Pressable onPress={openForgotPassword} style={styles.forgotPasswordLink}>
                      <Text style={styles.forgotPasswordText}>{t('login.forgotPassword')}</Text>
                    </Pressable>
                    <GlassButton
                      label={isSubmitting ? t('login.signingIn') : t('login.signIn')}
                      variant="accent"
                      style={styles.submitButton}
                      onPress={handlePasswordLogin}
                      disabled={isSubmitting || isGoogleSubmitting}
                    />
                    {googleButton}
                    <Pressable onPress={() => setStep('email')}>
                      <Text style={styles.switchMethodText}>{t('login.useCode')}</Text>
                    </Pressable>
                    {disclaimer}
                  </>
                )}

                {step === 'setPassword' && (
                  <>
                    <Text style={styles.formTitle}>{t('login.setPasswordTitle')}</Text>
                    <Text style={styles.stepSubtitle}>{t('login.setPasswordSubtitle')}</Text>
                    <GlassView style={styles.passwordContainer}>
                      <GlassTextInput
                        style={styles.passwordInput}
                        placeholder={t('login.newPasswordPlaceholder')}
                        secureTextEntry={!showNewPassword}
                        value={newPassword}
                        onChangeText={setNewPassword}
                      />
                      <Pressable style={styles.eyeButton} onPress={() => setShowNewPassword((prev) => !prev)}>
                        {showNewPassword ? (
                          <EyeSlashIcon size={22} color={colors.textMuted} />
                        ) : (
                          <EyeIcon size={22} color={colors.textMuted} />
                        )}
                      </Pressable>
                    </GlassView>
                    <GlassTextInput
                      style={styles.input}
                      placeholder={t('login.confirmPasswordPlaceholder')}
                      secureTextEntry={!showNewPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <GlassButton
                      label={isSubmitting ? t('login.savingPassword') : t('login.savePassword')}
                      variant="accent"
                      style={styles.submitButton}
                      onPress={handleSetPassword}
                      disabled={isSubmitting}
                    />
                    <Pressable onPress={handleSkipPassword} disabled={isSubmitting}>
                      <Text style={styles.switchMethodText}>{t('login.skipForNow')}</Text>
                    </Pressable>
                  </>
                )}
              </KeyboardAvoidingView>
            </View>
          </ScrollView>
        )}

        {activeSlide < SLIDES.length && (
          <View style={styles.bottomBar}>
            <View style={styles.dotsRow}>
              {SLIDES.map((slide, index) => (
                <View key={slide.titleKey} style={[styles.dot, index === activeSlide && styles.dotActive]} />
              ))}
            </View>
            <Pressable style={styles.signInButton} onPress={goToAuthForm} accessibilityRole="button">
              <SignInIcon size={16} color={colors.primary} weight="bold" />
              <Text style={styles.signInButtonLabel}>{t('login.signIn')}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Modal
        visible={isForgotPasswordOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsForgotPasswordOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsForgotPasswordOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('login.forgotPasswordTitle')}</Text>
            <Text style={styles.modalMessage}>{t('login.forgotPasswordMessage')}</Text>
            <GlassTextInput
              style={styles.input}
              placeholder={t('login.emailPlaceholder')}
              autoCapitalize="none"
              keyboardType="email-address"
              value={forgotEmail}
              onChangeText={setForgotEmail}
            />
            {getEmailSuggestions(forgotEmail).length > 0 && (
              <View style={styles.emailSuggestions}>
                {getEmailSuggestions(forgotEmail).map((suggestion) => (
                  <Pressable
                    key={suggestion}
                    style={styles.emailSuggestionChip}
                    onPress={() => setForgotEmail(suggestion)}
                  >
                    <Text style={styles.emailSuggestionText}>{suggestion}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <GlassButton
              label={isSendingReset ? t('login.forgotPasswordSending') : t('login.forgotPasswordSend')}
              variant="accent"
              onPress={handleSendReset}
              disabled={isSendingReset}
            />
          </Pressable>
        </Pressable>
      </Modal>

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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 12,
  },
  topBarSide: {
    width: 64,
    alignItems: 'flex-end',
  },
  brand: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: colors.white,
    textAlign: 'center',
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
    bottom: 108,
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
  bottomBar: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 14,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  signInButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
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
  },
  authPageContent: {
    flex: 1,
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
  stepSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginTop: -12,
    marginBottom: 20,
  },
  input: {
    marginBottom: 12,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 8,
  },
  emailSuggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: -6,
    marginBottom: 12,
  },
  emailSuggestionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
  emailSuggestionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
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
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  submitButton: {
    marginTop: 8,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  googleButtonPressed: {
    opacity: 0.7,
  },
  googleLabelText: {
    fontWeight: '600',
    fontSize: 16,
    color: colors.textDark,
  },
  switchMethodText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 16,
  },
  switchMethodTextMuted: {
    color: colors.textMuted,
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    width: '85%',
    backgroundColor: colors.white,
    borderRadius: radius.sheet,
    padding: 24,
    boxShadow: '0px 6px 16px rgba(0,0,0,0.2)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textDark,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
});
