module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  // Without an explicit source set, coverage reports only modules a test
  // already imports — which silently drops screens and navigation from the
  // denominator and makes the number look better than it is.
  collectCoverageFrom: ['App.tsx', 'src/**/*.{ts,tsx}', '!src/**/__tests__/**', '!src/**/*.d.ts'],
  coverageThreshold: {
    global: {
      statements: 78,
      branches: 72,
      functions: 70,
      lines: 81,
    },
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*|nativewind|@tanstack/.*))',
  ],
};
