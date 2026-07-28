import { RULES_INTRO, RULE_SECTIONS } from "@/lib/rules";

type Props = {
  /** Compact spacing for the onboarding modal */
  compact?: boolean;
};

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
          <li key={section.title}>
            <h3
              className={
                compact
                  ? "text-sm font-semibold text-foreground mb-1.5"
                  : "text-base font-semibold text-foreground mb-2"
              }
            >
              {section.title}
            </h3>
            <ul
              className={
                compact
                  ? "list-disc pl-4 space-y-1 text-xs text-muted leading-relaxed"
                  : "list-disc pl-5 space-y-1.5 text-sm text-muted leading-relaxed"
              }
            >
              {section.body.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
