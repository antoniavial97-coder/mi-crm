"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

type Stage =
  | "Contacto"
  | "Prospecto Pasivo"
  | "Prospecto Activo"
  | "Pipeline P1"
  | "Pipeline P2";

type SubStage =
  | "Evaluación preliminar"
  | "Primera presentación preliminar"
  | "Visita técnica realizada"
  | "Evaluación final"
  | "Presentación final"
  | "Contrato en revisión"
  | "Contrato firmado";

type ClientTask = { id: string; text: string; done: boolean };

type ClientRecord = {
  id: string;
  companyName: string;
  contactName: string;
  stage: Stage;
  subStage?: SubStage;
  mwp: number;
  closeProbabilityPct: number;
  lastContactISO: string;
  nextAction: string;
  notes: string;
  aiTasks: ClientTask[];
  createdAtISO: string;
  updatedAtISO: string;
};

const DEFAULT_PROB_P1 = 15;
const DEFAULT_PROB_P2 = 7.5;
const LOCAL_STORAGE_KEY = "solar-crm:v2";

// URL CSV de tu Google Sheet (publicada como CSV)
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1-e7hMzSeyP9MhR3PKPs2KKYp-bnwFziHfxyrK6dnXFU/export?format=csv&gid=0";

// Probabilidad automática por sub-etapa
const SUBSTAGE_PROB: Record<SubStage, number> = {
  "Evaluación preliminar": 10,
  "Primera presentación preliminar": 20,
  "Visita técnica realizada": 35,
  "Evaluación final": 50,
  "Presentación final": 65,
  "Contrato en revisión": 85,
  "Contrato firmado": 100,
};

const STAGES: Stage[] = [
  "Contacto",
  "Prospecto Pasivo",
  "Prospecto Activo",
  "Pipeline P1",
  "Pipeline P2",
];

