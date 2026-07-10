jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-native-community/netinfo', () => {
  const netInfo = {
    addEventListener: jest.fn(() => jest.fn()),
  };

  return {
    __esModule: true,
    default: netInfo,
    useNetInfo: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
  };
});
