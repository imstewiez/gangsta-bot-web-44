"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/domain/ItemIcon";
import { ARMORY_CAT_CONFIG } from "@/lib/armory.catalog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function findCatKeyByLabel(label: string): string {
  for (const [key, cfg] of Object.entries(ARMORY_CAT_CONFIG)) {
    if (cfg.label === label) return key;
  }
  return "outros";
}

function GroupHeader({ label }: { label: string }) {
  const catKey = findCatKeyByLabel(label);
  const cfg = ARMORY_CAT_CONFIG[catKey as keyof typeof ARMORY_CAT_CONFIG];
  return (
    <div
      className={cn(
        "mb-0.5 flex items-center gap-1.5 rounded-sm border-l-2 px-2 py-1",
        cfg?.bg ?? "bg-muted/30",
        cfg?.border ? cfg.border.replace("border", "border-l") : "border-l-border",
        cfg?.headerColor ?? "text-muted-foreground",
      )}
    >
      <CategoryIcon category={catKey} size={14} />
      <span className="text-[11px] font-semibold uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

type Option = {
  value: string;
  label: string;
  description?: string;
  group?: string;
  groupColor?: string;
};

type SearchableSelectProps = {
  value: string;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
};

export function SearchableSelect({
  value,
  onChange,
  onValueChange,
  options,
  placeholder = "Seleciona...",
  searchPlaceholder = "Procurar...",
  emptyText = "Nenhum resultado.",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const selected = options.find((o) => o.value === value);
  const emitChange = React.useCallback(
    (nextValue: string) => {
      onValueChange?.(nextValue);
      onChange?.(nextValue);
      setOpen(false);
      setSearch("");
    },
    [onChange, onValueChange],
  );

  const groups = React.useMemo(() => {
    const map = new Map<string, Option[]>();
    for (const opt of options) {
      const key = opt.group || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(opt);
    }
    return Array.from(map.entries());
  }, [options]);

  const query = search.trim().toLowerCase();

  const filteredGroups = React.useMemo(() => {
    if (!query) return groups;
    return groups
      .map(([groupName, groupOptions]) => {
        const filtered = groupOptions.filter(
          (opt) =>
            opt.label.toLowerCase().includes(query) ||
            opt.value.toLowerCase().includes(query) ||
            opt.description?.toLowerCase().includes(query),
        );
        return [groupName, filtered] as [string, Option[]];
      })
      .filter(([, opts]) => opts.length > 0);
  }, [groups, query]);

  const hasResults = filteredGroups.some(([, opts]) => opts.length > 0);

  const renderOption = (opt: Option) => (
    <button
      key={opt.value}
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => emitChange(opt.value)}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground",
        value === opt.value && "bg-accent text-accent-foreground",
      )}
    >
      <Check
        className={cn(
          "h-4 w-4 shrink-0",
          value === opt.value ? "opacity-100" : "opacity-0",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{opt.label}</span>
        {opt.description && <span className="block truncate text-[11px] text-muted-foreground">{opt.description}</span>}
      </span>
    </button>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between bg-transparent font-normal",
            className,
          )}
        >
          <span className="min-w-0 truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[80] max-h-[320px] w-[var(--radix-popover-trigger-width)] overflow-y-auto p-0"
        align="start"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex h-8 w-full rounded-md bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setSearch("");
              }
            }}
          />
        </div>

        <div>
          {!hasResults ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {emptyText}
            </div>
          ) : (
            <div className="p-1">
              {filteredGroups.map(([groupName, groupOptions]) =>
                groupName ? (
                  <div key={groupName} className="mb-1">
                    <GroupHeader label={groupName} />
                    <div>{groupOptions.map(renderOption)}</div>
                  </div>
                ) : (
                  <div key="__ungrouped">{groupOptions.map(renderOption)}</div>
                ),
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
