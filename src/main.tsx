import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { ThemeProvider } from "./components/ThemeProvider";
import { TooltipProvider } from "./components/ui/tooltip";
import { wagmiConfig } from "./lib/wallet";
import "./styles.css";

const queryClient = new QueryClient();
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
          <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
              <App />
            </QueryClientProvider>
          </WagmiProvider>
        </TooltipProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}
