import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useToasts } from '../hooks/useToasts';
import { changePassword, type AuthUser } from '../lib/authApi';
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
};

type MenuView = 'menu' | 'changePassword' | 'changePasswordSuccess';

export function UserMenuModal({ visible, user, onClose, onLogout }: UserMenuModalProps) {
  const [view, setView] = useState<MenuView>('menu');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toasts, showError, dismissToast } = useToasts();

  const handleShow = () => {
    setView('menu');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmitPasswordChange = () => {
    if (newPassword !== confirmPassword) {
      showError('Fjalëkalimet e reja nuk përputhen.');
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

  return (
    <Modal visible={visible} transparent animationType="fade" onShow={handleShow} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <GlassView tint="dark" style={styles.backdropBlur} />
        <Pressable onPress={(event) => event.stopPropagation()}>
          <GlassView style={styles.card}>
            {view === 'menu' && (
              <>
                <View style={styles.profile}>
                  <UserAvatar user={user} size={56} />
                  <Text style={styles.profileName}>{user?.name ?? user?.email ?? ''}</Text>
                  {user?.name && <Text style={styles.profileEmail}>{user.email}</Text>}
                </View>

                {(user?.hasPassword ?? true) && (
                  <Pressable style={styles.menuItem} onPress={() => setView('changePassword')}>
                    <Ionicons name="key-outline" size={20} color="#1f2937" />
                    <Text style={styles.menuItemText}>Ndrysho fjalëkalimin</Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.menuItem}
                  onPress={() => {
                    onClose();
                    onLogout();
                  }}
                >
                  <Ionicons name="log-out-outline" size={20} color="#dc2626" />
                  <Text style={[styles.menuItemText, styles.logoutText]}>Dil</Text>
                </Pressable>
              </>
            )}

            {view === 'changePassword' && (
              <>
                <Text style={styles.title}>Ndrysho fjalëkalimin</Text>
                <GlassTextInput
                  style={styles.input}
                  placeholder="Fjalëkalimi aktual"
                  secureTextEntry
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />
                <GlassTextInput
                  style={styles.input}
                  placeholder="Fjalëkalimi i ri"
                  secureTextEntry
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <GlassTextInput
                  style={styles.input}
                  placeholder="Konfirmo fjalëkalimin e ri"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <GlassButton
                  label={isSubmitting ? 'Duke ruajtur...' : 'Ruaj'}
                  variant="accent"
                  onPress={handleSubmitPasswordChange}
                  disabled={isSubmitting}
                />
                <Pressable onPress={() => setView('menu')}>
                  <Text style={styles.backText}>Anulo</Text>
                </Pressable>
              </>
            )}

            {view === 'changePasswordSuccess' && (
              <>
                <Text style={styles.title}>Fjalëkalimi u ndryshua.</Text>
                <GlassButton label="Mbyll" variant="accent" onPress={onClose} />
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
  card: {
    width: '85%',
    padding: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    color: '#1f2937',
  },
  profile: {
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.4)',
  },
  profileName: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  profileEmail: {
    marginTop: 2,
    fontSize: 13,
    color: '#6b7280',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#1f2937',
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '600',
  },
  input: {
    marginBottom: 12,
  },
  backText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
  },
});
