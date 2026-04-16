import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level Error Boundary.
 * Catches render errors in the component tree and shows a friendly fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary] Uncaught error:", error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F7F3EE] p-8 text-center">
          <div className="rounded-2xl border border-[#E7DED2] bg-white p-8 shadow-lg">
            <h1 className="text-xl font-bold text-[#2B211B]">Có lỗi xảy ra</h1>
            <p className="mt-2 text-sm text-[#6E5A4A]">
              Vui lòng tải lại trang hoặc liên hệ{" "}
              <a href="tel:0775316675" className="font-semibold text-[#6B4F3A] underline">
                0775316675
              </a>
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex h-10 items-center rounded-xl bg-[#6B4F3A] px-5 text-sm font-semibold text-white hover:bg-[#4A3426]"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}