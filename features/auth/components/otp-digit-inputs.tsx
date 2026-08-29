"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
};

const LENGTH = 6;

export function OtpDigitInputs({
  value,
  onChange,
  disabled = false,
  autoFocus = true,
  "aria-label": ariaLabel = "Verification code",
}: Props) {
  const digits = Array.from({ length: LENGTH }, (_, index) => value[index] ?? "");
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function focusIndex(index: number) {
    refs.current[Math.max(0, Math.min(LENGTH - 1, index))]?.focus();
  }

  function setDigit(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) {
      const next = digits.map((digit, i) => (i === index ? "" : digit)).join("");
      onChange(next);
      return;
    }
    if (cleaned.length > 1) {
      const pasted = cleaned.slice(0, LENGTH);
      onChange(pasted);
      focusIndex(Math.min(LENGTH - 1, pasted.length));
      return;
    }
    const next = digits.map((digit, i) => (i === index ? cleaned : digit)).join("");
    onChange(next);
    if (index < LENGTH - 1) focusIndex(index + 1);
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label={ariaLabel}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={`Digit ${index + 1}`}
          className={cn(
            "border-input bg-muted/50 text-foreground h-12 w-10 rounded-lg border text-center text-lg font-semibold tabular-nums shadow-sm sm:h-14 sm:w-11",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
          onChange={(event) => setDigit(index, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Backspace") {
              event.preventDefault();
              if (digits[index]) {
                onChange(digits.map((item, i) => (i === index ? "" : item)).join(""));
                return;
              }
              focusIndex(index - 1);
              onChange(digits.map((item, i) => (i === index - 1 ? "" : item)).join(""));
            }
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              focusIndex(index - 1);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              focusIndex(index + 1);
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
            if (!pasted) return;
            onChange(pasted);
            focusIndex(Math.min(LENGTH - 1, pasted.length));
          }}
        />
      ))}
    </div>
  );
}
