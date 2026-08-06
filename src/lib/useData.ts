// Lightweight data hook (no react-query dependency needed)

import { useCallback, useEffect, useRef, useState } from "react";

export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}

const TOKEN_MINOR_SCALE = 1_000_000;
const TOKEN_INPUT_PATTERN = /^(0|[1-9]\d*)(?:\.\d{1,6})?$/;

export function formatTokenAmount(valueMinor: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(valueMinor / TOKEN_MINOR_SCALE);
}

export function isValidTokenAmount(value: string): boolean {
  return TOKEN_INPUT_PATTERN.test(value.trim()) && Number(value) > 0;
}

export function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}
