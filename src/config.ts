/**
 * Build-time configuration (Vite env). Only VITE_-prefixed, non-secret values belong here: anything in
 * the frontend bundle is public. Never put service-role keys or private credentials in these variables.
 */
export const config = {
  /** Allow entering without an account. Set VITE_ENABLE_DEMO=false to require sign-in. */
  demoEnabled: import.meta.env.VITE_ENABLE_DEMO !== 'false',
  /** Reserved for a hosted auth provider (e.g. Supabase). Unused until an adapter is added. */
  authProvider: (import.meta.env.VITE_AUTH_PROVIDER as string | undefined) ?? 'local',
}
