import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"

const SUPABASE_URL = "https://iuiqlqipndduvtryihux.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_xb-cLcDVYxcqsioXHimjTw_-uKqLdgX"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
