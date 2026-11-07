"use client";

import { mutate } from "swr";
import { byFn, useRpc } from "./hooks";

// Pro and donations by Interac e-Transfer need migration 0016. Until it exists
// the probe fails and the checkout stays hidden.

export type ETransferConfig = {
  version: number;
  email: string;
  currency: string;
  pro_cents: number;
  pro_months: number;
  donation_min_cents: number;
  donation_max_cents: number;
  max_waiting: number;
  open_days: number;
};

export type ETransferStatus = "open" | "sent" | "confirmed" | "rejected" | "canceled";
export type ETransferOrder = {
  id: string;
  kind: "pro" | "donation";
  base_cents: number;
  amount_cents: number;
  code: string;
  sender_name: string;
  status: ETransferStatus;
  matched_day: string | null;
  note: string;
  created_at: string;
  sent_at: string | null;
  decided_at: string | null;
  pro_until: string | null;
};

export function useETransfer() {
  const { data, error, isLoading } = useRpc<ETransferConfig>("etransfer_config", {}, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
    dedupingInterval: 10 * 60_000,
  });
  return { ready: !isLoading || Boolean(error), available: !error && typeof data?.version === "number", config: data };
}

export function useMyETransfers(enabled: boolean) {
  return useRpc<ETransferOrder[]>(enabled ? "etransfer_my_orders" : null, {}, { refreshInterval: 60_000 });
}

// After any change: my orders, my identity (Pro may have switched on), the owner's lists.
export function refreshETransfers() {
  return mutate(byFn("etransfer_my_orders", "etransfer_admin_orders", "etransfer_days", "get_my_identity", "get_my_pro", "get_me"));
}
