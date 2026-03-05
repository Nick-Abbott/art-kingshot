import React from "react";
import type { TFunction } from "i18next";
import type { Member } from "../../api/members";
import type { Profile } from "@shared/types";

type Props = {
  t: TFunction;
  members: Member[];
  profile: Profile | null;
  canManage: boolean;
  busy: boolean;
  profileWarning: string;
  error: string;
  onEdit: (member: Member) => void;
  onRemove: (playerId: string) => void;
  onRunAssignments: () => void;
  formatNumber: (value: number) => string;
};

function VikingRosterCard({
  t,
  members,
  profile,
  canManage,
  busy,
  profileWarning,
  error,
  onEdit,
  onRemove,
  onRunAssignments,
  formatNumber
}: Props) {
  return (
    <section className="ui-card" data-testid="viking-roster">
      <div className="ui-section-header">
        <h2 className="ui-section-title">{t("viking.rosterTitle")}</h2>
        <p className="ui-section-subtitle">{t("viking.rosterSubtitle")}</p>
      </div>
      <div className="mt-5 grid gap-3" data-testid="viking-roster-list">
        {members.length === 0 ? (
          <p className="ui-empty-state">{t("viking.noSignups")}</p>
        ) : (
          members.map((member) => (
            <div
              key={member.playerId}
              className="ui-card-muted flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between"
            >
              <div>
                <p className="font-semibold">
                  {member.playerName ? member.playerName : member.playerId}
                </p>
                <p className="text-sm text-muted">
                  {t("viking.troopsMeta", {
                    value: formatNumber(member.troopCount)
                  })}
                </p>
                <p className="text-sm text-muted">
                  {t("viking.powerMeta", { value: formatNumber(member.power) })}
                </p>
                <p className="text-sm text-muted">
                  {t("viking.marchesMeta", { value: member.marchCount })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="ui-button-ghost ui-button-sm"
                  type="button"
                  onClick={() => onEdit(member)}
                  disabled={busy || (!canManage && member.playerId !== profile?.playerId)}
                >
                  {t("viking.edit")}
                </button>
                <button
                  className="ui-button-ghost ui-button-sm"
                  type="button"
                  onClick={() => onRemove(member.playerId)}
                  disabled={busy || (!canManage && member.playerId !== profile?.playerId)}
                >
                  {t("viking.remove")}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {profileWarning && <p className="ui-error">{profileWarning}</p>}
      {error && <p className="ui-error">{error}</p>}
      <button
        className="ui-button-run mt-4"
        type="button"
        onClick={onRunAssignments}
        disabled={busy || !canManage}
      >
        {t("viking.runAssignments")}
      </button>
    </section>
  );
}

export default VikingRosterCard;
