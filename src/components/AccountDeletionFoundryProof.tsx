"use client";

import { useState } from "react";
import AccountDeletionPanel from "@/components/AccountDeletionPanel";

type Scenario = "eligible" | "commissioner" | "failed";

export default function AccountDeletionFoundryProof() {
  const [scenario, setScenario] = useState<Scenario>("eligible");
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-bold">Account deletion readiness</h2>
      <p className="mt-1 text-xs text-muted">Preview only. The public Account entry and production deletion endpoint remain sealed.</p>
      <div className="my-3 grid grid-cols-3 gap-2">
        {(["eligible", "commissioner", "failed"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setScenario(item)} className={`min-h-10 rounded-lg border px-2 text-[10px] font-black uppercase ${scenario === item ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>
            {item === "commissioner" ? "Pass Keys" : item}
          </button>
        ))}
      </div>
      <AccountDeletionPanel previewState={scenario} />
    </section>
  );
}
