export type Activity = {
  uid: string;
  id: number;
  projectId: number;
  description: string;
  type: string;
  resource: string;
  sequence: string;
  legId?: number;
  start: string;
  end: string;
};

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function getActivities(): Promise<Activity[]> {
  return api<Activity[]>('/api/activities');
}

export async function updateActivity(uid: string, patch: Partial<Activity>): Promise<Activity> {
  return api<Activity>(`/api/activities/${uid}`, { method: 'PUT', body: JSON.stringify(patch) });
}
