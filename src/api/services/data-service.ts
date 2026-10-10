import type { AppData, DataService } from "@/features/platform/contracts";
import { initialData } from "@/mocks/fixtures";

export class UnavailableContractError extends Error {
  constructor() {
    super(
      "Nghiệp vụ này chưa có hợp đồng API trong repository. Dữ liệu thực chưa khả dụng.",
    );
  }
}
/** Each provider owns its demo repository; it never writes to backend/session APIs. */
export function createDemoService(): DataService {
  let data = structuredClone(initialData);
  return {
    mode: "demo",
    async load() {
      return structuredClone(data);
    },
    async save(next: AppData) {
      data = structuredClone(next);
      return structuredClone(data);
    },
  };
}
export const liveService: DataService = {
  mode: "live",
  async load() {
    throw new UnavailableContractError();
  },
  async save() {
    throw new UnavailableContractError();
  },
};
