import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function saveClientsToSupabase(userId: string, clients: unknown[]) {
  const { error } = await supabase.rpc("upsert_clients", {
    p_user_id: userId,
    p_data: clients,
    p_updated_at: new Date().toISOString(),
  });
  if (error) console.error("Supabase save clients error:", error);
}

export async function loadClientsFromSupabase(userId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("data")
    .eq("user_id", userId)
    .single();
  if (error || !data) return [];
  return (data.data as unknown[]) || [];
}

export async function saveDailyTasksToSupabase(userId: string, tasks: unknown[]) {
  const { error } = await supabase.rpc("upsert_daily_tasks", {
    p_user_id: userId,
    p_data: tasks,
    p_updated_at: new Date().toISOString(),
  });
  if (error) console.error("Supabase save tasks error:", error);
}

export async function loadDailyTasksFromSupabase(userId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("daily_tasks")
    .select("data")
    .eq("user_id", userId)
    .single();
  if (error || !data) return [];
  return (data.data as unknown[]) || [];
}

export async function saveRemindersToSupabase(userId: string, reminders: unknown[]) {
  const { error } = await supabase.rpc("upsert_reminders", {
    p_user_id: userId,
    p_data: reminders,
    p_updated_at: new Date().toISOString(),
  });
  if (error) console.error("Supabase save reminders error:", error);
}

export async function loadRemindersFromSupabase(userId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select("data")
    .eq("user_id", userId)
    .single();
  if (error || !data) return [];
  return (data.data as unknown[]) || [];
}
