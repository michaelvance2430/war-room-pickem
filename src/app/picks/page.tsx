import PicksClient from "./PicksClient";

/**
 * Server page shell — PicksClient reads practice flags from window.location
 * (no useSearchParams) so mobile soft-nav from Standings cannot hang on Suspense.
 */
export default function PicksPage() {
  return <PicksClient />;
}
