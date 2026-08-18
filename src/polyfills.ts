import { Buffer } from "buffer";
import process from "process";

const globalRef = globalThis as typeof globalThis & {
  Buffer: typeof Buffer;
  process: typeof process;
};

globalRef.Buffer = Buffer;
globalRef.process = process;
process.env ??= {};
process.env.NODE_ENV ??= import.meta.env.MODE;
