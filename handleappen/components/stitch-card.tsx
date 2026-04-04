import { View, TouchableOpacity, type ViewProps } from 'react-native';

interface StitchCardProps extends ViewProps {
  elevated?: boolean;
  variant?: 'lowest' | 'low' | 'container' | 'high' | 'highest';
  onPress?: () => void;
  rounded?: '2xl' | '3xl' | '4xl';
}

const bgMap = {
  lowest: 'bg-surface-container-lowest',
  low: 'bg-surface-container-low',
  container: 'bg-surface-container',
  high: 'bg-surface-container-high',
  highest: 'bg-surface-container-highest',
};

const roundedMap = {
  '2xl': 'rounded-2xl',
  '3xl': 'rounded-3xl',
  '4xl': 'rounded-4xl',
};

export function StitchCard({
  elevated = false,
  variant = 'lowest',
  onPress,
  rounded = '3xl',
  className = '',
  children,
  ...props
}: StitchCardProps) {
  const baseClass = `${bgMap[variant]} ${roundedMap[rounded]} p-6 overflow-hidden ${
    elevated ? 'card-elevated' : ''
  } ${className}`;

  if (onPress) {
    return (
      <TouchableOpacity
        className={`${baseClass} press-scale`}
        onPress={onPress}
        activeOpacity={0.85}
        {...props}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View className={baseClass} {...props}>
      {children}
    </View>
  );
}