const PIPELINE_SUBSTAGES: SubStage[] = [
  "Evaluación preliminar",
  "Primera presentación preliminar",
  "Visita técnica realizada",
  "Evaluación final",
  "Presentación final",
  "Contrato en revisión",
  "Contrato firmado",
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatISODate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return (crypto as unknown as { randomUUID: () => string }).randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function parseNumber(v: string) {
  const n = Number(v.replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}
function formatPct(p: number) {
  if (!Number.isFinite(p)) return "0%";
  return `${p % 1 === 0 ? p : p.toFixed(1)}%`;
}
function stageBadge(stage: Stage) {
  switch (stage) {
    case "Contacto":
      return "bg-slate-100 text-slate-700 ring-slate-200";
    case "Prospecto Pasivo":
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
    case "Prospecto Activo":
      return "bg-sky-100 text-sky-800 ring-sky-200";
    case "Pipeline P1":
      return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    case "Pipeline P2":
      return "bg-amber-100 text-amber-900 ring-amber-200";
  }
}

// ─── Parsear CSV de Google Sheets ────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Normaliza etapas del sheet al formato interno del CRM
function normalizeStage(raw: string): Stage {
  const s = raw.toLowerCase().trim();
  if (s.includes("pipeline 1") || s.includes("pipeline p1") || s === "p1") return "Pipeline P1";
  if (s.includes("pipeline 2") || s.includes("pipeline p2") || s === "p2") return "Pipeline P2";
  if (s.includes("prospecto activo")) return "Prospecto Activo";
  if (s.includes("prospecto pasivo")) return "Prospecto Pasivo";
  if (s.includes("contacto")) return "Contacto";
  // Si tiene "pipeline" sin número, asumir P1
  if (s.includes("pipeline")) return "Pipeline P1";
  return "Contacto";
}

// Normaliza sub-etapas del sheet al formato interno
function normalizeSubStage(raw: string): SubStage | undefined {
  const s = raw.toLowerCase().trim();
  if (!s) return undefined;
  if (s.includes("evaluación preliminar") || s.includes("evaluacion preliminar")) return "Evaluación preliminar";
  if (s.includes("primera presentación") || s.includes("primera presentacion") || s.includes("presentación preliminar")) return "Primera presentación preliminar";
  if (s.includes("visita técnica") || s.includes("visita tecnica")) return "Visita técnica realizada";
  if (s.includes("evaluación final") || s.includes("evaluacion final")) return "Evaluación final";
  if (s.includes("presentación final") || s.includes("presentacion final")) return "Presentación final";
  if (s.includes("contrato en revisión") || s.includes("contrato en revision") || s.includes("revisión")) return "Contrato en revisión";
  if (s.includes("contrato firmado") || s.includes("firmado")) return "Contrato firmado";
  return undefined;
}

function parseCSVToClients(csv: string): ClientRecord[] {
  const lines = csv.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

  const col = (name: string) => {
    const variants: Record<string, string[]> = {
      company: ["empresa", "companyname", "nombre empresa", "company", "nombre"],
      contact: ["contacto", "contactname", "nombre contacto", "contact"],
      stage: ["etapa", "stage", "fase"],
      substage: ["subetapa", "sub-etapa", "substage", "sub etapa", "subestage"],
      mwp: ["kwp", "mwp", "kw", "mw", "potencia"],
      prob: ["probabilidad", "prob", "closeprobabilitypct", "%"],
      lastcontact: ["ultimo contacto", "lastcontactiso", "último contacto", "last contact", "fecha"],
      nextaction: ["pendiente", "nextaction", "próxima acción", "proxima accion", "accion", "comentario"],
      notes: ["notas", "notes", "observaciones"],
    };
    const keys = variants[name] ?? [name];
    return headers.findIndex((h) => keys.some((k) => h.includes(k)));
  };

  const idx = {
    company: col("company"),
    contact: col("contact"),
    stage: col("stage"),
    substage: col("substage"),
    mwp: col("mwp"),
    prob: col("prob"),
    lastcontact: col("lastcontact"),
    nextaction: col("nextaction"),
    notes: col("notes"),
  };

  const now = todayISO();
  const clients: ClientRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    // get con soporte para coma decimal (formato español)
    const get = (index: number) => (index >= 0 ? (cols[index] ?? "").trim() : "");
    const getNum = (index: number) => {
      const v = get(index);
      // reemplazar coma decimal por punto
      const n = Number(v.replace(/\./g, "").replace(",", ".").trim());
      return Number.isFinite(n) ? n : 0;
    };

    const companyName = get(idx.company);
    if (!companyName) continue;

    const stage = normalizeStage(get(idx.stage));
    const subStage = (stage === "Pipeline P1" || stage === "Pipeline P2")
      ? normalizeSubStage(get(idx.substage))
      : undefined;

    const mwp = getNum(idx.mwp);
    const probRaw = getNum(idx.prob);
    const closeProbabilityPct = subStage ? SUBSTAGE_PROB[subStage] : clamp(probRaw, 0, 100);

    clients.push({
      id: newId(),
      companyName,
      contactName: get(idx.contact),
      stage,
      subStage,
      mwp,
      closeProbabilityPct,
      lastContactISO: get(idx.lastcontact),
      nextAction: get(idx.nextaction),
      notes: get(idx.notes),
      aiTasks: [],
      createdAtISO: now,
      updatedAtISO: now,
    });
  }
  return clients;
}

// ─── Persistencia local (respaldo) ───────────────────────────────────────────
function safeParseClients(raw: string | null): ClientRecord[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return (data as Partial<ClientRecord>[])
      .filter((x) => typeof x.id === "string" && typeof x.companyName === "string")
      .map((x) => ({
        id: x.id!,
        companyName: x.companyName ?? "",
        contactName: x.contactName ?? "",
        stage: (x.stage as Stage) ?? "Contacto",
        subStage: x.subStage as SubStage | undefined,
        mwp: typeof x.mwp === "number" ? x.mwp : 0,
        closeProbabilityPct:
          typeof x.closeProbabilityPct === "number" ? x.closeProbabilityPct : 0,
        lastContactISO: typeof x.lastContactISO === "string" ? x.lastContactISO : "",
        nextAction: x.nextAction ?? "",
        notes: x.notes ?? "",
        aiTasks: Array.isArray((x as Record<string, unknown>).aiTasks)
          ? (
              (x as Record<string, unknown>).aiTasks as Array<
                Record<string, unknown>
              >
            )
              .filter((t) => typeof t.id === "string")
              .map((t) => ({
                id: t.id as string,
                text: (t.text as string) ?? "",
                done: Boolean(t.done),
              }))
          : [],
        createdAtISO:
          typeof x.createdAtISO === "string" ? x.createdAtISO : todayISO(),
        updatedAtISO:
          typeof x.updatedAtISO === "string" ? x.updatedAtISO : todayISO(),
      }));
  } catch {
    return [];
  }
}

