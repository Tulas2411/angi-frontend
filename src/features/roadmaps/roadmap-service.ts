import { api } from "@/shared/api/client";
import type {
  CreateRoadmapRequestDto,
  RoadmapDetailDto,
  UpdateRoadmapRequestDto,
} from "./roadmap-types";

export interface RoadmapPlanService {
  /** RM-01: 201 Created with the new RoadmapDetail. */
  create: (request: CreateRoadmapRequestDto) => Promise<RoadmapDetailDto>;
  /** RM-04: 200 OK with the updated RoadmapDetail. */
  update: (
    roadmapId: number,
    request: UpdateRoadmapRequestDto,
  ) => Promise<RoadmapDetailDto>;
}

export const roadmapService: RoadmapPlanService = {
  create: (request) => api.post<RoadmapDetailDto>("roadmaps", request),
  update: (roadmapId, request) =>
    api.patch<RoadmapDetailDto>(`roadmaps/${roadmapId}`, request),
};
