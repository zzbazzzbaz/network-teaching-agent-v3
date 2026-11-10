import { request } from './client';
import type {
  MaterialAssetCompleteResponse,
  MaterialAssetUploadUrlResponse,
  MaterialCollectionItem,
  MaterialCollectionKind,
  MaterialCollectionListResponse,
  MaterialNodeDetail,
  MaterialSearchResponse,
  MaterialTreeResponse,
} from './types';

export function getMaterialTree(): Promise<MaterialTreeResponse> {
  return request<MaterialTreeResponse>('/materials/tree');
}

export function getMaterialCollections(): Promise<MaterialCollectionListResponse> {
  return request<MaterialCollectionListResponse>('/materials/collections');
}

export function getMaterialNode(nodeId: string): Promise<MaterialNodeDetail> {
  return request<MaterialNodeDetail>(`/materials/nodes/${encodeURIComponent(nodeId)}`);
}

export function getMaterialNodeByPath(path: string): Promise<MaterialNodeDetail> {
  const search = new URLSearchParams({ path });
  return request<MaterialNodeDetail>(`/materials/nodes/by-path?${search.toString()}`);
}

export function searchMaterials(
  query: string,
  collectionId?: string,
  limit = 20,
): Promise<MaterialSearchResponse> {
  const search = new URLSearchParams({ q: query, limit: String(limit) });
  if (collectionId) {
    search.set('collection_id', collectionId);
  }
  return request<MaterialSearchResponse>(`/materials/search?${search.toString()}`);
}

export interface CreateMaterialCollectionPayload {
  slug: string;
  title: string;
  kind: MaterialCollectionKind;
  description?: string;
  sort_order?: number;
}

export interface UpdateMaterialCollectionPayload {
  title?: string;
  description?: string;
  sort_order?: number;
}

export function createMaterialCollection(
  payload: CreateMaterialCollectionPayload,
): Promise<MaterialCollectionItem> {
  return request<MaterialCollectionItem>('/admin/materials/collections', {
    method: 'POST',
    body: payload,
  });
}

export function updateMaterialCollection(
  collectionId: string,
  payload: UpdateMaterialCollectionPayload,
): Promise<MaterialCollectionItem> {
  return request<MaterialCollectionItem>(
    `/admin/materials/collections/${encodeURIComponent(collectionId)}`,
    { method: 'PATCH', body: payload },
  );
}

export function deleteMaterialCollection(collectionId: string): Promise<void> {
  return request<void>(`/admin/materials/collections/${encodeURIComponent(collectionId)}`, {
    method: 'DELETE',
  });
}

export interface CreateMaterialNodePayload {
  collection_id: string;
  parent_id?: string | null;
  name: string;
  content?: string | null;
  sort_order?: number;
}

export interface UpdateMaterialNodePayload {
  name?: string;
  content?: string | null;
  parent_id?: string | null;
  sort_order?: number;
}

export function createMaterialNode(
  payload: CreateMaterialNodePayload,
): Promise<MaterialNodeDetail> {
  return request<MaterialNodeDetail>('/admin/materials/nodes', {
    method: 'POST',
    body: payload,
  });
}

export function updateMaterialNode(
  nodeId: string,
  payload: UpdateMaterialNodePayload,
): Promise<MaterialNodeDetail> {
  return request<MaterialNodeDetail>(`/admin/materials/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function deleteMaterialNode(nodeId: string): Promise<void> {
  return request<void>(`/admin/materials/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'DELETE',
  });
}

export function reorderMaterialNodes(
  items: Array<{ id: string; sort_order: number }>,
): Promise<void> {
  return request<void>('/admin/materials/nodes/reorder', {
    method: 'POST',
    body: { items },
  });
}

export function requestMaterialAssetUploadUrl(
  nodeId: string,
  filename: string,
  sizeBytes: number,
): Promise<MaterialAssetUploadUrlResponse> {
  return request<MaterialAssetUploadUrlResponse>(
    `/admin/materials/nodes/${encodeURIComponent(nodeId)}/assets/upload-url`,
    {
      method: 'POST',
      body: { filename, size_bytes: sizeBytes },
    },
  );
}

export function completeMaterialAssetUpload(
  fileId: string,
): Promise<MaterialAssetCompleteResponse> {
  return request<MaterialAssetCompleteResponse>(
    `/admin/materials/assets/${encodeURIComponent(fileId)}/complete`,
    { method: 'POST' },
  );
}
