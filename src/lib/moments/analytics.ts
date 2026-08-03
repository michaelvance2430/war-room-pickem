import {
  EVENT_MOMENT_ANALYTICS,
  type MomentAnalyticsDetail,
} from "./types";

/** Fire-and-forget Moment analytics. No PII beyond moment/sport ids. */
export function trackMoment(detail: MomentAnalyticsDetail): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_MOMENT_ANALYTICS, { detail })
    );
  } catch {
    /* ok */
  }
  try {
    // Optional hook for future pipeline
    const w = window as Window & {
      warroomTrackMoment?: (d: MomentAnalyticsDetail) => void;
    };
    w.warroomTrackMoment?.(detail);
  } catch {
    /* ok */
  }
}
