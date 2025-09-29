// client/src/lib/api.ts

// ---------- Activities ----------
export type Activity = {
  uid: string;
  id: number;
  projectId: number;
  description: string;
  type: string;
  resource?: string;
  sequence?: string;
  durationDays?: number;
  finishedOn?: string; // YYYY-MM-DD
  start?: string;
  end?: string;
};

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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
export async function resequenceActivities(projectId: number, order: string[]): Promise<Activity[]> {
  return api<Activity[]>(`/api/activities/reseq`, { method: 'POST', body: JSON.stringify({ projectId, order }) });
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

// ---------- Time Entries ----------
export type TimeEntry = {
  id: number;
  activityUid: string;
  projectId: number;
  date: string;  // YYYY-MM-DD
  hours: number;
  staffId?: number;
  note?: string;
};

export async function getTimeEntriesByProject(projectId: number): Promise<TimeEntry[]> {
  return api<TimeEntry[]>(`/api/time-entries?projectId=${projectId}`);
}
export async function getTimeEntriesForActivity(activityUid: string): Promise<TimeEntry[]> {
  return api<TimeEntry[]>(`/api/time-entries?activityUid=${activityUid}`);
}
export async function createTimeEntry(e: Omit<TimeEntry, 'id'>): Promise<TimeEntry> {
  return api<TimeEntry>('/api/time-entries', { method: 'POST', body: JSON.stringify(e) });
}
export async function updateTimeEntry(id: number, patch: Partial<TimeEntry>): Promise<TimeEntry> {
  return api<TimeEntry>(`/api/time-entries/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
}
export async function deleteTimeEntry(id: number): Promise<void> {
  await fetch(`/api/time-entries/${id}`, { method: 'DELETE' });
}
export async function createActivity(a: Omit<Activity, "uid" | "id"> & Partial<Pick<Activity, "start" | "end">>): Promise<Activity> {
  const payload = {
    ...a,
    start: a.start ?? todayISO(),
    end: a.end ?? todayISO(),
  };
  return api<Activity>("/api/activities", { method: "POST", body: JSON.stringify(payload) });
}
