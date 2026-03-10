export async function apiError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json();
    return new Error(body.error || `${fallback} (${res.status})`);
  } catch {
    return new Error(`${fallback} (${res.status})`);
  }
}
