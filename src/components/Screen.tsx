import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import OfflineBanner from './OfflineBanner';

type Props = {
  children: ReactNode;
  scroll?: boolean;
};

export default function Screen({ children, scroll = false }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'left', 'right']}>
      <OfflineBanner />
      {scroll ? (
        <ScrollView contentContainerClassName="grow px-5 py-6" keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 px-5 py-6">{children}</View>
      )}
    </SafeAreaView>
  );
}