type ClientDraft = Omit<ClientRecord, "id" | "createdAtISO" | "updatedAtISO">;
const EMPTY_DRAFT: ClientDraft = {
  companyName: "",
  contactName: "",
  stage: "Contacto",
  subStage: undefined,
  mwp: 0,
  closeProbabilityPct: 0,
  lastContactISO: "",
  nextAction: "",
  notes: "",
  aiTasks: [],
};
function normalizeDraft(d: ClientDraft): ClientDraft {
  return {
    ...d,
    subStage: d.stage === "Pipeline P1" ? d.subStage : undefined,
    mwp: Math.max(0, d.mwp),
    closeProbabilityPct: clamp(d.closeProbabilityPct, 0, 100),
    aiTasks: Array.isArray(d.aiTasks) ? d.aiTasks : [],
  };
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => ref.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200 focus:outline-none flex flex-col"
        style={{ maxHeight: "88vh" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3 shrink-0">
          <div className="text-base font-semibold text-zinc-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Cerrar
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-zinc-700">{label}</div>
        {hint && <div className="text-[11px] text-zinc-500">{hint}</div>}
      </div>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// ─── Card ────────────────────────────────────────────────────────────────────
function Card({
  client,
  onEdit,
  onDelete,
  onToggleTask,
}: {
  client: ClientRecord;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleTask: (cId: string, tId: string) => void;
}) {
  const isSigned = client.subStage === "Contrato firmado";
  return (
    <div
      className={cx(
        "rounded-xl border p-3 shadow-sm hover:shadow transition-shadow",
        isSigned
          ? "border-emerald-300 bg-emerald-50"
          : "border-zinc-200 bg-white"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {isSigned && (
              <span className="text-emerald-600 text-base">✓</span>
            )}
            <div className="truncate text-sm font-semibold text-zinc-900">
              {client.companyName || "Sin empresa"}
            </div>
          </div>
          <div className="truncate text-xs text-zinc-600">
            Contacto: {client.contactName || "—"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(client.id)}
            className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => onDelete(client.id)}
            className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
          >
            Eliminar
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          className={cx(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
            stageBadge(client.stage)
          )}
        >
          {client.stage}
        </span>
        {client.stage === "Pipeline P1" && client.subStage && (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
            {client.subStage}
          </span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-zinc-50 p-2">
          <div className="text-[11px] text-zinc-500">MWp</div>
          <div className="font-semibold text-zinc-900">
            {client.mwp.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-50 p-2">
          <div className="text-[11px] text-zinc-500">Probabilidad</div>
          <div className="font-semibold text-zinc-900">
            {formatPct(client.closeProbabilityPct)}
          </div>
        </div>
        <div className="rounded-lg bg-zinc-50 p-2 col-span-2">
          <div className="text-[11px] text-zinc-500">Último contacto</div>
          <div className="font-semibold text-zinc-900">
            {formatISODate(client.lastContactISO)}
          </div>
        </div>
      </div>
      {client.nextAction ||
      client.notes ||
      client.aiTasks?.length ? (
        <div className="mt-2 space-y-1 text-xs">
          {client.nextAction && (
            <div className="rounded-lg border border-zinc-200 bg-white p-2">
              <div className="text-[11px] text-zinc-500">Pendiente</div>
              <div className="text-zinc-900">{client.nextAction}</div>
            </div>
          )}
          {client.notes && (
            <div className="rounded-lg border border-zinc-200 bg-white p-2">
              <div className="text-[11px] text-zinc-500">Notas</div>
              <div className="text-zinc-900 whitespace-pre-wrap">
                {client.notes}
              </div>
            </div>
          )}
          {client.aiTasks?.length ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-2">
              <div className="text-[11px] text-zinc-500">Tareas (IA)</div>
              <ul className="mt-1 space-y-1">
                {client.aiTasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={t.done}
                      onChange={() => onToggleTask(client.id, t.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-emerald-600"
                    />
                    <span
                      className={cx(
                        "text-zinc-900",
                        t.done && "text-zinc-400 line-through"
                      )}
                    >
                      {t.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ─── Vista Pipeline P1 ───────────────────────────────────────────────────────
function PipelineP1View({
  clients,
  onEdit,
  onDelete,
  onToggleTask,
  onBack,
}: {
  clients: ClientRecord[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleTask: (cId: string, tId: string) => void;
  onBack: () => void;
}) {
  const p1 = clients.filter((c) => c.stage === "Pipeline P1");
  const signed = p1.filter((c) => c.subStage === "Contrato firmado");
  const active = p1.filter((c) => c.subStage !== "Contrato firmado");

  const mwpGestion = active.reduce((s, c) => s + (c.mwp || 0), 0);
  const mwpFirmado = signed.reduce((s, c) => s + (c.mwp || 0), 0);

  const bySubStage = useMemo(() => {
    const map = new Map<SubStage, ClientRecord[]>();
    for (const s of PIPELINE_SUBSTAGES.filter((s) => s !== "Contrato firmado"))
      map.set(s, []);
    for (const c of active) {
      if (c.subStage && c.subStage !== "Contrato firmado")
        map.get(c.subStage)?.push(c);
      else map.get("Evaluación preliminar")?.push(c);
    }
    return map;
  }, [active]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-zinc-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            ← Volver
          </button>
          <div>
            <div className="text-sm font-medium text-emerald-700">Solar CRM</div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Pipeline P1 — Activo
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-xs font-medium text-zinc-500">En gestión</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900">
              {active.length}
            </div>
            <div className="text-xs text-zinc-400">clientes</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-xs font-medium text-zinc-500">MWp en gestión</div>
            <div className="mt-1 text-2xl font-semibold text-zinc-900">
              {mwpGestion.toFixed(2)}
            </div>
          </div>
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
            <div className="text-xs font-medium text-emerald-700">
              Proyectos firmados
            </div>
            <div className="mt-1 text-2xl font-semibold text-emerald-900">
              {signed.length}
            </div>
            <div className="text-xs text-emerald-600">contratos</div>
          </div>
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
            <div className="text-xs font-medium text-emerald-700">MWp firmado</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-900">
              {mwpFirmado.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-8">
          {PIPELINE_SUBSTAGES.filter((s) => s !== "Contrato firmado").map(
            (sub) => {
              const items = bySubStage.get(sub) ?? [];
              const prob = SUBSTAGE_PROB[sub];
              return (
                <section
                  key={sub}
                  className="rounded-2xl border border-zinc-200 bg-white/60 p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">
                        {sub}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {items.length} cliente{items.length !== 1 ? "s" : ""} ·{" "}
                        {prob}% prob.
                      </div>
                    </div>
                    <div className="ml-auto">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                        {prob}%
                      </span>
                    </div>
                  </div>
                  {items.length ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items
                        .sort(
                          (a, b) =>
                            b.closeProbabilityPct - a.closeProbabilityPct
                        )
                        .map((c) => (
                          <Card
                            key={c.id}
                            client={c}
                            onEdit={onEdit}
                            onDelete={onDelete}
                            onToggleTask={onToggleTask}
                          />
                        ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-3 text-xs text-zinc-400">
                      Sin clientes en esta sub-etapa.
                    </div>
                  )}
                </section>
              );
            }
          )}
        </div>

        {signed.length > 0 && (
          <section className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-emerald-600 text-xl">✓</span>
              <div>
                <div className="text-sm font-semibold text-emerald-900">
                  Proyectos firmados
                </div>
                <div className="text-xs text-emerald-700">
                  {signed.length} contrato{signed.length !== 1 ? "s" : ""} ·{" "}
                  {mwpFirmado.toFixed(2)} MWp
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {signed.map((c) => (
                <Card
                  key={c.id}
                  client={c}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleTask={onToggleTask}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Home() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [sheetStatus, setSheetStatus] = useState<
    "idle" | "loading" | "ok" | "error"
  >("idle");
  const [query, setQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<Stage | "Todas">("Todas");
  const [view, setView] = useState<"dashboard" | "pipeline-p1">("dashboard");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ClientDraft>(EMPTY_DRAFT);
  const [extractTasksLoading, setExtractTasksLoading] = useState(false);

  // Cargar desde Google Sheets al iniciar
  const loadFromSheet = useCallback(async () => {
    setSheetStatus("loading");
    try {
      const res = await fetch(
        `/api/sheet-proxy?url=${encodeURIComponent(SHEET_CSV_URL)}`
      );
      if (!res.ok) throw new Error("Error al cargar la hoja");
      const csv = await res.text();
      const parsed = parseCSVToClients(csv);
      if (parsed.length > 0) {
        // Preservar aiTasks y ediciones locales si el cliente ya existía (por nombre de empresa)
        const local = safeParseClients(localStorage.getItem(LOCAL_STORAGE_KEY));
        const localMap = new Map(local.map((c) => [c.companyName.toLowerCase(), c]));
        const merged = parsed.map((c) => {
          const existing = localMap.get(c.companyName.toLowerCase());
          if (existing) {
            return {
              ...c,
              id: existing.id,
              aiTasks: existing.aiTasks,
              createdAtISO: existing.createdAtISO,
            };
          }
          return c;
        });
        setClients(merged);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
        setSheetStatus("ok");
      } else {
        // Si la hoja está vacía, usar datos locales
        const local = safeParseClients(localStorage.getItem(LOCAL_STORAGE_KEY));
        setClients(local);
        setSheetStatus("ok");
      }
    } catch {
      // Si falla la hoja, usar datos locales como respaldo
      const local = safeParseClients(localStorage.getItem(LOCAL_STORAGE_KEY));
      setClients(local);
      setSheetStatus("error");
    }
  }, []);

  useEffect(() => {
    loadFromSheet();
  }, [loadFromSheet]);

  // Guardar cambios locales (ediciones manuales en el CRM)
  useEffect(() => {
    if (sheetStatus !== "idle" && clients.length >= 0) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clients));
    }
  }, [clients, sheetStatus]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (selectedStage !== "Todas" && c.stage !== selectedStage) return false;
      if (!q) return true;
      const haystack =
        `${c.companyName} ${c.contactName} ${c.stage} ${c.subStage ?? ""} ${c.nextAction} ${c.notes} ${(c.aiTasks ?? []).map((t) => t.text).join(" ")}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [clients, query, selectedStage]);

  const byStage = useMemo(() => {
    const map = new Map<Stage, ClientRecord[]>();
    for (const s of STAGES) map.set(s, []);
    for (const c of filteredClients) map.get(c.stage)?.push(c);
    for (const s of STAGES)
      map.get(s)!.sort(
        (a, b) =>
          Date.parse(b.lastContactISO || "0") -
          Date.parse(a.lastContactISO || "0")
      );
    return map;
  }, [filteredClients]);

  const metrics = useMemo(() => {
    const signed = clients.filter(
      (c) => c.stage === "Pipeline P1" && c.subStage === "Contrato firmado"
    );
    const p1Active = clients.filter(
      (c) => c.stage === "Pipeline P1" && c.subStage !== "Contrato firmado"
    );
    return {
      totalClients: clients.length,
      pipelineP1Count: p1Active.length,
      mwpGestion: p1Active.reduce((s, c) => s + (c.mwp || 0), 0),
      mwpFirmado: signed.reduce((s, c) => s + (c.mwp || 0), 0),
      mwpWeighted: clients.reduce(
        (s, c) => s + (c.mwp || 0) * ((c.closeProbabilityPct || 0) / 100),
        0
      ),
    };
  }, [clients]);

  function openCreate() {
    setEditingId(null);
    setExtractTasksLoading(false);
    setDraft({ ...EMPTY_DRAFT, lastContactISO: todayISO() });
    setModalOpen(true);
  }
  function openEdit(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    setEditingId(id);
    setExtractTasksLoading(false);
    setDraft({
      companyName: c.companyName,
      contactName: c.contactName,
      stage: c.stage,
      subStage: c.subStage,
      mwp: c.mwp,
      closeProbabilityPct: c.closeProbabilityPct,
      lastContactISO: c.lastContactISO,
      nextAction: c.nextAction,
      notes: c.notes,
      aiTasks: Array.isArray(c.aiTasks) ? c.aiTasks.map((t) => ({ ...t })) : [],
    });
    setModalOpen(true);
  }
  function toggleClientTask(clientId: string, taskId: string) {
    setClients((prev) =>
      prev.map((c) =>
        c.id !== clientId
          ? c
          : {
              ...c,
              aiTasks: (c.aiTasks ?? []).map((t) =>
                t.id === taskId ? { ...t, done: !t.done } : t
              ),
              updatedAtISO: todayISO(),
            }
      )
    );
  }
  function removeClient(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c || !window.confirm(`¿Eliminar "${c.companyName || "cliente"}"?`))
      return;
    setClients((prev) => prev.filter((x) => x.id !== id));
  }
  function upsertClient() {
    const n = normalizeDraft(draft);
    if (!n.companyName.trim()) {
      window.alert("Ingresa el nombre de la empresa.");
      return;
    }
    const now = todayISO();
    if (!editingId) {
      setClients((prev) => [
        { id: newId(), ...n, createdAtISO: now, updatedAtISO: now },
        ...prev,
      ]);
    } else {
      setClients((prev) =>
        prev.map((c) =>
          c.id === editingId ? { ...c, ...n, updatedAtISO: now } : c
        )
      );
    }
    setModalOpen(false);
  }
  async function extractTasksWithAI() {
    if (!draft.notes.trim()) {
      window.alert("Escribe notas antes de extraer tareas.");
      return;
    }
    setExtractTasksLoading(true);
    try {
      const res = await fetch("/api/extract-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: draft.notes }),
      });
      const data = (await res.json()) as { tasks?: string[]; error?: string };
      if (!res.ok) {
        window.alert(data.error ?? "No se pudieron extraer tareas.");
        return;
      }
      const tasks: ClientTask[] = (
        Array.isArray(data.tasks) ? data.tasks : []
      ).map((text) => ({ id: newId(), text, done: false }));
      setDraft((d) => ({ ...d, aiTasks: tasks }));
    } catch {
      window.alert("Error de red al contactar el servidor.");
    } finally {
      setExtractTasksLoading(false);
    }
  }

  if (view === "pipeline-p1") {
    return (
      <PipelineP1View
        clients={clients}
        onEdit={openEdit}
        onDelete={removeClient}
        onToggleTask={toggleClientTask}
        onBack={() => setView("dashboard")}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-zinc-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="text-sm font-medium text-emerald-700">Solar CRM</div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Pipeline de Clientes
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Seguimiento simple por etapas, con métricas de MWp y probabilidad.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Estado de sincronización con Google Sheets */}
              <button
                type="button"
                onClick={loadFromSheet}
                disabled={sheetStatus === "loading"}
                className={cx(
                  "rounded-xl border px-3 py-2 text-sm font-medium",
                  sheetStatus === "ok"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : sheetStatus === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                )}
              >
                {sheetStatus === "loading"
                  ? "⏳ Sincronizando…"
                  : sheetStatus === "ok"
                  ? "✓ Sincronizado · Actualizar"
                  : sheetStatus === "error"
                  ? "⚠ Error Sheets · Reintentar"
                  : "↻ Cargar Sheets"}
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                + Agregar cliente
              </button>
            </div>
          </div>

          {/* Banner de error de Sheets */}
          {sheetStatus === "error" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>No se pudo conectar con Google Sheets.</strong> Estás viendo los datos guardados localmente. Verificá que la hoja esté publicada como CSV (Archivo → Compartir → Publicar en la web → CSV).
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-medium text-zinc-500">
                Total clientes
              </div>
              <div className="mt-1 text-2xl font-semibold text-zinc-900">
                {metrics.totalClients}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setView("pipeline-p1")}
              className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-left hover:bg-emerald-100 transition-colors"
            >
              <div className="text-xs font-medium text-emerald-700">
                Pipeline P1 →
              </div>
              <div className="mt-1 text-2xl font-semibold text-emerald-900">
                {metrics.pipelineP1Count}
              </div>
              <div className="text-[11px] text-emerald-600">
                Clic para ver detalle
              </div>
            </button>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-medium text-zinc-500">
                MWp en gestión
              </div>
              <div className="mt-1 text-2xl font-semibold text-zinc-900">
                {metrics.mwpGestion.toFixed(2)}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-medium text-emerald-700">
                MWp firmado
              </div>
              <div className="mt-1 text-2xl font-semibold text-emerald-900">
                {metrics.mwpFirmado.toFixed(2)}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-medium text-zinc-500">
                MWp ponderado
              </div>
              <div className="mt-1 text-2xl font-semibold text-zinc-900">
                {metrics.mwpWeighted.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative w-full sm:max-w-md">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por empresa, contacto, notas…"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <select
                value={selectedStage}
                onChange={(e) =>
                  setSelectedStage(e.target.value as Stage | "Todas")
                }
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="Todas">Todas las etapas</option>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-zinc-500">
              Mostrando {filteredClients.length} de {clients.length}
            </div>
          </div>
        </header>

        <main className="mt-6">
          <div className="grid gap-4 lg:grid-cols-5">
            {STAGES.map((stage) => {
              const items = byStage.get(stage) ?? [];
              return (
                <section
                  key={stage}
                  className="rounded-2xl border border-zinc-200 bg-white/60 p-3"
                >
                  <div className="flex items-center justify-between gap-2 px-1 pb-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-900">
                        {stage}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {items.length} clientes
                      </div>
                    </div>
                    {stage === "Pipeline P1" && (
                      <button
                        type="button"
                        onClick={() => setView("pipeline-p1")}
                        className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-200"
                      >
                        Ver →
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {items.length ? (
                      items.map((c) => (
                        <Card
                          key={c.id}
                          client={c}
                          onEdit={openEdit}
                          onDelete={removeClient}
                          onToggleTask={toggleClientTask}
                        />
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-4 text-xs text-zinc-500">
                        Sin clientes en esta etapa.
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </main>
      </div>

      <Modal
        open={modalOpen}
        title={editingId ? "Editar cliente" : "Agregar cliente"}
        onClose={() => setModalOpen(false)}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre empresa" hint="Requerido">
            <input
              value={draft.companyName}
              onChange={(e) =>
                setDraft((d) => ({ ...d, companyName: e.target.value }))
              }
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="Ej: Soluciones Energéticas S.A."
            />
          </Field>
          <Field label="Nombre contacto">
            <input
              value={draft.contactName}
              onChange={(e) =>
                setDraft((d) => ({ ...d, contactName: e.target.value }))
              }
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="Ej: Ana Pérez"
            />
          </Field>
          <Field label="Etapa">
            <select
              value={draft.stage}
              onChange={(e) => {
                const stage = e.target.value as Stage;
                setDraft((d) => {
                  let prob = d.closeProbabilityPct;
                  if (stage === "Pipeline P1" && d.stage !== "Pipeline P1")
                    prob = DEFAULT_PROB_P1;
                  else if (
                    stage === "Pipeline P2" &&
                    d.stage !== "Pipeline P2"
                  )
                    prob = DEFAULT_PROB_P2;
                  return {
                    ...d,
                    stage,
                    subStage:
                      stage === "Pipeline P1" ? d.subStage : undefined,
                    closeProbabilityPct: prob,
                  };
                });
              }}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Sub-etapa (Pipeline P1)"
            hint={draft.stage === "Pipeline P1" ? "Recomendado" : "N/A"}
          >
            <select
              value={draft.subStage ?? ""}
              onChange={(e) => {
                const sub = (e.target.value || undefined) as
                  | SubStage
                  | undefined;
                setDraft((d) => ({
                  ...d,
                  subStage: sub,
                  closeProbabilityPct: sub
                    ? SUBSTAGE_PROB[sub]
                    : d.closeProbabilityPct,
                }));
              }}
              disabled={draft.stage !== "Pipeline P1"}
              className={cx(
                "w-full rounded-xl border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30",
                draft.stage !== "Pipeline P1"
                  ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                  : "border-zinc-200 bg-white text-zinc-900"
              )}
            >
              <option value="">(Sin sub-etapa)</option>
              {PIPELINE_SUBSTAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="MWp de propuesta" hint="Ej: 2.5">
            <input
              inputMode="decimal"
              value={String(draft.mwp)}
              onChange={(e) =>
                setDraft((d) => ({ ...d, mwp: parseNumber(e.target.value) }))
              }
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </Field>
          <Field
            label="Probabilidad de cierre (%)"
            hint="Se ajusta automáticamente por sub-etapa"
          >
            <input
              inputMode="decimal"
              value={String(draft.closeProbabilityPct)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  closeProbabilityPct: clamp(
                    parseNumber(e.target.value),
                    0,
                    100
                  ),
                }))
              }
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </Field>
          <Field label="Último contacto">
            <input
              type="date"
              value={draft.lastContactISO}
              onChange={(e) =>
                setDraft((d) => ({ ...d, lastContactISO: e.target.value }))
              }
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Pendiente / próxima acción">
              <input
                value={draft.nextAction}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, nextAction: e.target.value }))
                }
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                placeholder="Ej: enviar propuesta, coordinar visita…"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="text-xs font-medium text-zinc-700">Notas</div>
              <button
                type="button"
                disabled={extractTasksLoading}
                onClick={extractTasksWithAI}
                className="shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {extractTasksLoading ? "Extrayendo…" : "Extraer tareas con IA"}
              </button>
            </div>
            <textarea
              value={draft.notes}
              onChange={(e) =>
                setDraft((d) => ({ ...d, notes: e.target.value }))
              }
              rows={3}
              className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="Contexto, objeciones, acuerdos, próximos pasos…"
            />
            {draft.aiTasks.length > 0 && (
              <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50/80 p-3">
                <div className="text-xs font-medium text-zinc-700 mb-2">
                  Tareas pendientes (IA)
                </div>
                <ul className="space-y-1.5">
                  {draft.aiTasks.map((t) => (
                    <li key={t.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={() =>
                          setDraft((d) => ({
                            ...d,
                            aiTasks: d.aiTasks.map((x) =>
                              x.id === t.id ? { ...x, done: !x.done } : x
                            ),
                          }))
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-emerald-600"
                      />
                      <span
                        className={cx(
                          "text-zinc-900",
                          t.done && "text-zinc-400 line-through"
                        )}
                      >
                        {t.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end border-t border-zinc-100 pt-4">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={upsertClient}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Guardar
          </button>
        </div>
      </Modal>
    </div>
  );
}
