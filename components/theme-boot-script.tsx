import { THEME_STORAGE_KEY } from "@/hooks/use-appearance";

/**
 * Nonced FOUC bootstrap for app/auth routes under nonce CSP.
 * Root ThemeProvider omits a nonce (static marketing); this script matches
 * the middleware nonce so dark/light class is applied before paint.
 */
export function ThemeBootScript({ nonce }: { nonce: string }) {
  const script = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="dark")document.documentElement.classList.add("dark");else document.documentElement.classList.remove("dark");}catch(e){}})();`;

  return (
    <script
      nonce={nonce}
      // Inline boot must run before paint; next/script would defer too late.
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
