"use client";

import { useMemo } from "react";
import { getRulesForSport, type RuleLine } from "@/lib/rules";
import { getLeague } from "@/lib/league";

type Props = {
  /** Compact spacing for the onboarding modal */
  compact?: boolean;
  /** Override sport (defaults to active league) */
  sportId?: string | null;
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
}: Props) {
  const { intro, sections } = useMemo(() => {
    const sid =
      sportId ??
      (typeof window !== "undefined" ? getLeague()?.sportId : null) ??
      "cfb";
    return getRulesForSport(sid);
  }, [sportId]);

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <p
        className={
          compact
            ? "text-sm text-muted leading-relaxed"
            : "text-base text-muted leading-relaxed"
        }
      >
        {intro}
      </p>

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
                  ? compact
                    ? "text-sm font-bold text-primary mb-2"
                    : "text-base font-bold text-primary mb-2"
                  : compact
                    ? "text-sm font-semibold text-foreground mb-1.5"
                    : "text-base font-semibold text-foreground mb-2"
              }
            >
              {section.title}
            </h3>
            <ul
              className={
                compact
                  ? "list-disc pl-4 space-y-1.5 text-xs text-muted leading-relaxed"
                  : "list-disc pl-5 space-y-1.5 text-sm text-muted leading-relaxed"
              }
            >
              {section.body.map((line) => {
                const text = lineText(line);
                const bold = lineBold(line);
                return (
                  <li
                    key={text.slice(0, 48)}
                    className={bold ? "font-semibold text-foreground" : undefined}
                  >
                    {text}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
