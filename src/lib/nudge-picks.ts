import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { weekTitle } from "./dates";

const ET = "America/New_York";

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Eastern (America/New_York) clock parts — always use h23 so noon = 12, not 0/24 confusion. */
export function getEasternClock(now = new Date()): {
  weekday: string;
  hour: number;
  minute: number;
  label: string;
} {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const map = Object.fromEntries(
    dtf
      .formatToParts(now)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  ) as Record<string, string>;

  const weekday = map.weekday || "";
  const hour = Number(map.hour);
  const minute = Number(map.minute);
  const label = `${weekday} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ET`;
  return { weekday, hour, minute, label };
}

/**
 * True only during Friday 12:00–12:59 America/New_York (noon Eastern).
 * Not 9pm — hour must be exactly 12.
 */
export function isFridayNoonHourET(now = new Date()): boolean {
  const { weekday, hour } = getEasternClock(now);
  return weekday === "Fri" && hour === 12;
}

function parseKickoff(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

export type NudgeWeek = {
  weekCardId: string;
  weekNumber: number;
  expectedGames: number;
  firstKickoff: number | null;
  lastKickoff: number | null;
};

/**
 * Pick the earliest published week that still has games "this CFB week":
 * first kickoff within the past 1.5 days or next 8 days, and last kickoff not long finished.
 * No published card → null (season hasn't started for this league).
 */
export async function findActiveNudgeWeek(
  supabase: SupabaseClient,
  leagueId: string
): Promise<NudgeWeek | null> {
  const { data: cards } = await supabase
    .from("week_cards")
    .select("id, week_number")
    .eq("league_id", leagueId)
    .order("week_number", { ascending: true });

  if (!cards?.length) return null;

  const now = Date.now();
  const windowStart = now - 36 * 3600 * 1000; // 1.5 days ago
  const windowEnd = now + 8 * 24 * 3600 * 1000; // next 8 days

  for (const card of cards) {
    const { data: games } = await supabase
      .from("card_games")
      .select("start_time")
      .eq("week_card_id", card.id);

    if (!games?.length) continue;

    const times = games
      .map((g) => parseKickoff(g.start_time as string))
      .filter((t): t is number => t != null);

    // Card with no parseable times: only treat as active if it's the first card ever
    if (!times.length) {
      if (card.week_number === cards[0].week_number) {
        return {
          weekCardId: card.id,
          weekNumber: card.week_number,
          expectedGames: games.length,
          firstKickoff: null,
          lastKickoff: null,
        };
      }
      continue;
    }

    const first = Math.min(...times);
    const last = Math.max(...times);

    // Games in the "this week" window for a Friday noon nudge
    if (first <= windowEnd && last >= windowStart) {
      return {
        weekCardId: card.id,
        weekNumber: card.week_number,
        expectedGames: games.length,
        firstKickoff: first,
        lastKickoff: last,
      };
    }
  }

  return null;
}

export type MissingPlayer = {
  userId: string;
  name: string;
  status: "missing" | "partial";
  gamePickCount: number;
};

export async function listIncompletePickers(
  supabase: SupabaseClient,
  leagueId: string,
  weekNumber: number,
  expectedGames: number
): Promise<MissingPlayer[]> {
  const { data: members } = await supabase
    .from("memberships")
    .select("user_id, profiles(display_name)")
    .eq("league_id", leagueId);

  if (!members?.length) return [];

  const { data: pickRows } = await supabase
    .from("picks")
    .select("id, user_id, prop_choice, best_bet_game_id")
    .eq("league_id", leagueId)
    .eq("week_number", weekNumber);

  const pickByUser = new Map(
    (pickRows || []).map((p) => [p.user_id as string, p])
  );
  const pickIds = (pickRows || []).map((p) => p.id as string);
  const countByPickId = new Map<string, number>();

  if (pickIds.length) {
    const { data: pgs } = await supabase
      .from("pick_games")
      .select("pick_id")
      .in("pick_id", pickIds);
    for (const row of pgs || []) {
      const id = row.pick_id as string;
      countByPickId.set(id, (countByPickId.get(id) || 0) + 1);
    }
  }

  const missing: MissingPlayer[] = [];

  for (const m of members) {
    const userId = m.user_id as string;
    const profile = m.profiles as { display_name?: string } | null;
    const name = profile?.display_name || "Player";
    const pick = pickByUser.get(userId);

    if (!pick) {
      missing.push({
        userId,
        name,
        status: "missing",
        gamePickCount: 0,
      });
      continue;
    }

    const gamePickCount = countByPickId.get(pick.id as string) || 0;
    const complete =
      gamePickCount >= expectedGames &&
      !!pick.prop_choice &&
      !!pick.best_bet_game_id;

    if (!complete) {
      missing.push({
        userId,
        name,
        status: "partial",
        gamePickCount,
      });
    }
  }

  missing.sort((a, b) => a.name.localeCompare(b.name));
  return missing;
}

export async function alreadyNudgedThisWeek(
  supabase: SupabaseClient,
  leagueId: string,
  weekNumber: number
): Promise<boolean> {
  const title = `${weekTitle(weekNumber)}: Still need picks`;
  // Avoid duplicate Friday posts for the same week (look back 6 days)
  const since = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString();

  const { data } = await supabase
    .from("announcements")
    .select("id")
    .eq("league_id", leagueId)
    .eq("title", title)
    .gte("created_at", since)
    .limit(1);

  return !!(data && data.length);
}

export function buildNudgeAnnouncement(
  weekNumber: number,
  missing: MissingPlayer[]
): { title: string; body: string } {
  const title = `${weekTitle(weekNumber)}: Still need picks`;
  const lines = missing.map((m) => {
    if (m.status === "missing") return `• ${m.name} — not submitted`;
    return `• ${m.name} — partial (${m.gamePickCount} game picks)`;
  });

  const body = [
    `Friday noon check — these players still need a complete ${weekTitle(weekNumber)} card (all games + confidence + Best Bet + prop):`,
    "",
    ...lines,
    "",
    "Lock them in on My Picks before kickoff. This is an automatic War Room reminder.",
  ].join("\n");

  return { title, body };
}

export type NudgeLeagueResult = {
  leagueId: string;
  leagueName: string;
  weekNumber?: number;
  status:
    | "skipped_no_card"
    | "skipped_outside_window"
    | "skipped_all_in"
    | "skipped_already_posted"
    | "posted"
    | "error";
  missingCount?: number;
  error?: string;
};

export async function runFridayPickNudge(opts?: {
  force?: boolean;
  now?: Date;
}): Promise<{
  ran: boolean;
  reason?: string;
  easternTime?: string;
  results: NudgeLeagueResult[];
}> {
  const now = opts?.now || new Date();
  const et = getEasternClock(now);

  if (!opts?.force && !isFridayNoonHourET(now)) {
    return {
      ran: false,
      easternTime: et.label,
      reason: `Skipped: only runs Friday 12:00–12:59 ET (noon). Right now it is ${et.label}. Use force=1 to test.`,
      results: [],
    };
  }

  const supabase = createServiceClient();
  const { data: leagues, error } = await supabase
    .from("leagues")
    .select("id, name, commissioner_id");

  if (error || !leagues) {
    throw new Error(error?.message || "Failed to load leagues");
  }

  const results: NudgeLeagueResult[] = [];

  for (const league of leagues) {
    const leagueId = league.id as string;
    const leagueName = (league.name as string) || "League";
    const commissionerId = league.commissioner_id as string;

    try {
      const week = await findActiveNudgeWeek(supabase, leagueId);
      if (!week) {
        results.push({
          leagueId,
          leagueName,
          status: "skipped_no_card",
        });
        continue;
      }

      if (await alreadyNudgedThisWeek(supabase, leagueId, week.weekNumber)) {
        results.push({
          leagueId,
          leagueName,
          weekNumber: week.weekNumber,
          status: "skipped_already_posted",
        });
        continue;
      }

      const missing = await listIncompletePickers(
        supabase,
        leagueId,
        week.weekNumber,
        week.expectedGames || 5
      );

      if (!missing.length) {
        results.push({
          leagueId,
          leagueName,
          weekNumber: week.weekNumber,
          status: "skipped_all_in",
          missingCount: 0,
        });
        continue;
      }

      const { title, body } = buildNudgeAnnouncement(week.weekNumber, missing);
      const { error: insErr } = await supabase.from("announcements").insert({
        league_id: leagueId,
        author_id: commissionerId,
        title,
        body,
      });

      if (insErr) {
        results.push({
          leagueId,
          leagueName,
          weekNumber: week.weekNumber,
          status: "error",
          error: insErr.message,
        });
        continue;
      }

      results.push({
        leagueId,
        leagueName,
        weekNumber: week.weekNumber,
        status: "posted",
        missingCount: missing.length,
      });
    } catch (e: unknown) {
      results.push({
        leagueId,
        leagueName,
        status: "error",
        error: e instanceof Error ? e.message : "unknown error",
      });
    }
  }

  return { ran: true, results };
}
