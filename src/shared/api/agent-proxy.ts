/** Exact AGENT-01..04 operations. No caller-controlled upstream paths. */
export function agentOperation(method: string, endpoint: string) {
  if (method === "POST" && endpoint === "agent/conversations")
    return { status: 201, timeoutMs: 10000 };
  const id = "[1-9]\\d{0,17}";
  if (
    method === "GET" &&
    new RegExp(`^agent/conversations/${id}$`).test(endpoint)
  )
    return { status: 200, timeoutMs: 10000 };
  if (
    method === "POST" &&
    new RegExp(`^agent/conversations/${id}/(messages|confirm)$`).test(endpoint)
  )
    return { status: 200, timeoutMs: 65000 };
  return null;
}
