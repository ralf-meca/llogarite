import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import {
  CameraIcon,
  CrownSimpleIcon,
  EyeIcon,
  EyeSlashIcon,
  ImagesIcon,
  KeyIcon,
  QuestionIcon,
  SignOutIcon,
  TranslateIcon,
  TrashIcon,
} from 'phosphor-react-native';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToasts } from '../hooks/useToasts';
import {
  changePassword,
  deleteAccount,
  removeAvatar,
  setPassword,
  updateAvatar,
  type AuthUser,
} from '../lib/authApi';
import { useTranslation } from '../lib/i18n';
import { colors, radius } from '../lib/theme';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { LanguageSwitch } from './LanguageSwitch';
import { ToastHost } from './ToastHost';
import { UserAvatar } from './UserAvatar';

// Read from the app config rather than written here, so it cannot drift from
// what was actually shipped.
const APP_VERSION = Constants.expoConfig?.version ?? '';

type UserMenuModalProps = {
  visible: boolean;
  user: AuthUser | null;
  onClose: () => void;
  onLogout: () => void;
  onRestartTour: () => void;
  onOpenPlans: () => void;
  onUserUpdated: (user: AuthUser) => void;
};

type MenuView = 'menu' | 'changePassword' | 'changePasswordSuccess' | 'deleteAccountConfirm';

function splitName(name: string | null | undefined): { first: string; last: string | null } {
  const trimmed = name?.trim();
  if (!trimmed) {
    return { first: '', last: null };
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { first: parts[0] ?? '', last: null };
  }
  return { first: parts[0], last: parts[parts.length - 1] };
}

type PasswordFieldProps = {
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
};

