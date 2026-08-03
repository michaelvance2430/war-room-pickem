/**
 * Guest Mode copy + helpers.
 * Constitution: Guests observe. Members belong.
 * Mission: Convince someone in five minutes that War Room is worth joining.
 */

/** Structured invitation when a guest hits a member-only action (not an error). */
export type GuestBlockInvite = {
  title: string;
  why: string;
  missing: string;
  unlock: string;
};

export const GUEST_LOCKER_POST_INVITE: GuestBlockInvite = {
  title: "The Locker comes alive with real league members.",
  why: "You're exploring as a guest, so posting is disabled.",
  missing: "Trash talk, crews, and the room that makes a league yours.",
  unlock: "Join a league and start the conversation.",
};

export const GUEST_LOCKER_REACT_INVITE: GuestBlockInvite = {
  title: "Reactions are for members of a real league.",
  why: "You're exploring as a guest.",
  missing: "Stamping your friends' posts in your own room.",
  unlock: "Join or create a league to react for real.",
};

/** Flat message for APIs that only return error strings (UI can map guest: codes). */
export const GUEST_LOCKER_POST_CODE = "guest:locker_post";
export const GUEST_LOCKER_REACT_CODE = "guest:locker_react";

export function formatGuestInviteLines(inv: GuestBlockInvite): string {
  return `${inv.title}\n\n${inv.why}\n\n${inv.unlock}`;
}
