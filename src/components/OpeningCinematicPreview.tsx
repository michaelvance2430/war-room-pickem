/* eslint-disable @next/next/no-img-element -- pre-optimized cinematic layers need direct transform control */
"use client";

import { useEffect, useState } from "react";
import styles from "./OpeningCinematicPreview.module.css";

export default function OpeningCinematicPreview({
  onDone,
  showReplay = false,
}: {
  onDone?: () => void;
  showReplay?: boolean;
}) {
  const [run, setRun] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => onDone?.(), reduced ? 1_250 : 7_650);
    return () => window.clearTimeout(t);
  }, [onDone, run]);

  return (
    <div key={run} className={`${styles.stage} ${styles.impact}`}>
      <img className={styles.scene} src="/cinematics/opening/general-clean.webp" alt="" />
      <img className={styles.wink} src="/cinematics/opening/general-wink.webp" alt="" />
      <div className={styles.smoke} />
      <img className={`${styles.equipment} ${styles.football}`} src="/cinematics/opening/football.webp" alt="" />
      <img className={`${styles.equipment} ${styles.baseball}`} src="/cinematics/opening/baseball.webp" alt="" />
      <img className={`${styles.equipment} ${styles.puck}`} src="/cinematics/opening/hockey-puck.webp" alt="" />
      <img className={`${styles.equipment} ${styles.soccer}`} src="/cinematics/opening/soccer-ball.webp" alt="" />
      <img className={`${styles.equipment} ${styles.basketball}`} src="/cinematics/opening/basketball.webp" alt="" />
      <img className={styles.title} src="/cinematics/opening/war-room-title.webp" alt="War Room Pick'Em" />
      <div className={styles.flash} />
      <button type="button" className={`${styles.skip} pointer-events-auto`} onClick={onDone}>Skip</button>
      {showReplay && (
        <button type="button" className="absolute z-20 left-4 bottom-4 min-h-[44px] rounded-full border border-white/30 bg-black/50 px-4 text-xs font-bold text-white" onClick={() => setRun((n) => n + 1)}>
          Replay
        </button>
      )}
    </div>
  );
}
