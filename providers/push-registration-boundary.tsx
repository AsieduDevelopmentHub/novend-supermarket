"use client";

import { Component, type ReactNode } from "react";

/**
 * Isolates push registration / Electron outbox so Convex query failures
 * cannot tear down the authenticated shell (global error boundary).
 */
export class PushRegistrationErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[push] registration host failed", error);
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
