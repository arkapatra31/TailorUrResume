import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { useStore } from "@/store";

interface State { error: Error | null }

/** Last line of defence: a render crash shows a recovery screen instead of a white page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State { return { error }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Never log state: it can contain the user's profile or API key.
    console.error("UI crashed:", error.name, info.componentStack?.split("\n")[1]?.trim());
  }

  /** Go back to the first screen but keep session data (the crash may have been transient). */
  private retry = () => { useStore.setState({ step: 0, paletteOpen: false }); this.setState({ error: null }); };

  /** Drop jobs and profile, which is where a malformed import would live. */
  private reset = () => {
    useStore.setState({ step: 0, profile: null, profileFile: "", jobs: [], activeJobId: null, paletteOpen: false, dirty: false });
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-danger/15 text-danger"><AlertTriangle className="size-7" /></span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-muted-foreground">The page hit an unexpected error. Your files were never uploaded anywhere, and nothing is stored. You can try again or start with a clean session.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={this.retry} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-medium text-primary-foreground hover:brightness-110"><RotateCcw className="size-4" />Try again</button>
          <button onClick={this.reset} className="glass inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-medium hover:brightness-110">Reset session</button>
        </div>
      </div>
    );
  }
}
