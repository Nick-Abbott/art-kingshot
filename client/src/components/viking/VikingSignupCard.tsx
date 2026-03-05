import React from "react";
import type { TFunction } from "i18next";

type AdminOption = {
  playerId: string;
  playerName: string;
};

type VikingForm = {
  troopCount: string;
  playerName: string;
  marchCount: string;
  power: string;
};

type Props = {
  t: TFunction;
  canManage: boolean;
  editingMember: string | null;
  adminOptions: AdminOption[];
  adminTargetId: string;
  form: VikingForm;
  busy: boolean;
  lookupStatus: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onAdminTargetChange: (value: string) => void;
  onUpdateForm: (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onUpdatePower: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUpdateTroopCount: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCancelEdit: () => void;
  formatNumber: (value: number) => string;
};

function VikingSignupCard({
  t,
  canManage,
  editingMember,
  adminOptions,
  adminTargetId,
  form,
  busy,
  lookupStatus,
  onSubmit,
  onAdminTargetChange,
  onUpdateForm,
  onUpdatePower,
  onUpdateTroopCount,
  onCancelEdit,
  formatNumber
}: Props) {
  return (
    <section className="ui-card">
      <div className="ui-section-header">
        <h2 className="ui-section-title">
          {editingMember ? t("viking.editSignupTitle") : t("viking.signupTitle")}
        </h2>
        <p className="ui-section-subtitle">
          {editingMember ? t("viking.editSignupSubtitle") : t("viking.signupSubtitle")}
        </p>
      </div>
      <form
        className="mt-5 flex flex-col gap-4 nav:grid nav:grid-cols-[repeat(3,minmax(0,1fr))_auto] nav:items-end"
        onSubmit={onSubmit}
      >
        {canManage && (
          <label className="ui-field nav:col-span-4">
            {t("viking.adminMemberLabel")}
            <select
              className="ui-select"
              data-testid="viking-admin-member-select"
              value={adminTargetId}
              onChange={(event) => onAdminTargetChange(event.target.value)}
            >
              {adminOptions.map((member) => (
                <option key={member.playerId} value={member.playerId}>
                  {member.playerName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="ui-field">
          {t("viking.marchCount")}
          <input
            className="ui-input"
            data-testid="viking-march-count"
            name="marchCount"
            value={form.marchCount}
            onChange={onUpdateForm}
            type="number"
            min="4"
            max="6"
            required
          />
        </label>
        <label className="ui-field">
          {t("viking.power")}
          <input
            className="ui-input"
            data-testid="viking-power"
            name="power"
            value={form.power}
            onChange={onUpdatePower}
            inputMode="numeric"
            placeholder={formatNumber(33000000)}
            required
          />
        </label>
        <label className="ui-field">
          {t("viking.troopCount")}
          <input
            className="ui-input"
            data-testid="viking-troop-count"
            name="troopCount"
            value={form.troopCount}
            onChange={onUpdateTroopCount}
            inputMode="numeric"
            placeholder={formatNumber(450000)}
            required
          />
        </label>
        <button
          className="ui-button ui-button-wide mt-2 nav:mt-0 nav:justify-self-end"
          data-testid="viking-save-signup"
          type="submit"
          disabled={busy}
        >
          {editingMember ? t("viking.update") : t("viking.saveSignup")}
        </button>
      </form>
      {lookupStatus && <span className="ui-field-hint mt-3">{lookupStatus}</span>}
      {editingMember && (
        <button className="ui-button-ghost mt-3" type="button" onClick={onCancelEdit}>
          {t("viking.cancelEdit")}
        </button>
      )}
    </section>
  );
}

export default VikingSignupCard;
