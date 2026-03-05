import React from "react";
import type { TFunction } from "i18next";

type BearForm = {
  rallySize: string;
  bearGroup: "bear1" | "bear2";
  playerName: string;
};

type AdminOption = {
  playerId: string;
  playerName: string;
};

type Props = {
  t: TFunction;
  canManage: boolean;
  editingMember: { playerId: string; bearGroup: "bear1" | "bear2" } | null;
  adminOptions: AdminOption[];
  adminTargetId: string;
  form: BearForm;
  busy: boolean;
  lookupStatus: string;
  profileWarning: string;
  error: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onAdminTargetChange: (value: string) => void;
  onSetForm: (next: BearForm) => void;
  onCancelEdit: () => void;
  formatNumber: (value: number) => string;
  formatNumberInput: (value: string) => string;
};

function BearSignupCard({
  t,
  canManage,
  editingMember,
  adminOptions,
  adminTargetId,
  form,
  busy,
  lookupStatus,
  profileWarning,
  error,
  onSubmit,
  onAdminTargetChange,
  onSetForm,
  onCancelEdit,
  formatNumber,
  formatNumberInput
}: Props) {
  return (
    <section className="ui-card">
      <div className="ui-section-header">
        <h2 className="ui-section-title">
          {editingMember ? t("bear.editSignupTitle") : t("bear.signupTitle")}
        </h2>
        <p className="ui-section-subtitle">
          {editingMember ? t("bear.editSignupSubtitle") : t("bear.signupSubtitle")}
        </p>
      </div>
      <form
        className="mt-5 flex flex-col gap-4 nav:grid nav:grid-cols-[repeat(2,minmax(0,1fr))_auto] nav:items-end"
        onSubmit={onSubmit}
      >
        {canManage && (
          <label className="ui-field nav:col-span-3">
            {t("bear.adminMemberLabel")}
            <select
              className="ui-select"
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
          {t("bear.rallySize")}
          <input
            className="ui-input"
            name="rallySize"
            value={form.rallySize}
            onChange={(e) => onSetForm({ ...form, rallySize: formatNumberInput(e.target.value) })}
            inputMode="numeric"
            placeholder={formatNumber(500000)}
            required
          />
        </label>
        <label className="ui-field">
          {t("bear.bearGroup")}
          <select
            className="ui-select"
            name="bearGroup"
            value={form.bearGroup}
            onChange={(e) =>
              onSetForm({ ...form, bearGroup: e.target.value as "bear1" | "bear2" })
            }
            required
          >
            <option value="bear1">{t("bear.bear1")}</option>
            <option value="bear2">{t("bear.bear2")}</option>
          </select>
        </label>
        <button
          className="ui-button ui-button-wide mt-2 nav:mt-0 nav:justify-self-end"
          type="submit"
          disabled={busy}
        >
          {editingMember ? t("bear.update") : t("bear.register")}
        </button>
      </form>
      {lookupStatus && <span className="ui-field-hint mt-3">{lookupStatus}</span>}
      {editingMember && (
        <button className="ui-button-ghost mt-3" type="button" onClick={onCancelEdit}>
          {t("bear.cancelEdit")}
        </button>
      )}
      {profileWarning && <p className="ui-error">{profileWarning}</p>}
      {error && <p className="ui-error">{error}</p>}
    </section>
  );
}

export default BearSignupCard;
