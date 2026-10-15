export interface Province {
  name: string;
}

/** Keep provider metadata out of the form and preserve official province names. */
export function readProvinceCatalog(payload: unknown): Province[] {
  if (!Array.isArray(payload) || !payload.length)
    throw new Error("Invalid province catalog.");
  const names = new Set<string>();
  for (const item of payload) {
    if (
      !item ||
      typeof item !== "object" ||
      !("name" in item) ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      item.name.trim().length > 100
    )
      throw new Error("Invalid province catalog.");
    names.add(item.name.trim());
  }
  return [...names]
    .sort((left, right) => left.localeCompare(right, "vi"))
    .map((name) => ({ name }));
}
