import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { useAuthStore } from "./stores/auth";

export default function App() {
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (!bootstrapped) {
    return (
      <div className="splash-screen">
        <div>
          <span className="splash-mark">DC</span>
          <p>Loading DECash…</p>
        </div>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}
