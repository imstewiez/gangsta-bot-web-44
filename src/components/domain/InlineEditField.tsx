import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface InlineEditFieldProps {
  value: number | string;
  onSave: (val: number | string) => void;
  type?: "number" | "text";
  className?: string;
  disabled?: boolean;
}

export function InlineEditField({
  value,
  onSave,
  type = "text",
  className = "",
  disabled = false,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const handleSave = () => {
    const saved = type === "number" ? Number(draft) : draft;
    onSave(saved);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(String(value));
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setEditing(true)}
        className={className}
      >
        {value}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        ref={inputRef}
        type={type}
        min={type === "number" ? 0 : undefined}
        className="h-5 w-20 text-right text-xs px-1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
      />
      <button
        type="button"
        className="text-emerald-400"
        onClick={handleSave}
      >
        <Check className="h-3 w-3" />
      </button>
      <button
        type="button"
        className="text-muted-foreground"
        onClick={handleCancel}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
