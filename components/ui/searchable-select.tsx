"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type SearchableSelectOption = {
  value: string;
  label: string;
  keywords?: string;
  disabled?: boolean;
};

type Props = {
  options: SearchableSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
};

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No results found.",
  disabled,
  id,
  className,
  triggerClassName,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "border-input bg-card h-10 w-full justify-between px-3 font-normal shadow-sm",
              !selected && "text-muted-foreground",
              triggerClassName,
            )}
          >
            <span className="truncate">{selected?.label ?? placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-max min-w-[var(--radix-popover-trigger-width)] max-w-[min(28rem,calc(100vw-2rem))] p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} autoFocus />
            <CommandList className="max-h-72">
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.keywords ?? ""} ${option.value}`}
                    disabled={option.disabled}
                    className="items-start whitespace-normal"
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="break-words">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
