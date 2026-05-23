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
        "flex items-center gap-1.5 rounded-sm border-l-2 px-2 py-1 mb-0.5",
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
  group?: string;
  groupColor?: string;
};

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Seleciona...",
  searchPlaceholder = "Procurar...",
  emptyText = "Nenhum resultado.",
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const selected = options.find((o) => o.value === value);

  // Group options
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
            opt.value.toLowerCase().includes(query),
        );
        return [groupName, filtered] as [string, Option[]];
      })
      .filter(([, opts]) => opts.length > 0);
  }, [groups, query]);

  const hasResults = filteredGroups.some(([, opts]) => opts.length > 0);

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
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between bg-transparent font-normal",
            className,
          )}
        >
          {selected ? selected.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-full p-0 max-h-[320px] overflow-y-auto"
        align="start"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {/* Search input */}
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

        {/* Options list */}
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
                    <div>
                      {groupOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            onChange(opt.value);
                            setOpen(false);
                            setSearch("");
                          }}
                          className={cn(
                            "relative flex w-full cursor-pointer gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                            value === opt.value && "bg-accent text-accent-foreground",
                          )}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              value === opt.value
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div key="__ungrouped">
                    {groupOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          onChange(opt.value);
                          setOpen(false);
                          setSearch("");
                        }}
                        className={cn(
                          "relative flex w-full cursor-pointer gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                          value === opt.value && "bg-accent text-accent-foreground",
                        )}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0",
                            value === opt.value
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
