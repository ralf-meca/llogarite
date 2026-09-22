// Without this a stalled connection never settles, and a screen that shows a
// pending state while it waits sits there forever with nothing to report.
const REQUEST_TIMEOUT_MS = 20000;

export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch {
    throw new Error('Nuk ka lidhje me serverin. Kontrollo lidhjen e internetit.');
  } finally {
    clearTimeout(timeout);
  }
}

export function describeHttpError(
  status: number,
  overrides: Partial<Record<number, string>>,
  fallback: string,
): string {
  return overrides[status] ?? fallback;
}
