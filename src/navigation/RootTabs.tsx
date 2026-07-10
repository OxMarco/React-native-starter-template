import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import ErrorBoundary from '@/components/ErrorBoundary';
import { useAppTheme } from '@/providers/ThemeProvider';
import HomeScreen from '@/screens/HomeScreen';
import SettingsScreen from '@/screens/SettingsScreen';

type RootTabParamList = {
  Home: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

function HomeTab() {
  return (
    <ErrorBoundary context="HomeScreen">
      <HomeScreen />
    </ErrorBoundary>
  );
}

function SettingsTab() {
  return (
    <ErrorBoundary context="SettingsScreen">
      <SettingsScreen />
    </ErrorBoundary>
  );
}

export default function RootTabs() {
  const { theme } = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.muted,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        tabBarIcon: ({ color }) => (
          <Text accessible={false} style={{ color, fontSize: 18 }}>
            {route.name === 'Home' ? '●' : '◆'}
          </Text>
        ),
      })}>
      <Tab.Screen name="Home" component={HomeTab} />
      <Tab.Screen name="Settings" component={SettingsTab} />
    </Tab.Navigator>
  );
}
