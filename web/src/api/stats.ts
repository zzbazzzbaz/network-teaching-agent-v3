import { request } from './client';
import type { MyStatsResponse } from './types';

export function getMyStats(days: number): Promise<MyStatsResponse> {
  return request<MyStatsResponse>(`/stats/me?days=${days}`);
}
