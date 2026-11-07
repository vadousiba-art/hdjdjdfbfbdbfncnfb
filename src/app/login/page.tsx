"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ChaosLoader } from "@/components/ui/bits";
import { useApp } from "@/components/providers/AppProvider";
import { ApiError, get, post } from "@/lib/client/api";

type DemoUser = { id: string; username: string; display_name: string; avatar_url: string | null; role: string; badge: string };

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function LoginInner() {
  const { config } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [users, setUsers] = useState<DemoUser[] | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config.mode !== "demo") return;
    get<DemoUser[]>("/api/auth/demo-users")
      .then(setUsers)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load demo users."));
  }, [config.mode]);

  async function login(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      await post("/api/auth/login", body);
      router.replace(next);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Login failed.");
      setBusy(false);
    }
  }

  if (config.mode === "demo") {
    return (
      <>
        <h1 className="text-xl font-bold">Choose an account</h1>
        <p className="mt-1 text-sm text-muted">
          Demo mode: no passwords, embedded database. Log in as anyone to try it.{" "}
          <Link href="/setup" className="font-bold text-brand">
            Connect Supabase
          </Link>{" "}
          for the real thing.
        </p>
        {error && <p className="mt-3 rounded-xl bg-hot/15 p-2 text-sm font-semibold text-hot">{error}</p>}
        {!users && !error && <ChaosLoader />}
        <div className="mt-4 grid max-h-[46dvh] grid-cols-3 gap-2 overflow-y-auto pr-1">
          {users?.map((u, i) => (
            <motion.button
              key={u.id}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(i * 0.02, 0.4) }}
              whileTap={{ scale: 0.97 }}
              disabled={busy}
              onClick={() => login({ user_id: u.id })}
              className="flex flex-col items-center gap-1 rounded-2xl border border-line p-2 text-center transition hover:border-brand hover:bg-card-2"
            >
              <Avatar src={u.avatar_url} name={u.display_name} size={48} ring={u.role === "owner" ? "gradient" : "none"} />
              <span className="w-full truncate text-xs font-bold">
                {u.display_name} {u.badge}
              </span>
              {u.role !== "member" && <span className="text-[10px] font-bold uppercase text-hot">{u.role}</span>}
            </motion.button>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          Have an invite?{" "}
          <Link href="/join" className="font-bold text-brand">
            Join YORU
          </Link>
        </p>
      </>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        login({ email, password });
      }}
    >
      <h1 className="text-xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Log in to pick up where you left off. Your next conversation starts here.</p>
      {error && <p className="mt-3 rounded-xl bg-hot/15 p-2 text-sm font-semibold text-hot">{error}</p>}
      <label className="mt-4 block text-sm font-semibold">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-card-2 px-3 py-2.5 outline-none focus:border-brand"
        />
      </label>
      <label className="mt-3 block text-sm font-semibold">
        Password
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-card-2 px-3 py-2.5 outline-none focus:border-brand"
        />
      </label>
      <Button type="submit" disabled={busy} className="mt-5 w-full py-3">
        {busy ? "Logging in..." : "Log in"}
      </Button>
      <p className="mt-4 text-center text-sm text-muted">
        New to YORU?{" "}
        <Link href="/join" className="font-bold text-brand">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthFrame>
      <Suspense fallback={<ChaosLoader />}>
        <LoginInner />
      </Suspense>
    </AuthFrame>
  );
}
