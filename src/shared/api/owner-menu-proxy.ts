/** Exact OWN-09..18 operations. Submit-for-review preserves its JSON body and 200 response. */
export function ownerMenuOperation(method: string, endpoint: string) {
  const base = "owner/restaurant/menu-submissions";
  if (method === "GET" && endpoint === "owner/restaurant/menu")
    return { body: false, status: 200 };
  if (
    method === "PUT" &&
    /^owner\/restaurant\/menu\/dishes\/[1-9]\d*\/availability$/.test(endpoint)
  )
    return { body: true, status: 200 };
  if (endpoint === base && (method === "GET" || method === "POST"))
    return { body: false, status: method === "POST" ? 201 : 200 };
  if (
    method === "GET" &&
    /^owner\/restaurant\/menu-submissions\/[1-9]\d*$/.test(endpoint)
  )
    return { body: false, status: 200 };
  if (
    method === "POST" &&
    /^owner\/restaurant\/menu-submissions\/[1-9]\d*\/submit$/.test(endpoint)
  )
    return { body: true, status: 200 };
  if (
    method === "POST" &&
    /^owner\/restaurant\/menu-submissions\/[1-9]\d*\/items$/.test(endpoint)
  )
    return { body: true, status: 201 };
  if (
    (method === "PATCH" || method === "DELETE") &&
    /^owner\/restaurant\/menu-submissions\/[1-9]\d*\/items\/[1-9]\d*$/.test(
      endpoint,
    )
  )
    return { body: method === "PATCH", status: 200 };
  if (
    method === "POST" &&
    /^owner\/restaurant\/menu-submissions\/[1-9]\d*\/cancel$/.test(endpoint)
  )
    return { body: false, status: 200 };
  return null;
}
