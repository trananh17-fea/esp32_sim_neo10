import * as React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./styles.css";

type ErrorBoundaryState = {
  error: Error | null;
};

class AppErrorBoundary extends React.Component<
  { children?: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("App runtime error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            padding: "24px",
            fontFamily: "Roboto, Segoe UI, sans-serif",
            background: "#f8f9fa",
            color: "#202124",
          }}
        >
          <h1 style={{ margin: "0 0 12px", fontSize: "24px" }}>Ứng dụng gặp lỗi runtime</h1>
          <p style={{ margin: "0 0 12px", color: "#5f6368" }}>
            Trang không còn trắng hoàn toàn nữa. Đây là lỗi đang chặn giao diện hiển thị:
          </p>
          <pre
            style={{
              padding: "16px",
              background: "#fff",
              border: "1px solid #dadce0",
              borderRadius: "12px",
              overflow: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {this.state.error.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

document.body.dataset.appMounted = "true";

createRoot(rootElement).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
