import { actionCreators } from "@near-wallet-selector/core";
import { getNearSelector } from "../runtime";

const NEAR_RPC_URL =
  (import.meta.env.VITE_NEAR_RPC_URL as string | undefined)?.trim()
  || "https://rpc.mainnet.near.org";

const STORAGE_DEPOSIT_YOCTO = "1250000000000000000000";
const STORAGE_GAS = "15000000000000";
const FT_TRANSFER_GAS = "30000000000000";

async function viewFunction<T>(contractId: string, methodName: string, args: Record<string, unknown> = {}): Promise<T | null> {
  const res = await fetch(NEAR_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "salaryflow",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: contractId,
        method_name: methodName,
        args_base64: btoa(JSON.stringify(args)),
      },
    }),
  });
  const json = await res.json() as {
    result?: { result?: number[] };
    error?: unknown;
  };
  if (!json.result?.result) return null;
  const text = new TextDecoder().decode(Uint8Array.from(json.result.result));
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

export async function readNearFtBalance(opts: {
  tokenContract: string;
  owner: string;
}): Promise<bigint> {
  const raw = await viewFunction<string>(opts.tokenContract, "ft_balance_of", {
    account_id: opts.owner,
  });
  if (raw == null) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

export async function sendNearFtTransfer(opts: {
  tokenContract: string;
  depositAddress: string;
  amount: string;
  memo?: string | null;
}): Promise<string> {
  const selector = getNearSelector();
  if (!selector) throw new Error("NEAR wallet is not ready");
  const wallet = await selector.wallet();

  const storage = await viewFunction<{ available?: string } | null>(
    opts.tokenContract,
    "storage_balance_of",
    { account_id: opts.depositAddress },
  );

  const transactions: Array<{
    signerId?: string;
    receiverId: string;
    actions: ReturnType<typeof actionCreators.functionCall>[];
  }> = [];

  if (!storage?.available) {
    transactions.push({
      receiverId: opts.tokenContract,
      actions: [
        actionCreators.functionCall(
          "storage_deposit",
          { account_id: opts.depositAddress, registration_only: true },
          BigInt(STORAGE_GAS),
          BigInt(STORAGE_DEPOSIT_YOCTO),
        ),
      ],
    });
  }

  transactions.push({
    receiverId: opts.tokenContract,
    actions: [
      actionCreators.functionCall(
        "ft_transfer",
        {
          receiver_id: opts.depositAddress,
          amount: opts.amount,
          memo: opts.memo || null,
        },
        BigInt(FT_TRANSFER_GAS),
        BigInt(1),
      ),
    ],
  });

  const result = await wallet.signAndSendTransactions({ transactions });
  const last = result?.at(-1);
  const hash = last?.transaction?.hash || last?.transaction_outcome?.id;
  if (!hash) throw new Error("NEAR transfer did not return a transaction hash");
  return String(hash);
}
