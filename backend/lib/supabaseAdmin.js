import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rclbxfpvjfonoqjrovup.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Service role client for backend operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get user from request token
export async function getUserFromRequest(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}
