import { Summary } from "../types";
import { Icon } from "./ui";
import { formatDate } from "../utils/formatters";

interface SummaryCardProps {
  summary: Summary;
}

const SECTION_ICONS: Record<string, string> = {
  investigated: "lucide:search",
  learned: "lucide:lightbulb",
  completed: "lucide:check-circle",
  next_steps: "lucide:arrow-right-circle",
};

export function SummaryCard({ summary }: SummaryCardProps) {
  const date = formatDate(summary.created_at_epoch);

  const sections = [
    { key: "investigated", label: "Investigated", content: summary.investigated },
    { key: "learned", label: "Learned", content: summary.learned },
    { key: "completed", label: "Completed", content: summary.completed },
    { key: "next_steps", label: "Next Steps", content: summary.next_steps },
  ].filter((section) => section.content);

  return (
    <article className="card summary-card">
      <header className="summary-card-header">
        <div className="summary-badge-row">
          <span className="card-type summary-badge">Session Summary</span>
          <span className="summary-project-badge">{summary.project}</span>
        </div>
        {summary.request && (
          <h2 className="summary-title">{summary.request}</h2>
        )}
      </header>

      <div className="summary-sections">
        {sections.map((section, index) => (
          <section
            key={section.key}
            className="summary-section"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="summary-section-header">
              <Icon
                icon={SECTION_ICONS[section.key]}
                size={18}
                className={`summary-section-icon summary-section-icon--${section.key}`}
              />
              <h3 className="summary-section-label">{section.label}</h3>
            </div>
            <div className="summary-section-content">
              {section.content}
            </div>
          </section>
        ))}
      </div>

      <footer className="summary-card-footer">
        <span className="summary-meta-id">Session #{summary.id}</span>
        <span className="summary-meta-divider">•</span>
        <time className="summary-meta-date" dateTime={new Date(summary.created_at_epoch).toISOString()}>
          {date}
        </time>
      </footer>
    </article>
  );
}
