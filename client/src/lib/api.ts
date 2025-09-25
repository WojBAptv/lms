// client/src/lib/api.ts

// ---------- Activities ----------
export type Activity = {
  uid: string;
  id: number;
  projectId: number;
  description: string;
  type: string;
  resource: string;
  sequence: string;
  legId?: number;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
};

// Generic fetch helper
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) {
    // Try to surface server error message if present
    let detail = '';
    try { detail = await res.text(); } catch {}
    throw new Error(`${res.status} ${res.statusText}${detail ? `: ${detail}` : ''}`);
  }
  return res.json() as Promise<T>;
}

export async function getActivities(): Promise<Activity[]> {
  return api<Activity[]>('/api/activities');
}

export async function updateActivity(uid: string, patch: Partial<Activity>): Promise<Activity> {
  return api<Activity>(`/api/activities/${uid}`, { method: 'PUT', body: JSON.stringify(patch) });
}

// ---------- Programs / Projects ----------
export type Program = { id: number; name: string };
export type Project = { id: number; programId: number; name: string };

export async function getPrograms(): Promise<Program[]> {
  return api<Program[]>('/api/programs');
}

export async function getProjects(): Promise<Project[]> {
  return api<Project[]>('/api/projects');
}
