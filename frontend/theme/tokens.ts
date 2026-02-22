/**
 * SchoolConnect Atlas — Design Token Definitions
 *
 * These tokens control the entire visual language of the app.
 * To swap to an Envato theme, replace the values in a custom ThemeConfig
 * and pass it to applyTheme() in theme/config.ts.
 *
 * CSS custom properties are injected at :root via applyTheme().
 */

export interface ThemeTokens {
  // Brand palette (primary action color, 50–900 scale)
  colors: {
    brand: Record<string, string>;
    surface:        string;
    surfaceRaised:  string;
    surfaceOverlay: string;
    textPrimary:    string;
    textSecondary:  string;
    textMuted:      string;
    border:         string;
    borderSubtle:   string;
  };
  typography: {
    fontSans: string;
    fontMono: string;
  };
  radii: {
    card: string;
    btn:  string;
  };
  spacing: {
    panel: string;
  };
  shadows: {
    card:    string;
    panel:   string;
    tooltip: string;
  };
  // Map style URL — can be a Mapbox style or a custom Envato-compatible style
  mapStyle: string;
}

/** Default (built-in) theme — deep blue/teal SaaS aesthetic */
export const defaultTheme: ThemeTokens = {
  colors: {
    brand: {
      "50":  "#eff6ff",
      "100": "#dbeafe",
      "200": "#bfdbfe",
      "300": "#93c5fd",
      "400": "#60a5fa",
      "500": "#3b82f6",
      "600": "#2563eb",
      "700": "#1d4ed8",
      "800": "#1e40af",
      "900": "#1e3a8a",
    },
    surface:        "#ffffff",
    surfaceRaised:  "#f8fafc",
    surfaceOverlay: "#f1f5f9",
    textPrimary:    "#0f172a",
    textSecondary:  "#475569",
    textMuted:      "#94a3b8",
    border:         "#e2e8f0",
    borderSubtle:   "#f1f5f9",
  },
  typography: {
    fontSans: "Inter, system-ui, sans-serif",
    fontMono: "'JetBrains Mono', monospace",
  },
  radii: {
    card: "0.75rem",
    btn:  "0.5rem",
  },
  spacing: {
    panel: "1.5rem",
  },
  shadows: {
    card:    "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    panel:   "0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)",
    tooltip: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
  },
  mapStyle: "mapbox://styles/mapbox/light-v11",
};

/**
 * ── ENVATO THEME ADAPTER ─────────────────────────────────────────────────────
 * Drop your Envato theme tokens here as a partial override.
 * Any unspecified keys fall back to defaultTheme.
 *
 * Example:
 *   export const envatoTheme: Partial<ThemeTokens> = {
 *     colors: {
 *       ...defaultTheme.colors,
 *       brand: { "500": "#your-brand-color", ... },
 *       surface: "#your-bg-color",
 *     },
 *     mapStyle: "mapbox://styles/mapbox/dark-v11",
 *   };
 *
 * Then in theme/config.ts: export const activeTheme = mergeTheme(envatoTheme);
 */
export const envatoThemePlaceholder: Partial<ThemeTokens> = {
  // ← Replace with your Envato theme tokens
};
