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
  vikingInput: string;
  setBear1Input: (value: string) => void;
  setBear2Input: (value: string) => void;
  setVikingInput: (value: string) => void;
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
  const [vikingInput, setVikingInputState] = useState("");
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

  const setVikingInput = useCallback(
    (value: string) => {
      setVikingInputState(value);
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
      const vikingUtc = parseDateTimeInputToUtcIso(vikingInput, timeMode);
      setTimeModeState(nextMode);
      if (bear1Utc) {
        setBear1InputState(formatDateTimeInputFromUtcIso(bear1Utc, nextMode));
      }
      if (bear2Utc) {
        setBear2InputState(formatDateTimeInputFromUtcIso(bear2Utc, nextMode));
      }
      if (vikingUtc) {
        setVikingInputState(formatDateTimeInputFromUtcIso(vikingUtc, nextMode));
      }
      onChange?.();
    },
    [bear1Input, bear2Input, onChange, timeMode, vikingInput]
  );

  useEffect(() => {
    if (!enabled || isDirty) return;
    setBear1InputState(
      formatDateTimeInputFromUtcIso(settings?.bearNextTimes?.bear1, timeMode)
    );
    setBear2InputState(
      formatDateTimeInputFromUtcIso(settings?.bearNextTimes?.bear2, timeMode)
    );
    setVikingInputState(
      formatDateTimeInputFromUtcIso(settings?.vikingNextTime, timeMode)
    );
  }, [
    enabled,
    isDirty,
    settings?.bearNextTimes?.bear1,
    settings?.bearNextTimes?.bear2,
    settings?.vikingNextTime,
    timeMode
  ]);

  return {
    timeMode,
    setTimeMode,
    bear1Input,
    bear2Input,
    vikingInput,
    setBear1Input,
    setBear2Input,
    setVikingInput,
    isDirty,
    markClean
  };
}
