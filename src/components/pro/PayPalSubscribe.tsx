"use client";

import { useEffect, useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { get, post } from "@/lib/client/api";
import { byFn } from "@/lib/client/hooks";

// The PayPal subscribe button for YORU Pro (PayPal's own button and window).
// Pro is switched on by the server only after it has checked the subscription
// with PayPal; this component just hands over the subscription id.

export type BillingConfig = { enabled: false } | { enabled: true; clientId: string; planId: string; customId: string | null };
type Sync = { change: string; pro: boolean; until: string | null };

type PayPalButtons = { render(el: HTMLElement): Promise<void>; close?(): Promise<void> };
type PayPalSdk = {
  Buttons(opts: {
    style: Record<string, string>;
    createSubscription(data: unknown, actions: { subscription: { create(o: { plan_id: string; custom_id: string }): Promise<string> } }): Promise<string>;
    onApprove(data: { subscriptionID?: string | null }): Promise<void>;
    onError(err: unknown): void;
  }): PayPalButtons;
};

declare global {
  interface Window {
    paypal?: PayPalSdk;
  }
}

const SDK_ID = "paypal-sdk";

function loadSdk(clientId: string): Promise<PayPalSdk> {
  if (window.paypal) return Promise.resolve(window.paypal);
  return new Promise((resolve, reject) => {
    let s = document.getElementById(SDK_ID) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement("script");
      s.id = SDK_ID;
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription`;
      s.dataset.sdkIntegrationSource = "button-factory";
      s.async = true;
      document.head.appendChild(s);
    }
    s.addEventListener("load", () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal didn't load"))));
    s.addEventListener("error", () => reject(new Error("PayPal didn't load")));
  });
}

// Whether PayPal billing is live on this server (and the button's ids). null while loading.
export function usePayPalBilling(): BillingConfig | null {
  const { data, error } = useSWR<BillingConfig>("/api/billing/paypal", get, { revalidateOnFocus: false, shouldRetryOnError: false });
  return error ? { enabled: false } : (data ?? null);
}

export function PayPalSubscribe({ config, fallback }: { config: BillingConfig | null; fallback: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "checking" | "done" | "pending" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!config?.enabled || !config.customId || !box.current) return;
    const customId = config.customId;
    const el = box.current;
    let buttons: PayPalButtons | null = null;
    let live = true;
    loadSdk(config.clientId)
      .then((paypal) => {
        if (!live) return;
        buttons = paypal.Buttons({
          style: { shape: "pill", color: "black", layout: "vertical", label: "subscribe" },
          createSubscription: (_data, actions) => actions.subscription.create({ plan_id: config.planId, custom_id: customId }),
          onApprove: async (data) => {
            if (!data.subscriptionID) return;
            setState("checking");
            setMessage("");
            try {
              const out = await post<Sync>("/api/billing/paypal/activate", { subscriptionId: data.subscriptionID });
              await mutate(byFn("get_my_identity", "get_my_pro", "get_me"));
              setState(out.pro ? "done" : "pending");
            } catch (err) {
              setState("error");
              setMessage(err instanceof Error ? err.message : "Something went wrong.");
            }
          },
          onError: () => {
            setState("error");
            setMessage("PayPal had a problem. Nothing was charged. Please try again.");
          },
        });
        el.innerHTML = "";
        return buttons.render(el);
      })
      .catch(() => {
        if (!live) return;
        setState("error");
        setMessage("The PayPal button couldn't load. Check your connection or ad blocker and reload the page.");
      });
    return () => {
      live = false;
      buttons?.close?.().catch(() => {});
      el.innerHTML = "";
    };
  }, [config]);

  if (!config) return <div className="h-12 w-full animate-pulse rounded-full bg-card-2 sm:w-64" aria-hidden />;
  if (!config.enabled || !config.customId) return <>{fallback}</>;
  return (
    <div className="w-full sm:w-72">
      {state !== "done" && <div ref={box} className={state === "checking" ? "pointer-events-none opacity-50" : undefined} />}
      <div aria-live="polite" className="text-sm">
        {state === "checking" && <p className="text-ink-2">Confirming with PayPal…</p>}
        {state === "done" && <p className="rounded-xl bg-brand px-4 py-2 text-center font-bold text-white">Welcome to YORU Pro.</p>}
        {state === "pending" && (
          <p className="text-ink-2">PayPal is still activating your subscription. Pro switches on by itself in a minute or two; refresh to check.</p>
        )}
        {state === "error" && <p className="text-heart">{message}</p>}
      </div>
    </div>
  );
}
