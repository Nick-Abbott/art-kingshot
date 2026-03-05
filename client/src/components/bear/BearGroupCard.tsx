import React from "react";
import type { TFunction } from "i18next";
import type { Profile } from "@shared/types";

type BearMember = {
  playerId: string;
  playerName: string;
  rallySize: number;
};

type BearGroup = "bear1" | "bear2";

type Props = {
  t: TFunction;
  title: string;
  members: BearMember[];
  group: BearGroup;
  busy: boolean;
  canManage: boolean;
  profile: Profile | null;
  onReset: (bearGroup: BearGroup) => void;
  onEdit: (member: BearMember, bearGroup: BearGroup) => void;
  onRemove: (bearGroup: BearGroup, playerId: string) => void;
  formatNumber: (value: number) => string;
  resetLabel: string;
};

function BearGroupCard({
  t,
  title,
  members,
  group,
  busy,
  canManage,
  profile,
  onReset,
  onEdit,
  onRemove,
  formatNumber,
  resetLabel
}: Props) {
  return (
    <section className="ui-card">
      <div className="flex flex-col gap-4 nav:flex-row nav:items-start nav:justify-between">
        <div className="ui-section-header">
          <h2 className="ui-section-title">{title}</h2>
          <p className="ui-section-subtitle">{t("bear.sortedByRally")}</p>
        </div>
        <button
          className="ui-button ui-button-wide"
          data-testid={`bear-reset-${group}`}
          type="button"
          onClick={() => onReset(group)}
          disabled={busy || !canManage}
        >
          {resetLabel}
        </button>
      </div>
      <div className="mt-5 grid gap-3" data-testid={`${group}-list`}>
        {members.length === 0 ? (
          <p className="ui-empty-state">{t("bear.noSignups")}</p>
        ) : (
          members.map((member) => (
            <div
              key={member.playerId}
              className="ui-card-muted flex flex-col gap-3 nav:flex-row nav:items-center nav:justify-between"
            >
              <div>
                <p className="font-semibold">{member.playerName || member.playerId}</p>
                <p className="text-sm text-muted">
                  {t("bear.rallySizeMeta", { value: formatNumber(member.rallySize) })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="ui-button-ghost ui-button-sm"
                  type="button"
                  onClick={() => onEdit(member, group)}
                  disabled={busy || (!canManage && member.playerId !== profile?.playerId)}
                >
                  {t("bear.edit")}
                </button>
                <button
                  className="ui-button-ghost ui-button-sm"
                  type="button"
                  onClick={() => onRemove(group, member.playerId)}
                  disabled={busy || (!canManage && member.playerId !== profile?.playerId)}
                >
                  {t("bear.remove")}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default BearGroupCard;
