import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { changePassword } from '../lib/authApi';

type UserMenuModalProps = {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
};

type MenuView = 'menu' | 'changePassword' | 'changePasswordSuccess';

export function UserMenuModal({ visible, onClose, onLogout }: UserMenuModalProps) {
  const [view, setView] = useState<MenuView>('menu');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShow = () => {
    setView('menu');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
  };

  const handleSubmitPasswordChange = () => {
    if (newPassword !== confirmPassword) {
      setError('Fjalëkalimet e reja nuk përputhen.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    changePassword(currentPassword, newPassword)
      .then(() => {
        setIsSubmitting(false);
        setView('changePasswordSuccess');
      })
      .catch((submitError: Error) => {
        setIsSubmitting(false);
        setError(submitError.message);
      });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onShow={handleShow} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(event) => event.stopPropagation()}>
          {view === 'menu' && (
            <>
              <Pressable style={styles.menuItem} onPress={() => setView('changePassword')}>
                <Text style={styles.menuItemText}>Ndrysho fjalëkalimin</Text>
              </Pressable>
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onLogout();
                }}
              >
                <Text style={[styles.menuItemText, styles.logoutText]}>Dil</Text>
              </Pressable>
            </>
          )}

          {view === 'changePassword' && (
            <>
              <Text style={styles.title}>Ndrysho fjalëkalimin</Text>
              <TextInput
                style={styles.input}
                placeholder="Fjalëkalimi aktual"
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TextInput
                style={styles.input}
                placeholder="Fjalëkalimi i ri"
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TextInput
                style={styles.input}
                placeholder="Konfirmo fjalëkalimin e ri"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              {error && <Text style={styles.errorText}>{error}</Text>}
              <Pressable style={styles.submitButton} onPress={handleSubmitPasswordChange} disabled={isSubmitting}>
                <Text style={styles.submitButtonText}>{isSubmitting ? 'Duke ruajtur...' : 'Ruaj'}</Text>
              </Pressable>
              <Pressable onPress={() => setView('menu')}>
                <Text style={styles.backText}>Anulo</Text>
              </Pressable>
            </>
          )}

          {view === 'changePasswordSuccess' && (
            <>
              <Text style={styles.title}>Fjalëkalimi u ndryshua.</Text>
              <Pressable style={styles.submitButton} onPress={onClose}>
                <Text style={styles.submitButtonText}>Mbyll</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  menuItem: {
    paddingVertical: 14,
  },
  menuItemText: {
    fontSize: 16,
    textAlign: 'center',
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '600',
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
  errorText: {
    color: '#dc2626',
    marginBottom: 12,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  backText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 12,
  },
});
