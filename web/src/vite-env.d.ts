/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_UPLOAD_MAX_BYTES?: string;
  readonly VITE_UPLOAD_MAX_COUNT?: string;
  readonly VITE_ENABLE_METRICS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
