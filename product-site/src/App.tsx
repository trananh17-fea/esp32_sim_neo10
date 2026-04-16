import { useEffect, type FC } from "react";
import { I18nProvider } from "@/i18n/context";
import { ThemeProvider } from "@/hooks/useTheme";
import { CartProvider } from "@/hooks/useCart";
import { initAnalytics } from "@/services/analytics/webAnalytics";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";

const AppInner: FC = () => {
  useEffect(() => {
    initAnalytics();
  }, []);

  return <Index />;
};

const App: FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <I18nProvider>
        <CartProvider>
          <AppInner />
        </CartProvider>
      </I18nProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
