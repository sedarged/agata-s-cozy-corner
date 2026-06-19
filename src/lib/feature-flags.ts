// Dev-time feature flags. Toggle here to re-enable.
// Auth UI is on so users can sign in (required for Gigi's real /api/chat, which
// authenticates with a Supabase token). The app still works in local mode for
// everything else when signed out.
export const SHOW_AUTH_UI = true;
