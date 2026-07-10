import { useNetInfo } from '@react-native-community/netinfo';

export function useIsOnline(): boolean | null {
  const state = useNetInfo();

  if (state.isConnected === false || state.isInternetReachable === false) return false;
  if (state.isConnected === null || state.isInternetReachable === null) return null;
  return true;
}
