import { ChevronDown, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  label: string;
};

export function SelectField({ value, options, onChange, label }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="select-field" ref={ref}>
      <span className="field-label">{label}</span>
      <button
        className="select-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={selected ? "select-value" : "select-placeholder"}>
          {selected?.label ?? "Select…"}
        </span>
        <ChevronDown aria-hidden="true" size={16} className={`select-chevron ${open ? "select-chevron-open" : ""}`} />
      </button>
      {open ? (
        <div className="select-popover" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              className={`select-option ${option.value === value ? "select-option-active" : ""}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value ? <Check aria-hidden="true" size={16} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
