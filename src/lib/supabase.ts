/**
 * The Supabase client — the ONLY file that knows how to reach the server.
 * Everything else goes through feature services (architecture rule #1: UI
 * never talks to Supabase directly, and neither do stores — services do).
 *
 * Config comes from .env (gitignored, see .env.example). EXPO_PUBLIC_* vars
 * are inlined into the JS bundle by Metro at build time — which also means
 * they are NOT secrets. The anon key is designed to ship inside client apps;
 * what protects the data is Row Level Security on the server, not key secrecy.
 *
 * If the env vars are missing the client is null and the app runs fully
 * local — same behavior as before Supabase existed. No config, no crash.
 */

import 'react-native-url-polyfill/auto'; // Hermes lacks a complete URL; supabase-js needs one

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        // No auth yet (Phase 4): don't persist sessions, so we also avoid the
        // AsyncStorage native dependency (and a dev-client rebuild) for now.
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export const isSyncConfigured = supabase !== null;
