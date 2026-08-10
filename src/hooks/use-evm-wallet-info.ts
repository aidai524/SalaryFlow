import { useMemo } from "react";
import { useAccount, useConnectors } from "wagmi";

/** Resolve the connected EVM wallet display name + icon from wagmi connectors. */
export function useEvmWalletInfo() {
  const { connector } = useAccount();
  const connectors = useConnectors();

  return useMemo(() => {
    const currentConnector = connectors.find((c) => c.id === connector?.id);

    let name = connector?.name || "";
    let icon = connector?.icon || "";

    if (!name && currentConnector) {
      name = currentConnector.name || connector?.name || "Unknown Wallet";
      name = name.replace(/^io\./, "");
      name = name.charAt(0).toUpperCase() + name.slice(1);
    }
    if (!icon && currentConnector) {
      icon = currentConnector.icon || "";
    }

    return { name, icon };
  }, [connectors, connector]);
}
