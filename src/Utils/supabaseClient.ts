import { createClient } from "@supabase/supabase-js";

// .env ফাইল থেকে ডাটাগুলো টেনে আনা হচ্ছে
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key are missing in .env file");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
