import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { clusterApiUrl, Connection, PublicKey, Transaction } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { getSolanaRuntime } from "../runtime";

function solanaRpcUrl(): string {
  return (import.meta.env.VITE_SOLANA_RPC_URL as string | undefined)?.trim()
    || clusterApiUrl(WalletAdapterNetwork.Mainnet);
}

let sharedConnection: Connection | null = null;

export function getSolanaConnection(): Connection {
  const runtime = getSolanaRuntime();
  if (runtime) return runtime.connection;
  if (!sharedConnection) {
    sharedConnection = new Connection(solanaRpcUrl(), "confirmed");
  }
  return sharedConnection;
}

export async function readSplBalance(opts: {
  tokenMint: string;
  owner: string;
}): Promise<bigint> {
  const connection = getSolanaConnection();
  const mint = new PublicKey(opts.tokenMint);
  const owner = new PublicKey(opts.owner);
  const info = await connection.getAccountInfo(mint);
  const programId = info?.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const ata = getAssociatedTokenAddressSync(mint, owner, false, programId);
  try {
    const account = await getAccount(connection, ata, "confirmed", programId);
    return BigInt(account.amount);
  } catch {
    return 0n;
  }
}

export async function sendSplTransfer(opts: {
  tokenMint: string;
  depositAddress: string;
  amount: bigint;
}): Promise<string> {
  const runtime = getSolanaRuntime();
  if (!runtime) throw new Error("Solana wallet is not ready");

  const mint = new PublicKey(opts.tokenMint);
  const to = new PublicKey(opts.depositAddress);
  const info = await runtime.connection.getAccountInfo(mint);
  const programId = info?.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const fromAta = getAssociatedTokenAddressSync(mint, runtime.publicKey, false, programId);
  const toAta = getAssociatedTokenAddressSync(mint, to, false, programId);

  const tx = new Transaction();
  try {
    await getAccount(runtime.connection, toAta, "confirmed", programId);
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(
        runtime.publicKey,
        toAta,
        to,
        mint,
        programId,
      ),
    );
  }
  tx.add(
    createTransferInstruction(
      fromAta,
      toAta,
      runtime.publicKey,
      opts.amount,
      [],
      programId,
    ),
  );

  const { blockhash, lastValidBlockHeight } = await runtime.connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = runtime.publicKey;
  const signed = await runtime.signTransaction(tx);
  const signature = await runtime.connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
  });
  await runtime.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}
