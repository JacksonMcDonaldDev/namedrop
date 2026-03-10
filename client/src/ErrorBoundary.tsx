import { Component, ErrorInfo, ReactNode } from 'react';
import { Container, Title, Text, Code, Stack, Button } from '@mantine/core';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('React error boundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Container size="sm" py="xl">
          <Stack gap="md">
            <Title order={2} c="red">Something went wrong</Title>
            <Text fw={600}>{this.state.error.message}</Text>
            <Code block style={{ whiteSpace: 'pre-wrap' }}>
              {this.state.error.stack}
            </Code>
            <Button
              variant="outline"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </Button>
          </Stack>
        </Container>
      );
    }

    return this.props.children;
  }
}
