import type * as AppleAuthenticationModule from 'expo-apple-authentication';
import { Platform, StyleSheet } from 'react-native';

const BUTTON_HEIGHT = 50;

// Loaded only on iOS: the module has no Android side, so it must not be
// reached for there.
const AppleAuthentication: typeof AppleAuthenticationModule | null =
  Platform.OS === 'ios' ? require('expo-apple-authentication') : null;

export type AppleCredential = {
  identityToken: string;
  // Only there on the person's first sign-in; Apple does not send it again.
  name: string | null;
  // A one-time code the server can trade for the means to withdraw Apple's
  // grant if the account is deleted.
  authorizationCode: string | null;
};

type AppleSignInButtonProps = {
  disabled?: boolean;
  onCredential: (credential: AppleCredential) => void;
  onError: () => void;
};

// Apple's own button, as its guidelines ask for, and nothing at all off iOS.
export function AppleSignInButton({ disabled, onCredential, onError }: AppleSignInButtonProps) {
  if (!AppleAuthentication) {
    return null;
  }
  const module = AppleAuthentication;

  const handlePress = () => {
    if (disabled) {
      return;
    }
    module
      .signInAsync({
        requestedScopes: [
          module.AppleAuthenticationScope.FULL_NAME,
          module.AppleAuthenticationScope.EMAIL,
        ],
      })
      .then((credential) => {
        if (!credential.identityToken) {
          onError();
          return;
        }
        const name = [credential.fullName?.givenName, credential.fullName?.familyName]
          .filter((part): part is string => Boolean(part))
          .join(' ');
        onCredential({
          identityToken: credential.identityToken,
          name: name || null,
          authorizationCode: credential.authorizationCode ?? null,
        });
      })
      .catch((error: { code?: string }) => {
        // Closing Apple's sheet is a change of mind, not a failure.
        if (error?.code !== 'ERR_REQUEST_CANCELED') {
          onError();
        }
      });
  };

  return (
    <module.AppleAuthenticationButton
      buttonType={module.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={module.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={BUTTON_HEIGHT / 2}
      style={styles.button}
      onPress={handlePress}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    height: BUTTON_HEIGHT,
    marginTop: 12,
  },
});
