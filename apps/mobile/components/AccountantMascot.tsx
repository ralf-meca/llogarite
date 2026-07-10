import { Image } from 'react-native';

const ASPECT_RATIO = 1131 / 861;

type AccountantMascotProps = {
  size?: number;
};

export function AccountantMascot({ size = 96 }: AccountantMascotProps) {
  return (
    <Image
      source={require('../assets/mascot.png')}
      style={{ width: size, height: size * ASPECT_RATIO }}
      resizeMode="contain"
    />
  );
}
