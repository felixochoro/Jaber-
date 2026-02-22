/**
 * Theme configuration and CSS injection.
 * Call applyTheme(tokens) in _app or layout to apply theme to :root.
 */
import { defaultTheme, envatoThemePlaceholder, ThemeTokens } from "./tokens";

export function mergeTheme(override: Partial<ThemeTokens>): ThemeTokens {
  return {
    ...defaultTheme,
    ...override,
    colors: { ...defaultTheme.colors, ...(override.colors || {}) },
    radii: { ...defaultTheme.radii, ...(override.radii || {}) },
    shadows: { ...defaultTheme.shadows, ...(override.shadows || {}) },
    spacing: { ...defaultTheme.spacing, ...(override.spacing || {}) },
    typography: { ...defaultTheme.typography, ...(override.typography || {}) },
  };
}

/** Returns the CSS variables string to inject into :root */
export function buildCssVars(tokens: ThemeTokens): Record<string, string> {
  const vars: Record<string, string> = {};

  Object.entries(tokens.colors.brand).forEach(([k, v]) => {
    vars[`--color-brand-${k}`] = v;
  });
  vars["--color-surface"]         = tokens.colors.surface;
  vars["--color-surface-raised"]  = tokens.colors.surfaceRaised;
  vars["--color-surface-overlay"] = tokens.colors.surfaceOverlay;
  vars["--color-text-primary"]    = tokens.colors.textPrimary;
  vars["--color-text-secondary"]  = tokens.colors.textSecondary;
  vars["--color-text-muted"]      = tokens.colors.textMuted;
  vars["--color-border"]          = tokens.colors.border;
  vars["--color-border-subtle"]   = tokens.colors.borderSubtle;
  vars["--font-sans"]             = tokens.typography.fontSans;
  vars["--font-mono"]             = tokens.typography.fontMono;
  vars["--radius-card"]           = tokens.radii.card;
  vars["--radius-btn"]            = tokens.radii.btn;
  vars["--spacing-panel"]         = tokens.spacing.panel;
  vars["--shadow-card"]           = tokens.shadows.card;
  vars["--shadow-panel"]          = tokens.shadows.panel;
  vars["--shadow-tooltip"]        = tokens.shadows.tooltip;

  return vars;
}

export function applyTheme(tokens: ThemeTokens, root: HTMLElement = document.documentElement) {
  const vars = buildCssVars(tokens);
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

// ── Active theme ──────────────────────────────────────────────────────────────
// To use an Envato theme: export const activeTheme = mergeTheme(envatoThemePlaceholder);
export const activeTheme: ThemeTokens = mergeTheme(envatoThemePlaceholder);
