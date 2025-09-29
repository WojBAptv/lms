// client/src/lib/activityTypeColors.ts
export const ActivityTypeColors: Record<string, string> = {
  manpower: "bg-blue-500",
  equipment: "bg-amber-500",
  test: "bg-emerald-500",
  review: "bg-purple-500",
};

export function colorOf(type?: string) {
  if (!type) return "bg-slate-400";
  return ActivityTypeColors[type] ?? "bg-slate-400";
}
