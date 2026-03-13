import { useCallback, useEffect, useState } from "react";
import type { AllianceSettings } from "@shared/types";
import {
  formatDateTimeInputFromUtcIso,
  parseDateTimeInputToUtcIso
} from "../utils/time";

export type TimeMode = "local" | "utc";

type Params = {
  enabled: boolean;
  settings?: AllianceSettings;
  onChange?: () => void;
};

type AdminBearTimeState = {
  timeMode: TimeMode;
  setTimeMode: (next: TimeMode) => void;
  bear1Input: string;
  bear2Input: string;
  setBear1Input: (value: string) => void;
  setBear2Input: (value: string) => void;
  isDirty: boolean;
  markClean: () => void;
};

export function useAdminBearTimeSettings({
  enabled,
  settings,
  onChange
}: Params): AdminBearTimeState {
  const [timeMode, setTimeModeState] = useState<TimeMode>("local");
  const [bear1Input, setBear1InputState] = useState("");
  const [bear2Input, setBear2InputState] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const markClean = useCallback(() => setIsDirty(false), []);

  const setBear1Input = useCallback(
    (value: string) => {
      setBear1InputState(value);
      setIsDirty(true);
      onChange?.();
    },
    [onChange]
  );

  const setBear2Input = useCallback(
    (value: string) => {
      setBear2InputState(value);
      setIsDirty(true);
      onChange?.();
    },
    [onChange]
  );

  const setTimeMode = useCallback(
    (nextMode: TimeMode) => {
      if (nextMode === timeMode) return;
      const bear1Utc = parseDateTimeInputToUtcIso(bear1Input, timeMode);
      const bear2Utc = parseDateTimeInputToUtcIso(bear2Input, timeMode);
      setTimeModeState(nextMode);
      if (bear1Utc) {
        setBear1InputState(formatDateTimeInputFromUtcIso(bear1Utc, nextMode));
      }
      if (bear2Utc) {
        setBear2InputState(formatDateTimeInputFromUtcIso(bear2Utc, nextMode));
      }
      onChange?.();
    },
    [bear1Input, bear2Input, onChange, timeMode]
  );

  useEffect(() => {
    if (!enabled || isDirty) return;
    setBear1InputState(
      formatDateTimeInputFromUtcIso(settings?.bearNextTimes?.bear1, timeMode)
    );
    setBear2InputState(
      formatDateTimeInputFromUtcIso(settings?.bearNextTimes?.bear2, timeMode)
    );
  }, [enabled, isDirty, settings?.bearNextTimes?.bear1, settings?.bearNextTimes?.bear2, timeMode]);

  return {
    timeMode,
    setTimeMode,
    bear1Input,
    bear2Input,
    setBear1Input,
    setBear2Input,
    isDirty,
    markClean
  };
}
