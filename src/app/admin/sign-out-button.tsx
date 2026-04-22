"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.push("/admin");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className="text-xs text-slate-200 hover:text-white underline underline-offset-2 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 rounded"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
