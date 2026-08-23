/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COMMUTE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
