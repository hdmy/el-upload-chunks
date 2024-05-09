export * from './auto-imports'

export declare global {
  interface Window {
    AJAX_CONTROLLER_MAP: Record<string, AbortController>
  }
}