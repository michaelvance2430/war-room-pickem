import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isFoundryOwnerUserId } from "@/lib/foundry-owner.server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PrivateWorkshopLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !isFoundryOwnerUserId(data.user?.id)) {
    redirect("/");
  }

  return children;
}
