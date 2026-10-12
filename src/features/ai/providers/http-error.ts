/** Turns a failed provider response into a message the sidebar can show as-is. */
export async function responseError(provider: string, response: Response): Promise<Error> {
  if (response.status === 401 || response.status === 403) return new Error(`${provider}: invalid API key or no access to this model`);
  if (response.status === 429) return new Error(`${provider}: rate limited, try again shortly`);
  const text = await response.text().catch(() => "");
  return new Error(`${provider} error: ${response.status} ${text}`.trim());
}
