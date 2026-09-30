"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

const PREFIX = "novend.userFilters.v1";

export function useUserFilterPreferences<T>(
  namespace: string,
  userId: string | null,
  initialValue: T,
  validate: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const initialRef = useRef(initialValue);
  const validateRef = useRef(validate);
  validateRef.current = validate;
  const key = userId ? `${PREFIX}.${userId}.${namespace}` : null;
  const [value, setValue] = useState<T>(initialRef.current);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!key) {
      setValue(initialRef.current);
      setHydratedKey(null);
      return;
    }
    let next = initialRef.current;
    try {
      const raw = window.localStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (validateRef.current(parsed)) next = parsed;
    } catch {
      /* use defaults */
    }
    setValue(next);
    setHydratedKey(key);
  }, [key]);

  useEffect(() => {
    if (!key || hydratedKey !== key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* preferences are non-authoritative */
    }
  }, [key, hydratedKey, value]);

  return [value, setValue, hydratedKey === key];
}
