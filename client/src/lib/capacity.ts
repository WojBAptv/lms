// client/src/lib/capacity.ts
export type CapacityPoint = { bucketStart: string; available: number; needed: number };
export type CapacityForecast = { bucket: "day" | "week" | "month"; points: CapacityPoint[] };

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export function getCapacityForecast(params: { from: string; to: string; bucket: "day"|"week"|"month" }) {
  const qs = new URLSearchParams(params as Record<string,string>);
  return api<CapacityForecast>(`/api/capacity/forecast?${qs.toString()}`);
}

export function getCapacityRules() {
  return api(`/api/capacity/rules`);
}
