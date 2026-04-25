/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_DIRECTORY_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
