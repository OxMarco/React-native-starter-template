import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import OfflineBanner from './OfflineBanner';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  edges?: readonly Edge[];
};

// Full-screen routes need the bottom inset, or their last control sits under
// the home indicator. Screens inside the tab navigator must NOT apply it: the
// tab bar already consumes that inset, and applying it twice leaves a gap above
// the bar. Tab screens pass TAB_SCREEN_EDGES; everything else gets all four,
// which is the safe default for a new screen.
export const TAB_SCREEN_EDGES: readonly Edge[] = ['top', 'left', 'right'];
const DEFAULT_EDGES: readonly Edge[] = ['top', 'left', 'right', 'bottom'];

// A line of text running the full width of a tablet or desktop window is hard
// to read, so content is centred inside a measured column.
const MAX_CONTENT_WIDTH = 680;

export default function Screen({ children, scroll = false, edges = DEFAULT_EDGES }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={edges}>
      <OfflineBanner />
      {scroll ? (
        <ScrollView
          contentContainerClassName="grow px-5 py-6"
          contentContainerStyle={{
            width: '100%',
            maxWidth: MAX_CONTENT_WIDTH,
            alignSelf: 'center',
          }}
          keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View
          className="w-full flex-1 self-center px-5 py-6"
          style={{ maxWidth: MAX_CONTENT_WIDTH }}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
