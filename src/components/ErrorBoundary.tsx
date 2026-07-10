import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { friendlyErrorMessage } from '@/lib/errors';
import { errorReporter } from '@/observability/observability';

type Props = {
  children: ReactNode;
  context?: string;
};

type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const context = this.props.context ?? 'ErrorBoundary';
    errorReporter.captureException(error, {
      context,
      extra: { component_stack: errorInfo.componentStack ?? '' },
    });
    if (__DEV__) console.error(`[${context}]`, error, errorInfo.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-center text-2xl font-bold text-text">Something went wrong</Text>
        <Text className="mt-3 text-center text-base leading-6 text-muted">
          {friendlyErrorMessage(this.state.error)}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={this.reset}
          className="mt-6 rounded-xl bg-primary px-6 py-3 active:opacity-80">
          <Text className="font-semibold text-primaryContrast">Try again</Text>
        </Pressable>
      </View>
    );
  }
}
