"use client";

/**
 * Turkeys + cornucopia / harvest spread (Thanksgiving season theme).
 */

export default function ThanksgivingDecor() {
  return (
    <div className="tgiving-decor" aria-hidden>
      {/* Cornucopia horn + spill — left */}
      <div className="tgiving-side tgiving-side--left">
        <div className="tgiving-cornucopia">
          <div className="tgiving-horn" />
          <div className="tgiving-spill">
            <span className="tgiving-food tgiving-food--1">🍇</span>
            <span className="tgiving-food tgiving-food--2">🍎</span>
            <span className="tgiving-food tgiving-food--3">🌽</span>
            <span className="tgiving-food tgiving-food--4">🥖</span>
            <span className="tgiving-food tgiving-food--5">🍠</span>
            <span className="tgiving-food tgiving-food--6">🍂</span>
            <span className="tgiving-food tgiving-food--7">🥧</span>
          </div>
        </div>
        <span className="tgiving-caption">Cornucopia</span>
      </div>

      {/* Turkey flock — right */}
      <div className="tgiving-side tgiving-side--right">
        <span className="tgiving-turkey tgiving-turkey--big">🦃</span>
        <span className="tgiving-turkey tgiving-turkey--mid">🦃</span>
        <span className="tgiving-turkey tgiving-turkey--lil">🦃</span>
        <span className="tgiving-leaf">🍂</span>
      </div>

      {/* Bottom harvest strip (outside content column) */}
      <div className="tgiving-table">
        <span>🦃</span>
        <span>🥧</span>
        <span>🍞</span>
        <span>🍷</span>
        <span>🍂</span>
      </div>
    </div>
  );
}
