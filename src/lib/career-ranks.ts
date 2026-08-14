export type CareerRank = {
  id: string;
  abbreviation: string;
  name: string;
  achievementPoints: number;
  seasons: number;
  sports: number;
  tacticalNukes: number;
  grade: "enlisted" | "officer";
};

const enlisted = (id: string, abbreviation: string, name: string, achievementPoints: number, seasons = 0, sports = 1): CareerRank => ({ id: `rank_${id}`, abbreviation, name, achievementPoints, seasons, sports, tacticalNukes: 0, grade: "enlisted" });
const officer = (id: string, abbreviation: string, name: string, achievementPoints: number, seasons: number, sports: number, tacticalNukes = 0): CareerRank => ({ id: `rank_${id}`, abbreviation, name, achievementPoints, seasons, sports, tacticalNukes, grade: "officer" });

/** One permanent, account-wide career ladder. Promotions never reverse. */
export const CAREER_RANKS: readonly CareerRank[] = [
  enlisted("pvt", "PVT", "Private", 0),
  enlisted("pv2", "PV2", "Private Second Class", 25),
  enlisted("pfc", "PFC", "Private First Class", 60),
  enlisted("spc", "SPC", "Specialist", 110),
  enlisted("cpl", "CPL", "Corporal", 180),
  enlisted("sgt", "SGT", "Sergeant", 275),
  enlisted("ssg", "SSG", "Staff Sergeant", 400, 1),
  enlisted("sfc", "SFC", "Sergeant First Class", 550, 1),
  enlisted("msg", "MSG", "Master Sergeant", 725, 2),
  enlisted("1sg", "1SG", "First Sergeant", 925, 2, 2),
  enlisted("sgm", "SGM", "Sergeant Major", 1200, 3, 2),
  enlisted("csm", "CSM", "Command Sergeant Major", 1500, 3, 2),
  officer("2lt", "2LT", "Second Lieutenant", 1850, 4, 2),
  officer("1lt", "1LT", "First Lieutenant", 2250, 4, 2),
  officer("cpt", "CPT", "Captain", 2750, 5, 3),
  officer("maj", "MAJ", "Major", 3400, 6, 3),
  officer("ltc", "LTC", "Lieutenant Colonel", 4200, 7, 3),
  officer("col", "COL", "Colonel", 5200, 8, 3, 1),
  officer("bg", "BG", "Brigadier General", 6500, 9, 4, 1),
  officer("mg", "MG", "Major General", 8000, 10, 4, 1),
  officer("ltg", "LTG", "Lieutenant General", 10000, 12, 4, 1),
  officer("gen", "GEN", "General", 12500, 14, 5, 1),
  officer("field_general", "★★★★★", "Five-Star Field General", 15000, 16, 5, 1),
] as const;

export type CareerRankProgress = {
  current: CareerRank;
  next: CareerRank | null;
  unlocked: CareerRank[];
  pointsToNext: number;
  progress: number;
};

export function resolveCareerRank(input: { achievementPoints: number; seasons: number; sports: number; tacticalNukes?: number; minimumRankId?: string | null }): CareerRankProgress {
  const achievementPoints = Math.max(0, Math.floor(input.achievementPoints || 0));
  const seasons = Math.max(0, Math.floor(input.seasons || 0));
  const sports = Math.max(1, Math.floor(input.sports || 1));
  const tacticalNukes = Math.max(0, Math.floor(input.tacticalNukes || 0));
  const qualified = CAREER_RANKS.filter((rank) => achievementPoints >= rank.achievementPoints && seasons >= rank.seasons && sports >= rank.sports && tacticalNukes >= rank.tacticalNukes);
  const qualifiedIndex = Math.max(0, CAREER_RANKS.findIndex((rank) => rank.id === (qualified[qualified.length - 1] || CAREER_RANKS[0]).id));
  const minimumIndex = Math.max(0, CAREER_RANKS.findIndex((rank) => rank.id === input.minimumRankId));
  const currentIndex = Math.max(qualifiedIndex, minimumIndex);
  const current = CAREER_RANKS[currentIndex];
  const unlocked = CAREER_RANKS.slice(0, currentIndex + 1);
  const next = CAREER_RANKS[currentIndex + 1] || null;
  const span = next ? Math.max(1, next.achievementPoints - current.achievementPoints) : 1;
  return { current, next, unlocked, pointsToNext: next ? Math.max(0, next.achievementPoints - achievementPoints) : 0, progress: next ? Math.max(0, Math.min(1, (achievementPoints - current.achievementPoints) / span)) : 1 };
}

export function careerRankByTitleId(id: string | null | undefined): CareerRank | null {
  return id ? CAREER_RANKS.find((rank) => rank.id === id) || null : null;
}
