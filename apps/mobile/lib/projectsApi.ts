import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';
import type { InvoiceVerificationResult } from './invoiceApi';

export type Project = {
  id: string;
  // Who created it. Buddies see the project too but cannot change it, so the
  // screens need to know which side of that they are on.
  userId: string;
  name: string;
  details: string | null;
  budget: number;
  endDate: string | null;
  buddyIds: string[];
};

export type ProjectInput = {
  name: string;
  details: string | null;
  budget: number;
  endDate: string | null;
  buddyIds: string[];
};

// One expense on a shared project, with whoever entered it attached.
export type ProjectExpense = {
  id: string;
  createdAt: string;
  data: InvoiceVerificationResult;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string;
};

export async function fetchProjectExpenses(projectId: string): Promise<ProjectExpense[]> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/expenses`, {
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Leximi i shpenzimeve dështoi.'));
  }
  return response.json();
}

// Settles every share on the caller's own expenses in this project. The server
// ignores anyone else's, since only the person who paid can say they were
// repaid.
export async function markProjectPaid(projectId: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/mark-paid`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Ruajtja dështoi. Provo përsëri.'));
  }
}

export async function fetchProjects(): Promise<Project[]> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/projects`, { headers: await authHeaders() });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Marrja e projekteve dështoi. Provo përsëri.'));
  }
  return response.json();
}

export async function createProject(data: ProjectInput): Promise<Project> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(describeHttpError(response.status, {}, 'Shtimi i projektit dështoi. Provo përsëri.'));
  }
  return response.json();
}

export async function updateProject(id: string, patch: Partial<ProjectInput>): Promise<Project> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'PATCH',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(
      describeHttpError(response.status, { 404: 'Projekti nuk u gjet.' }, 'Ndryshimi i projektit dështoi. Provo përsëri.'),
    );
  }
  return response.json();
}

export async function deleteProject(id: string): Promise<void> {
  if (!API_BASE_URL) {
    throw new Error('Serveri nuk është i konfiguruar.');
  }
  const response = await apiFetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!response.ok) {
    throw new Error(
      describeHttpError(response.status, { 404: 'Projekti nuk u gjet.' }, 'Fshirja e projektit dështoi. Provo përsëri.'),
    );
  }
}
