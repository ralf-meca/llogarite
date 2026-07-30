import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import { changePassword, deleteAccount, removeAvatar, updateAvatar, type AuthUser } from '../lib/authApi';
import { useTranslation } from '../lib/i18n';
import { colors, radius } from '../lib/theme';
import { GlassButton } from './GlassButton';
import { GlassTextInput } from './GlassTextInput';
import { GlassView } from './GlassView';
import { ToastHost } from './ToastHost';
import { UserAvatar } from './UserAvatar';

type UserMenuModalProps = {
  visible: boolean;
  user: AuthUser | null;
  onClose: () => void;
  onLogout: () => void;
  onRestartTour: () => void;
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

export function UserMenuModal({ visible, user, onClose, onLogout, onRestartTour, onUserUpdated }: UserMenuModalProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<MenuView>('menu');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const { toasts, showError, dismissToast } = useToasts();
  const { first: firstName, last: lastName } = splitName(user?.name);

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
    const options: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> = [
      { text: t('userMenu.takePhoto'), onPress: takeAvatarPhoto },
      { text: t('userMenu.choosePhoto'), onPress: pickAvatarFromLibrary },
    ];
    if (user?.avatarUrl) {
      options.push({ text: t('userMenu.removePhoto'), style: 'destructive', onPress: handleRemovePhoto });
    }
    options.push({ text: t('common.cancel'), style: 'cancel' });
    Alert.alert(t('userMenu.changePhotoTitle'), undefined, options);
  };

  const handleShow = () => {
    setView('menu');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmitPasswordChange = () => {
    if (newPassword !== confirmPassword) {
      showError(t('userMenu.passwordsDontMatch'));
      return;
    }
    setIsSubmitting(true);
    changePassword(currentPassword, newPassword)
      .then(() => {
        setIsSubmitting(false);
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
    <Modal visible={visible} transparent animationType="fade" onShow={handleShow} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <GlassView tint="dark" style={styles.backdropBlur} />
        <Pressable style={styles.modalWrapper} onPress={(event) => event.stopPropagation()}>
          <GlassView style={styles.card}>
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
                            <Ionicons name="camera" size={12} color="#ffffff" />
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

                    <Pressable
                      style={styles.logoutTrigger}
                      onPress={() => {
                        onClose();
                        onLogout();
                      }}
                    >
                      <Ionicons name="log-out-outline" size={20} color={colors.white} />
                      <Text style={styles.logoutTriggerText}>{t('userMenu.logout')}</Text>
                    </Pressable>
                  </View>

                  {user?.name && (
                    <Text style={styles.profileEmail} numberOfLines={1}>
                      {user.email}
                    </Text>
                  )}
                </View>

                {(user?.hasPassword ?? true) && (
                  <Pressable style={styles.menuItem} onPress={() => setView('changePassword')}>
                    <Ionicons name="key-outline" size={20} color="#1f2937" />
                    <Text style={styles.menuItemText}>{t('userMenu.changePassword')}</Text>
                  </Pressable>
                )}
                <Pressable style={styles.menuItem} onPress={onRestartTour}>
                  <Ionicons name="help-circle-outline" size={20} color="#1f2937" />
                  <Text style={styles.menuItemText}>{t('userMenu.restartTour')}</Text>
                </Pressable>
                <Pressable style={styles.menuItem} onPress={() => setView('deleteAccountConfirm')}>
                  <Ionicons name="trash-outline" size={20} color="#dc2626" />
                  <Text style={[styles.menuItemText, styles.dangerText]}>{t('userMenu.deleteAccount')}</Text>
                </Pressable>
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
                <Text style={styles.title}>{t('userMenu.changePasswordTitle')}</Text>
                <GlassTextInput
                  style={styles.input}
                  placeholder={t('userMenu.currentPasswordPlaceholder')}
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />
                <GlassTextInput
                  style={styles.input}
                  placeholder={t('userMenu.newPasswordPlaceholder')}
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <GlassTextInput
                  style={styles.input}
                  placeholder={t('userMenu.confirmNewPasswordPlaceholder')}
                  secureTextEntry
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
                <GlassButton label={t('common.close')} variant="accent" onPress={onClose} />
              </>
            )}
          </GlassView>
        </Pressable>
      </Pressable>

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
  backdropBlur: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
    borderWidth: 0,
  },
  modalWrapper: {
    width: '65%',
  },
  card: {
    padding: 24,
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
    borderBottomColor: 'rgba(255,255,255,0.4)',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
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
  logoutTrigger: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minWidth: 72,
    backgroundColor: colors.danger,
    borderRadius: radius.card,
    boxShadow: '0px 3px 8px rgba(220,38,38,0.35)',
  },
  logoutTriggerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
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
  dangerText: {
    color: '#dc2626',
    fontWeight: '600',
  },
  input: {
    marginBottom: 12,
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
