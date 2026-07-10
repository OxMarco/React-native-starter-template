import type { ReactNode } from 'react';
import { View } from 'react-native';

export default function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={`rounded-2xl border border-border bg-surface p-5 ${className}`}>
      {children}
    </View>
  );
}
