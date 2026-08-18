import type { Hex } from "viem";
import type { ChainKind } from "./types";
import { encodeErc20Transfer } from "./evm/transfer";
import { sendNearFtTransfer } from "./near/transfer";
import { sendSplTransfer } from "./solana/transfer";

export async function sendOriginDeposit(opts: {
  chainKind: ChainKind;
  contractAddress: string;
  depositAddress: string;
  amount: bigint;
  memo?: string | null;
  sendEvmTransaction: (args: { to: string; data: Hex; chainId?: number }) => Promise<string>;
  chainId?: number;
}): Promise<string> {
  if (opts.chainKind === "evm") {
    const data = encodeErc20Transfer(opts.depositAddress as `0x${string}`, opts.amount);
    return opts.sendEvmTransaction({
      to: opts.contractAddress,
      data,
      chainId: opts.chainId,
    });
  }
  if (opts.chainKind === "near") {
    return sendNearFtTransfer({
      tokenContract: opts.contractAddress,
      depositAddress: opts.depositAddress,
      amount: opts.amount.toString(),
      memo: opts.memo,
    });
  }
  if (opts.chainKind === "solana") {
    return sendSplTransfer({
      tokenMint: opts.contractAddress,
      depositAddress: opts.depositAddress,
      amount: opts.amount,
    });
  }
  throw new Error(`Unsupported origin chain: ${opts.chainKind}`);
}
