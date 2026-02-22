import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function fmt(n: number | undefined | null, opts?: Intl.NumberFormatOptions): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", opts);
}

export function fmtCurrency(n: number | undefined | null): string {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function fmtKm(n: number | undefined | null): string {
  if (n == null) return "—";
  return `${n.toFixed(2)} km`;
}

export function fmtM(n: number | undefined | null): string {
  if (n == null) return "—";
  return `${n.toFixed(0)} m`;
}

export function distanceBand(km?: number | null): { label: string; color: string } {
  if (km == null) return { label: "Unknown", color: "#94a3b8" };
  if (km <= 1)    return { label: "≤ 1 km",   color: "#22c55e" };
  if (km <= 5)    return { label: "≤ 5 km",   color: "#84cc16" };
  if (km <= 10)   return { label: "≤ 10 km",  color: "#f59e0b" };
  if (km <= 20)   return { label: "≤ 20 km",  color: "#ef4444" };
  return           { label: "> 20 km",  color: "#7c3aed" };
}

export function facilityTypeColor(type?: string | null): string {
  const map: Record<string, string> = {
    "Primary School":   "#3b82f6",
    "Secondary School": "#8b5cf6",
    "College":          "#ec4899",
    "University":       "#f59e0b",
    "Health Post":      "#22c55e",
    "Health Centre":    "#14b8a6",
    "Hospital":         "#ef4444",
  };
  if (!type) return "#6b7280";
  return map[type] ?? "#6b7280";
}

export function ownerColor(owner?: string | null): string {
  const map: Record<string, string> = {
    "Airtel":   "#ef4444",
    "MTN":      "#f59e0b",
    "Zamtel":   "#22c55e",
    "Liquid":   "#3b82f6",
  };
  if (!owner) return "#6b7280";
  const key = Object.keys(map).find((k) => owner.toLowerCase().includes(k.toLowerCase()));
  return key ? map[key] : "#6b7280";
}

export function buildExportUrl(baseUrl: string, params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  });
  return `${baseUrl}?${qs.toString()}`;
}
