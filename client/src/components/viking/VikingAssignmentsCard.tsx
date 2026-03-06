import React from "react";
import type { TFunction } from "i18next";
import type { AssignmentResult } from "../../api/assignments";

type AssignmentMember = AssignmentResult["members"][number];

type Props = {
  t: TFunction;
  results: AssignmentResult | null;
  members: AssignmentMember[];
  formatNumber: (value: number) => string;
  showAdvancedDetails: boolean;
  onToggleAdvancedDetails: () => void;
};

function VikingAssignmentsCard({
  t,
  results,
  members,
  formatNumber,
  showAdvancedDetails,
  onToggleAdvancedDetails
}: Props) {
  return (
    <section className="ui-card">
      <div className="ui-section-header">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="ui-section-title">{t("viking.assignmentsTitle")}</h2>
          <button
            className="ui-button-ghost ui-button-sm"
            type="button"
            onClick={onToggleAdvancedDetails}
            aria-expanded={showAdvancedDetails}
            aria-pressed={showAdvancedDetails}
            data-testid="viking-advanced-details-toggle"
          >
            {t("viking.advancedDetailsLabel")}
            <span className="ml-2 inline-block w-3 text-center">
              {showAdvancedDetails ? "^" : "v"}
            </span>
          </button>
        </div>
        <p className="ui-section-subtitle">{t("viking.assignmentsSubtitle")}</p>
      </div>
      {!results ? (
        <p className="ui-empty-state">{t("viking.noAssignments")}</p>
      ) : (
        <div className="mt-5 grid gap-4 nav:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
          {members.map((member) => (
            <article key={member.playerId} className="ui-card-muted">
              <header className="space-y-1">
                <h3 className="text-lg font-semibold">
                  {member.playerName ? member.playerName : member.playerId}
                </h3>
                {showAdvancedDetails && (
                  <>
                    <p className="text-sm text-muted">
                      {t("viking.troopsOutgoing", {
                        value: formatNumber(member.troopCount)
                      })}
                    </p>
                    <p className="font-semibold text-ink">
                      {t("viking.incoming", {
                        value: formatNumber(member.incomingTotal)
                      })}
                    </p>
                    <p className="font-semibold text-ink">
                      {t("viking.troopsRemaining", {
                        value: formatNumber(member.troopsRemaining || 0)
                      })}
                    </p>
                  </>
                )}
                {member.garrisonLeadId ? (
                  <p className="font-semibold text-accent-dark">
                    {t("viking.garrisonLead", { name: member.garrisonLeadName })}
                  </p>
                ) : (
                  <p className="text-sm text-muted">{t("viking.garrisonNone")}</p>
                )}
              </header>
              <div className="mt-3">
                <h4 className="text-sm font-semibold">{t("viking.sendTroopsTo")}</h4>
                <ul className="mt-2 grid gap-2 text-sm">
                  {member.outgoing.map((item, index) => (
                    <li key={`${member.playerId}-out-${index}`}>
                      {(item.toName || item.toId)}
                      {showAdvancedDetails ? ` — ${formatNumber(item.troops)}` : ""}{" "}
                      {item.lead ? (
                        <span className="ml-2 inline-flex rounded-md bg-accent/15 px-2 py-0.5 text-[0.65rem] font-semibold text-accent-dark">
                          {t("viking.lead")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3">
                <h4 className="text-sm font-semibold">{t("viking.receivingFrom")}</h4>
                <ul className="mt-2 grid gap-2 text-sm">
                  {member.incoming.map((item, index) => (
                    <li key={`${member.playerId}-in-${index}`}>
                      {(item.fromName || item.fromId)}
                      {showAdvancedDetails ? ` — ${formatNumber(item.troops)}` : ""}{" "}
                      {item.lead ? (
                        <span className="ml-2 inline-flex rounded-md bg-accent/15 px-2 py-0.5 text-[0.65rem] font-semibold text-accent-dark">
                          {t("viking.lead")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default VikingAssignmentsCard;
