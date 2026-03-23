import * as React from "react";
import { cn } from "../../lib/utils";

type FileInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  buttonLabel: string;
  placeholder?: string;
  onFileSelect?: (file: File | null) => void;
  resetKey?: number | string;
};

export function FileInput({
  buttonLabel,
  placeholder = "No file selected",
  onFileSelect,
  resetKey,
  className,
  id,
  disabled,
  ...props
}: FileInputProps) {
  const inputId = React.useId();
  const [fileName, setFileName] = React.useState("");

  const resolvedId = id || inputId;

  React.useEffect(() => {
    setFileName("");
  }, [resetKey]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    setFileName(file?.name ?? "");
    onFileSelect?.(file);
  };

  return (
    <div className={cn("flex flex-col gap-2 nav:flex-row nav:items-center", className)}>
      <input
        id={resolvedId}
        className="sr-only"
        type="file"
        key={resetKey}
        onChange={handleChange}
        disabled={disabled}
        {...props}
      />
      <label
        htmlFor={resolvedId}
        className={cn("ui-button ui-button-sm cursor-pointer", disabled && "opacity-60")}
      >
        {buttonLabel}
      </label>
      <input
        className="ui-input h-9 flex-1"
        type="text"
        readOnly
        value={fileName || ""}
        placeholder={placeholder}
        aria-live="polite"
      />
    </div>
  );
}