// A password input with an eye to show what was typed, as on the login
// screen. Each field keeps its own, so revealing one does not reveal the rest.
function PasswordField({ placeholder, value, onChangeText }: PasswordFieldProps) {
  const [isShown, setIsShown] = useState(false);
  const ToggleIcon = isShown ? EyeSlashIcon : EyeIcon;
  return (
    <View style={styles.passwordField}>
      <GlassTextInput
        style={styles.passwordInput}
        placeholder={placeholder}
        secureTextEntry={!isShown}
        autoCapitalize="none"
        autoCorrect={false}
        value={value}
        onChangeText={onChangeText}
      />
      <Pressable style={styles.eyeButton} onPress={() => setIsShown((shown) => !shown)} hitSlop={6}>
        <ToggleIcon size={22} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

export function UserMenuModal({
  visible,
  user,
  onClose,
  onLogout,
  onRestartTour,
  onOpenPlans,
  onUserUpdated,
}: UserMenuModalProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<MenuView>('menu');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
  const { toasts, showError, dismissToast } = useToasts();
  const { first: firstName, last: lastName } = splitName(user?.name);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // A drawer from the left edge, where the avatar that opens it sits. Wide
  // enough for the rows to breathe, never so wide the screen behind is gone.
  const drawerWidth = Math.min(windowWidth * 0.84, 380);
  // 0 is shut, 1 is open; the panel's slide and the scrim's fade both follow it.
  const progress = useRef(new Animated.Value(0)).current;

  // Slides shut before telling the parent, so closing is seen rather than cut.
  const close = () => {
    Animated.timing(progress, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => onClose());
  };

  const applyAvatarUpdate = (avatarUrl: string | null) => {
    if (user) {
      onUserUpdated({ ...user, avatarUrl });
    }
  };

  const uploadPickedAsset = (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) {
      return;
    }
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${asset.base64}`;
    setIsUploadingAvatar(true);
    updateAvatar(dataUri)
      .then((avatarUrl) => {
        setIsUploadingAvatar(false);
        applyAvatarUpdate(avatarUrl);
      })
      .catch((error: Error) => {
        setIsUploadingAvatar(false);
        showError(error.message);
      });
  };

  const pickAvatarFromLibrary = () => {
    ImagePicker.requestMediaLibraryPermissionsAsync()
      .then((permission) => {
        if (!permission.granted) {
          showError(t('userMenu.galleryPermissionDenied'));
          return;
        }
        return ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
          base64: true,
        }).then((result) => {
          if (result.canceled || !result.assets[0]) {
            return;
          }
          uploadPickedAsset(result.assets[0]);
        });
      })
      .catch((error: Error) => showError(error.message));
  };

  const takeAvatarPhoto = () => {
    ImagePicker.requestCameraPermissionsAsync()
      .then((permission) => {
        if (!permission.granted) {
          showError(t('userMenu.cameraPermissionDenied'));
          return;
        }
        return ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
          base64: true,
        }).then((result) => {
          if (result.canceled || !result.assets[0]) {
            return;
          }
          uploadPickedAsset(result.assets[0]);
        });
      })
      .catch((error: Error) => showError(error.message));
  };

  const handleRemovePhoto = () => {
    setIsUploadingAvatar(true);
    removeAvatar()
      .then(() => {
        setIsUploadingAvatar(false);
        applyAvatarUpdate(null);
      })
      .catch((error: Error) => {
        setIsUploadingAvatar(false);
        showError(error.message);
      });
  };

  const handleChangePhoto = () => {
    setIsPhotoMenuOpen(true);
  };

  const choosePhotoOption = (action: () => void) => {
    setIsPhotoMenuOpen(false);
    action();
  };

  // Runs from the Modal's onShow, once its views exist: an animation started
  // in the same pass that mounts them never plays on Android.
  const handleShow = () => {
    setView('menu');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  };

  // An account opened with Google or an emailed code has no password yet. It
  // can still be given one here; there is just no current one to ask for.
  const hasPassword = user?.hasPassword ?? true;

  const handleSubmitPasswordChange = () => {
    if (newPassword.length < 8) {
      showError(t('login.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      showError(t('userMenu.passwordsDontMatch'));
      return;
    }
    setIsSubmitting(true);
    (hasPassword ? changePassword(currentPassword, newPassword) : setPassword(newPassword))
      .then(() => {
        setIsSubmitting(false);
        if (user && !hasPassword) {
          onUserUpdated({ ...user, hasPassword: true });
        }
        setView('changePasswordSuccess');
      })
      .catch((submitError: Error) => {
        setIsSubmitting(false);
        showError(submitError.message);
      });
  };

  const handleDeleteAccount = () => {
    setIsDeleting(true);
    deleteAccount()
      .then(() => {
        setIsDeleting(false);
        onClose();
        onLogout();
      })
      .catch((deleteError: Error) => {
        setIsDeleting(false);
        showError(deleteError.message);
      });
  };

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onShow={handleShow}
      onRequestClose={close}
    >
      <View style={styles.drawerRoot}>
        <Animated.View style={[styles.scrim, { opacity: progress }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={t('common.close')} />
        <Animated.View
          style={[
            styles.drawer,
            {
              width: drawerWidth,
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 16,
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] }) },
              ],
            },
          ]}
        >
            {view === 'menu' && (
              <>
                <View style={styles.profileBlock}>
                  <View style={styles.profileRow}>
                    <View style={styles.profileInfo}>
                      <Pressable style={styles.avatarWrapper} onPress={handleChangePhoto} disabled={isUploadingAvatar}>
                        <UserAvatar user={user} size={56} />
                        <View style={styles.avatarBadge}>
                          {isUploadingAvatar ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <CameraIcon size={12} weight="fill" color="#ffffff" />
                          )}
                        </View>
                      </Pressable>
                      <View style={styles.profileNameBlock}>
                        <Text style={styles.profileName} numberOfLines={1}>
                          {user?.name ? firstName : (user?.email ?? '')}
                        </Text>
                        {lastName && (
                          <Text style={styles.profileLastName} numberOfLines={1}>
                            {lastName}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {user?.name && (
                    <Text style={styles.profileEmail} numberOfLines={1}>
                      {user.email}
                    </Text>
                  )}
                </View>

                <Pressable style={styles.menuItem} onPress={onOpenPlans}>
                  <CrownSimpleIcon size={20} color="#1f2937" />
                  <Text style={styles.menuItemText}>{t('userMenu.subscription')}</Text>
                  <Text style={styles.menuItemValue}>
                    {user?.isPremium ? t('plans.premiumPlan') : t('plans.freePlan')}
                  </Text>
                </Pressable>
                <Pressable style={styles.menuItem} onPress={() => setView('changePassword')}>
                  <KeyIcon size={20} color="#1f2937" />
                  <Text style={styles.menuItemText}>
                    {t(hasPassword ? 'userMenu.changePassword' : 'login.setPasswordTitle')}
                  </Text>
                </Pressable>
                <View style={styles.menuItem}>
                  <TranslateIcon size={20} color="#1f2937" />
                  <Text style={styles.menuItemText}>{t('userMenu.language')}</Text>
                  <View style={styles.languageSlot}>
                    <LanguageSwitch />
                  </View>
                </View>
                <Pressable style={styles.menuItem} onPress={onRestartTour}>
                  <QuestionIcon size={20} color="#1f2937" />
                  <Text style={styles.menuItemText}>{t('userMenu.restartTour')}</Text>
                </Pressable>

                <Pressable style={styles.menuItem} onPress={() => setView('deleteAccountConfirm')}>
                  <TrashIcon size={20} color="#dc2626" />
                  <Text style={[styles.menuItemText, styles.dangerText]}>{t('userMenu.deleteAccount')}</Text>
                </Pressable>

                {/* Signing out sits apart at the foot of the drawer, under a
                    divider, away from the rows above. */}
                <View style={styles.footer}>
                  <Pressable
                    style={styles.menuItem}
                    onPress={() => {
                      onClose();
                      onLogout();
                    }}
                  >
                    <SignOutIcon size={20} color="#dc2626" />
                    <Text style={[styles.menuItemText, styles.dangerText]}>{t('userMenu.logout')}</Text>
                  </Pressable>
                  {APP_VERSION !== '' && <Text style={styles.version}>v{APP_VERSION}</Text>}
                </View>
              </>
            )}

            {view === 'deleteAccountConfirm' && (
              <>
                <Text style={styles.title}>{t('userMenu.deleteAccountTitle')}</Text>
                <Text style={styles.deleteWarning}>{t('userMenu.deleteAccountWarning')}</Text>
                <GlassButton
                  label={isDeleting ? t('userMenu.deleting') : t('userMenu.deleteAccountConfirm')}
                  variant="danger"
                  style={styles.deleteButton}
                  onPress={handleDeleteAccount}
                  disabled={isDeleting}
                />
                <Pressable onPress={() => setView('menu')}>
                  <Text style={styles.backText}>{t('common.cancel')}</Text>
                </Pressable>
              </>
            )}

            {view === 'changePassword' && (
              <>
                <Text style={styles.title}>
                  {t(hasPassword ? 'userMenu.changePasswordTitle' : 'login.setPasswordTitle')}
                </Text>
                {hasPassword && (
                  <PasswordField
                    placeholder={t('userMenu.currentPasswordPlaceholder')}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                  />
                )}
                <PasswordField
                  placeholder={t('userMenu.newPasswordPlaceholder')}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <PasswordField
                  placeholder={t('userMenu.confirmNewPasswordPlaceholder')}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <GlassButton
                  label={isSubmitting ? t('common.saving') : t('common.save')}
                  variant="accent"
                  onPress={handleSubmitPasswordChange}
                  disabled={isSubmitting}
                />
                <Pressable onPress={() => setView('menu')}>
                  <Text style={styles.backText}>{t('common.cancel')}</Text>
                </Pressable>
              </>
            )}

            {view === 'changePasswordSuccess' && (
              <>
                <Text style={styles.title}>{t('userMenu.passwordChanged')}</Text>
                <GlassButton label={t('common.close')} variant="accent" onPress={close} />
              </>
            )}
        </Animated.View>
      </View>

      <Modal
        visible={isPhotoMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPhotoMenuOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsPhotoMenuOpen(false)}>
          <Pressable style={styles.photoMenuWrapper} onPress={(event) => event.stopPropagation()}>
            <GlassView style={styles.photoMenu}>
              <Text style={styles.title}>{t('userMenu.changePhotoTitle')}</Text>
              <Pressable style={styles.menuItem} onPress={() => choosePhotoOption(takeAvatarPhoto)}>
                <CameraIcon size={20} color="#1f2937" />
                <Text style={styles.menuItemText}>{t('userMenu.takePhoto')}</Text>
              </Pressable>
              <Pressable style={styles.menuItem} onPress={() => choosePhotoOption(pickAvatarFromLibrary)}>
                <ImagesIcon size={20} color="#1f2937" />
                <Text style={styles.menuItemText}>{t('userMenu.choosePhoto')}</Text>
              </Pressable>
              {user?.avatarUrl && (
                <Pressable style={styles.menuItem} onPress={() => choosePhotoOption(handleRemovePhoto)}>
                  <TrashIcon size={20} color="#dc2626" />
                  <Text style={[styles.menuItemText, styles.dangerText]}>{t('userMenu.removePhoto')}</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setIsPhotoMenuOpen(false)}>
                <Text style={styles.backText}>{t('common.cancel')}</Text>
              </Pressable>
            </GlassView>
          </Pressable>
        </Pressable>
      </Modal>

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoMenuWrapper: {
    width: '80%',
  },
  photoMenu: {
    padding: 24,
  },
  drawerRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
  },
  // Square against the edge it comes from, rounded on the side that faces the
  // rest of the screen.
  drawer: {
    height: '100%',
    paddingHorizontal: 22,
    backgroundColor: colors.white,
    borderTopRightRadius: radius.sheet,
    borderBottomRightRadius: radius.sheet,
    boxShadow: '4px 0px 16px rgba(0,0,0,0.18)',
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1f2937',
  },
  profileBlock: {
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileNameBlock: {
    flex: 1,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  profileLastName: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  profileEmail: {
    marginTop: 10,
    fontSize: 13,
    color: '#6b7280',
  },
  languageSlot: {
    marginLeft: 'auto',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 16,
    color: '#1f2937',
  },
  menuItemValue: {
    marginLeft: 'auto',
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  // Quiet on purpose: it is here to be found when someone is reporting a
  // problem, not to be read every time this opens.
  version: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 11,
    color: colors.textMuted,
  },
  dangerText: {
    color: '#dc2626',
    fontWeight: '600',
  },
  // The field's own frame, so the input and the eye read as one box.
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card - 4,
    backgroundColor: colors.primaryTint,
  },
  passwordInput: {
    flex: 1,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  eyeButton: {
    paddingHorizontal: 12,
  },
  deleteWarning: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  deleteButton: {
    marginBottom: 4,
  },
  backText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
  },
});
