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

// ---------- Staff ----------
export type Staff = { id: number; name: string };

export async function getStaff(): Promise<Staff[]> {
  return api<Staff[]>('/api/staff');
}

export async function createStaff(name: string, id?: number): Promise<Staff> {
  return api<Staff>('/api/staff', { method: 'POST', body: JSON.stringify({ name, id }) });
}

// ---------- Assignments ----------
export type Assignment = {
  id: number;
  staffId: number;
  projectId: number;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  notes?: string;
};

export async function getAssignments(): Promise<Assignment[]> {
  return api<Assignment[]>('/api/assignments');
}

export async function updateAssignment(id: number, patch: Partial<Assignment>): Promise<Assignment> {
  return api<Assignment>(`/api/assignments/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
}

export async function createAssignment(a: Omit<Assignment, 'id'> & { id?: number }): Promise<Assignment> {
  return api<Assignment>('/api/assignments', { method: 'POST', body: JSON.stringify(a) });
}

export async function deleteAssignment(id: number): Promise<void> {
  await fetch(`/api/assignments/${id}`, { method: 'DELETE' });
}

