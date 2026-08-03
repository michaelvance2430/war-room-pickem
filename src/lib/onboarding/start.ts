/**
 * Legacy multi-step journey auto-start — RETIRED.
 * Contextual one-time coaching lives in @/lib/coaching + ContextualCoach.
 */

/**
 * No-op. Multi-step player/commissioner journeys no longer auto-start.
 * Kept so existing imports compile.
 */
export async function maybeStartOnboarding(): Promise<void> {
  return;
}
