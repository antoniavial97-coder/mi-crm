import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Secret token to validate requests come from Make
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "solarity-crm-webhook-2026";

export async function POST(req: Request) {
  try {
    // Validate secret
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as {
      from: string;
      to: string;
      subject: string;
      body: string;
      date: string;
      companyName?: string;
    };

    const { from, to, subject, body: emailBody, date, companyName } = body;

    if (!from || !emailBody) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Normalize date to YYYY-MM-DD
    let fechaISO = date ? date.slice(0, 10) : new Date().toISOString().slice(0, 10);

    // Get all users' clients to find which client this email belongs to
    const { data: allUsers } = await supabase
      .from("clients")
      .select("user_id, data");

    if (!allUsers || allUsers.length === 0) {
      return NextResponse.json({ error: "No clients found" }, { status: 404 });
    }

    let matched = false;

    for (const userRow of allUsers) {
      const userId = userRow.user_id as string;
      const clients = userRow.data as Array<{
        id: string;
        companyName: string;
        contactName: string;
        meetings: Array<{
          id: string;
          date: string;
          type: string;
          subject?: string;
          notes?: string;
          fromDiio?: boolean;
          pending?: boolean;
        }>;
        [key: string]: unknown;
      }>;

      if (!Array.isArray(clients)) continue;

      // Try to match client by companyName hint, or by searching email domain
      const fromDomain = from.split("@")[1]?.toLowerCase() ?? "";
      const toDomain = to.split("@")[1]?.toLowerCase() ?? "";

      const client = clients.find(c => {
        const name = c.companyName.toLowerCase();
        // Match by explicit companyName if provided
        if (companyName && name.includes(companyName.toLowerCase())) return true;
        // Match by email domain vs company name keywords
        const domainBase = fromDomain.split(".")[0];
        if (domainBase && name.includes(domainBase)) return true;
        const domainBase2 = toDomain.split(".")[0];
        if (domainBase2 && name.includes(domainBase2)) return true;
        return false;
      });

      if (!client) continue;

      // Add email to client meetings
      const newMeeting = {
        id: `email-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        date: fechaISO,
        type: "correo",
        subject: subject || "(Sin asunto)",
        notes: `De: ${from}\nPara: ${to}\n\n${emailBody.substring(0, 2000)}`,
        fromDiio: false,
        pending: false,
      };

      const updatedClients = clients.map(c =>
        c.id === client.id
          ? { ...c, meetings: [...(c.meetings || []), newMeeting], updatedAtISO: fechaISO }
          : c
      );

      await supabase.rpc("upsert_clients", {
        p_user_id: userId,
        p_data: updatedClients,
        p_updated_at: new Date().toISOString(),
      });

      matched = true;
      return NextResponse.json({
        ok: true,
        message: `Email added to ${client.companyName}`,
        clientId: client.id,
        meetingId: newMeeting.id,
      });
    }

    if (!matched) {
      return NextResponse.json({
        ok: false,
        message: "No matching client found for this email",
      }, { status: 404 });
    }

  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// GET to verify webhook is alive
export async function GET() {
  return NextResponse.json({ ok: true, message: "Solarity CRM webhook active" });
}
