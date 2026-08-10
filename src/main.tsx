import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./components/ThemeProvider";
import { TooltipProvider } from "./components/ui/tooltip";
import { WalletProvider } from "./wallet";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const isDecashPreview = window.location.pathname === "/design-preview"
  || new URLSearchParams(window.location.search).get("preview") === "decash";

const root = createRoot(document.getElementById("root")!);

if (isDecashPreview) {
  void import("./prototype/DecashPrototype").then(({ DecashPrototype }) => {
    root.render(
      <StrictMode>
        <DecashPrototype />
      </StrictMode>,
    );
  });
} else {
  root.render(
    <StrictMode>
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <WalletProvider>
              <App />
            </WalletProvider>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}
