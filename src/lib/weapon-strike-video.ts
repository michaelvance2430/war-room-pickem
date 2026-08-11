const FOOTBALL_NUKE_VIDEOS = [
  "/media/nuke-football-1.mp4",
  "/media/nuke-football-2.mp4",
  "/media/nuke-football-3.mp4",
] as const;

const FIELDHOUSE_HELLFIRE_VIDEOS = [
  "/media/hellfire-fieldhouse-1.mp4",
] as const;

export function randomFootballNukeVideo(random = Math.random): string {
  const roll = Math.max(0, Math.min(0.999999, random()));
  return FOOTBALL_NUKE_VIDEOS[
    Math.floor(roll * FOOTBALL_NUKE_VIDEOS.length)
  ];
}

export function strikeVideoForSport(sportId: string): string | null {
  if (sportId === "cfb" || sportId === "nfl") {
    return randomFootballNukeVideo();
  }
  if (sportId === "cbb") {
    return FIELDHOUSE_HELLFIRE_VIDEOS[0];
  }
  return null;
}
