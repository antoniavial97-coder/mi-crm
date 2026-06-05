import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Guardar clientes de un usuario
export async function saveClientsToSupabase(userId: string, clients: unknown[]) {
  const { error } = await supabase
    .from("clients")
    .upsert({ user_id: userId, data: clients, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) console.error("Supabase save clients error:", error);
}

// Leer clientes de un usuario
export async function loadClientsFromSupabase(userId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("data")
    .eq("user_id", userId)
    .single();
  if (error || !data) return [];
  return (data.data as unknown[]) || [];
}

// Guardar tareas diarias
export async function saveDailyTasksToSupabase(userId: string, tasks: unknown[]) {
  const { error } = await supabase
    .from("daily_tasks")
    .upsert({ user_id: userId, data: tasks, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) console.error("Supabase save tasks error:", error);
}

// Leer tareas diarias
export async function loadDailyTasksFromSupabase(userId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("daily_tasks")
    .select("data")
    .eq("user_id", userId)
    .single();
  if (error || !data) return [];
  return (data.data as unknown[]) || [];
}

// Guardar recordatorios
export async function saveRemindersToSupabase(userId: string, reminders: unknown[]) {
  const { error } = await supabase
    .from("reminders")
    .upsert({ user_id: userId, data: reminders, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) console.error("Supabase save reminders error:", error);
}

// Leer recordatorios
export async function loadRemindersFromSupabase(userId: string): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select("data")
    .eq("user_id", userId)
    .single();
  if (error || !data) return [];
  return (data.data as unknown[]) || [];
}
