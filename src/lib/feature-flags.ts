// Dev-time feature flags. Toggle here to re-enable.
// Login UI stays hidden for now (private app). Note: Gigi's real /api/chat
// needs a signed-in Supabase session, so Gigi shows an "unavailable" state
// until this is flipped back on.
export const SHOW_AUTH_UI = false;
