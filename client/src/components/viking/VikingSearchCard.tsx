import React from "react";
import type { TFunction } from "i18next";

type Props = {
  t: TFunction;
  title?: string;
  subtitle?: string;
  showAllLabel?: string;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  suggestionTail: string;
  topSuggestion: string;
};

function VikingSearchCard({
  t,
  title,
  subtitle,
  showAllLabel,
  searchQuery,
  setSearchQuery,
  suggestionTail,
  topSuggestion
}: Props) {
  return (
    <section className="ui-card">
      <div className="ui-section-header">
        <h2 className="ui-section-title">
          {title || t("viking.findAssignmentsTitle")}
        </h2>
        <p className="ui-section-subtitle">
          {subtitle || t("viking.findAssignmentsSubtitle")}
        </p>
      </div>
      <div className="mt-5">
        <label className="ui-field">
          {t("viking.playerName")}
          <div className="ui-search">
            <input
              className="ui-input"
              name="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (!suggestionTail) return;
                if (event.key === "Tab" || event.key === "Enter") {
                  event.preventDefault();
                  setSearchQuery(topSuggestion);
                }
              }}
              placeholder={t("viking.searchPlaceholder")}
              autoComplete="off"
            />
            {suggestionTail && (
              <div className="ui-search-hint" aria-hidden="true">
                <span className="ui-search-hint-typed">{searchQuery}</span>
                <span className="ui-search-hint-tail">{suggestionTail}</span>
              </div>
            )}
          </div>
        </label>
        <div className="mt-3 flex items-center justify-end">
          <button
            className="ui-button-ghost ui-button-sm"
            type="button"
            onClick={() => setSearchQuery("")}
            disabled={!searchQuery.trim()}
            data-testid="viking-show-all"
          >
            {showAllLabel || t("viking.showAllAssignments")}
          </button>
        </div>
      </div>
    </section>
  );
}

export default VikingSearchCard;
