export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error('Nuk ka lidhje me serverin. Kontrollo lidhjen e internetit.');
  }
}

export function describeHttpError(
  status: number,
  overrides: Partial<Record<number, string>>,
  fallback: string,
): string {
  return overrides[status] ?? fallback;
}
