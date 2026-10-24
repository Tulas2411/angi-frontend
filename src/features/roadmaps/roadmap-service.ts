import { api } from "@/shared/api/client";
import type {
  CreateRoadmapRequestDto,
  RoadmapDetailDto,
  RoadmapPageDto,
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

export interface RoadmapListService {
  /** RM-02: one page of the caller's roadmaps, newest first. `page` starts at 1. */
  list: (page: number, pageSize: number) => Promise<RoadmapPageDto>;
}

export const roadmapService: RoadmapPlanService & RoadmapListService = {
  create: (request) => api.post<RoadmapDetailDto>("roadmaps", request),
  update: (roadmapId, request) =>
    api.patch<RoadmapDetailDto>(`roadmaps/${roadmapId}`, request),
  list: (page, pageSize) =>
    api.get<RoadmapPageDto>(`roadmaps?page=${page}&pageSize=${pageSize}`),
};
