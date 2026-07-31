"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Old URL /players/2 → /profile/2 */
export default function LegacyProfileRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(id ? `/profile/${id}` : "/standings");
  }, [id, router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-muted">
      Opening profile…
    </div>
  );
}
