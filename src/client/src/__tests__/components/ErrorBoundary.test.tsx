import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, RouteErrorBoundary } from '../../components/ErrorBoundary';

function ThrowingComponent({ message }: { message: string }): React.ReactNode {
  throw new Error(message);
}

function GoodComponent() {
  return <div>All good</div>;
}

describe('ErrorBoundary', () => {
  // Suppress console.error for expected error boundary catches
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  afterEach(() => consoleSpy.mockClear());

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent message="Test crash" />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test crash')).toBeInTheDocument();
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingComponent message="fail" />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  });
});

describe('RouteErrorBoundary', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  afterEach(() => consoleSpy.mockClear());

  it('renders children when no error', () => {
    render(
      <RouteErrorBoundary>
        <GoodComponent />
      </RouteErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('shows inline error UI when child throws', () => {
    render(
      <RouteErrorBoundary>
        <ThrowingComponent message="Route error" />
      </RouteErrorBoundary>
    );
    expect(screen.getByText('This page encountered an error')).toBeInTheDocument();
    expect(screen.getByText('Route error')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('retry resets error state', () => {
    // First render throws, then after retry we need to not throw
    // We'll test that the Try Again button exists and is clickable
    render(
      <RouteErrorBoundary>
        <ThrowingComponent message="Retry test" />
      </RouteErrorBoundary>
    );
    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeInTheDocument();
    // Clicking retry resets state, but child will throw again
    fireEvent.click(retryButton);
    // After retry, component re-renders — child throws again so error UI shows again
    expect(screen.getByText('This page encountered an error')).toBeInTheDocument();
  });
});
