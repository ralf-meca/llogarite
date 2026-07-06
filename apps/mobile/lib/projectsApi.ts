import { API_BASE_URL } from './apiConfig';
import { authHeaders } from './authStorage';
import { apiFetch, describeHttpError } from './http';

export type Project = {
  id: string;
  name: string;
  details: string | null;
  budget: number;
  endDate: string | null;
};

export type ProjectInput = {
  name: string;
  details: string | null;
  budget: number;
  endDate: string | null;
};

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
