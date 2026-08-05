"use client";

import { useMemo, useState } from "react";
import { getRulesForSport, type RuleLine } from "@/lib/rules";
import { getLeague } from "@/lib/league";

type Props = {
  /** Compact spacing for short/onboarding surfaces */
  compact?: boolean;
  /** Override sport (defaults to active league) */
  sportId?: string | null;
  /** Short onboarding subset */
  short?: boolean;
  /** Override Crystal Ball section visibility (defaults to league setting) */
  crystalBallEnabled?: boolean;
};

function lineText(line: RuleLine): string {
  return typeof line === "string" ? line : line.text;
}

function lineBold(line: RuleLine): boolean {
  return typeof line === "object" && !!line.bold;
}

export default function RulesContent({
  compact = false,
  sportId,
  short = false,
  crystalBallEnabled,
}: Props) {
  const [openExpand, setOpenExpand] = useState<string | null>(null);

  const { sections, thirtySecond } = useMemo(() => {
    const league = typeof window !== "undefined" ? getLeague() : null;
    const sid =
      sportId ?? league?.sportId ?? "cfb";
    const cb =
      typeof crystalBallEnabled === "boolean"
        ? crystalBallEnabled
        : league?.settings?.crystalBallEnabled !== false;
    return getRulesForSport(sid, {
      crystalBallEnabled: cb,
      short,
    });
  }, [sportId, short, crystalBallEnabled]);

  return (
    <div className={compact || short ? "space-y-4" : "space-y-6"}>
      {short && (
        <ul
          className={
            compact
              ? "list-none space-y-2 text-sm text-foreground leading-relaxed"
              : "list-none space-y-2 text-base text-foreground leading-relaxed"
          }
        >
          {thirtySecond.map((line) => {
            const text = lineText(line);
            const bold = lineBold(line);
            return (
              <li
                key={text.slice(0, 64)}
                className={bold ? "font-bold text-foreground" : "text-muted"}
              >
                {text}
              </li>
            );
          })}
        </ul>
      )}

      <ol className="space-y-4">
        {sections.map((section) => (
          <li
            key={section.title}
            className={
              section.callout
                ? "rounded-xl border-2 border-primary/60 bg-primary/10 p-3 sm:p-4 list-none -ml-0"
                : undefined
            }
          >
            <h3
              className={
                section.callout
                  ? compact || short
                    ? "text-sm font-bold text-primary mb-2"
                    : "text-base font-bold text-primary mb-2"
                  : compact || short
                    ? "text-sm font-semibold text-foreground mb-1.5"
                    : "text-base font-semibold text-foreground mb-2"
              }
            >
              {section.title}
            </h3>
            <ul
              className={
                compact || short
                  ? "list-disc pl-4 space-y-1.5 text-xs text-muted leading-relaxed"
                  : "list-disc pl-5 space-y-1.5 text-sm text-muted leading-relaxed"
              }
            >
              {section.body.map((line) => {
                const text = lineText(line);
                const bold = lineBold(line);
                return (
                  <li
                    key={text.slice(0, 64)}
                    className={
                      bold ? "font-semibold text-foreground" : undefined
                    }
                  >
                    {text}
                  </li>
                );
              })}
            </ul>

            {section.expand && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() =>
                    setOpenExpand((k) =>
                      k === section.title ? null : section.title
                    )
                  }
                  className="text-xs font-bold text-primary underline-offset-2 hover:underline min-h-[40px] touch-manipulation"
                  aria-expanded={openExpand === section.title}
                >
                  {openExpand === section.title
                    ? "Hide: "
                    : ""}
                  {section.expand.label}
                  {openExpand === section.title ? " ▴" : " ▾"}
                </button>
                {openExpand === section.title && (
                  <ul className="mt-2 list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-muted leading-relaxed">
                    {section.expand.body.map((t) => (
                      <li key={t.slice(0, 48)}>{t}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      {short && (
        <p className="text-sm text-muted leading-relaxed pt-1">
          Open{" "}
          <strong className="text-foreground">My Picks</strong>, fill the card,
          hit <strong className="text-foreground">Save Picks</strong> before
          first kickoff. Full survival guide anytime under{" "}
          <strong className="text-foreground">Rules</strong>.
        </p>
      )}
    </div>
  );
}
