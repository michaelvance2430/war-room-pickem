import { Suspense } from "react";
import PicksClient from "./PicksClient";

/**
 * Server page shell — useSearchParams lives only in PicksClient.
 * Next.js 15 requires Suspense at the page boundary for CSR bailout.
 */
export default function PicksPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-muted">
          Loading picks…
        </div>
      }
    >
      <PicksClient />
    </Suspense>
  );
}
