"use client";

import { useEffect, useRef } from "react";

export type BarcodeScanHandler = (code: string) => void;

type UseBarcodeScannerOptions = {
  /** When false, keystrokes are ignored. */
  enabled?: boolean;
  /** Minimum barcode length (default 4). */
  minLength?: number;
  /** Max gap between keystrokes before the buffer resets (ms). */
  interKeyTimeoutMs?: number;
  /**
   * When true, HID wedge keys are accepted while focus is in an editable
   * field that opts in via `data-barcode-capture` (search / barcode fields).
   * Money and quantity inputs must NOT opt in — otherwise numpad typing is
   * buffered as a scan and Enter is swallowed.
   */
  allowInInputs?: boolean;
  /** Stop listening after this many ms (product form one-shot capture). */
  timeoutMs?: number;
  onTimeout?: () => void;
};

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/** True when focus is in a field that intentionally accepts HID barcode wedges. */
function isBarcodeCaptureTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("[data-barcode-capture]"));
}

/**
 * Captures keyboard-wedge / HID barcode scanners.
 * Scanners type characters rapidly and end with Enter.
 * Native USB/serial/Bluetooth adapters will feed the same handler via desktop IPC later.
 */
export function useBarcodeScanner(
  onScan: BarcodeScanHandler,
  options: UseBarcodeScannerOptions = {},
) {
  const {
    enabled = true,
    minLength = 4,
    // HID wedges can pause >80ms when the main thread is busy (route remount /
    // Dexie catalog load). A slightly wider gap avoids truncated codes.
    interKeyTimeoutMs = 140,
    allowInInputs = true,
    timeoutMs,
    onTimeout,
  } = options;

  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);
  const onScanRef = useRef(onScan);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    function flush() {
      const code = bufferRef.current.trim();
      bufferRef.current = "";
      if (code.length >= minLength) {
        onScanRef.current(code);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const editable = isEditableTarget(event.target);
      if (editable) {
        if (!allowInInputs) return;
        // Checkout / discount / paid fields: let the physical numpad type normally.
        if (!isBarcodeCaptureTarget(event.target)) return;
      }

      const now = Date.now();
      if (now - lastKeyAtRef.current > interKeyTimeoutMs) {
        bufferRef.current = "";
      }
      lastKeyAtRef.current = now;

      if (event.key === "Enter") {
        if (bufferRef.current.length >= minLength) {
          event.preventDefault();
          flush();
        } else {
          bufferRef.current = "";
        }
        return;
      }

      // Accept printable keys from the top row and the numeric keypad.
      if (event.key.length === 1) {
        bufferRef.current += event.key;
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, minLength, interKeyTimeoutMs, allowInInputs]);

  useEffect(() => {
    if (!enabled || !timeoutMs || typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      bufferRef.current = "";
      onTimeoutRef.current?.();
    }, timeoutMs);
    return () => window.clearTimeout(timer);
  }, [enabled, timeoutMs]);
}
