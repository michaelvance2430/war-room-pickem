import { RULES_INTRO, RULE_SECTIONS, type RuleLine } from "@/lib/rules";

type Props = {
  /** Compact spacing for the onboarding modal */
  compact?: boolean;
};

function lineText(line: RuleLine): string {
  return typeof line === "string" ? line : line.text;
}

function lineBold(line: RuleLine): boolean {
  return typeof line === "object" && !!line.bold;
}

export default function RulesContent({ compact = false }: Props) {
  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <p
        className={
          compact
            ? "text-sm text-muted leading-relaxed"
            : "text-base text-muted leading-relaxed"
        }
      >
        {RULES_INTRO}
      </p>

      <ol className="space-y-4">
        {RULE_SECTIONS.map((section) => (
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
                    key={text}
                    className={
                      bold
                        ? compact
                          ? "text-foreground font-bold text-xs leading-snug list-none -ml-4 pl-0 border-l-2 border-primary pl-3 my-2"
                          : "text-foreground font-bold text-sm leading-snug list-none -ml-5 pl-0 border-l-2 border-primary pl-3 my-2"
                        : undefined
                    }
                  >
                    {bold ? text : text}
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
