"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type ClientRecord = {
  id: string;
  companyName: string;
  contactName: string;
  stage: Stage;
  subStage?: SubStage;
  mwp: number;
  closeProbabilityPct: number; // 0..100
  lastContactISO: string; // YYYY-MM-DD
  nextAction: string;
  notes: string;
  createdAtISO: string;
  updatedAtISO: string;
};

const STORAGE_KEY = "solar-crm:v1";

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
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatISODate(iso: string) {
  if (!iso) return "—";
  const [yyyy, mm, dd] = iso.split("-");
  if (!yyyy || !mm || !dd) return iso;
  return `${dd}/${mm}/${yyyy}`;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (crypto as any).randomUUID() as string;
  }
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function parseNumber(value: string) {
  const normalized = value.replace(",", ".").trim();
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function safeParseClients(raw: string | null): ClientRecord[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data
      .map((x) => x as Partial<ClientRecord>)
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
        createdAtISO: typeof x.createdAtISO === "string" ? x.createdAtISO : todayISO(),
        updatedAtISO: typeof x.updatedAtISO === "string" ? x.updatedAtISO : todayISO(),
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
};

function normalizeDraft(draft: ClientDraft): ClientDraft {
  const isPipelineActive = draft.stage === "Pipeline P1";
  return {
    ...draft,
    stage: draft.stage,
    subStage: isPipelineActive ? draft.subStage : undefined,
    mwp: Math.max(0, draft.mwp),
    closeProbabilityPct: clamp(draft.closeProbabilityPct, 0, 100),
  };
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

function Card({
  client,
  onEdit,
  onDelete,
}: {
  client: ClientRecord;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm hover:shadow transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-900">
            {client.companyName || "Sin empresa"}
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

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={cx(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
            stageBadge(client.stage),
          )}
        >
          {client.stage}
        </span>
        {client.stage === "Pipeline P1" && client.subStage ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
            {client.subStage}
          </span>
        ) : null}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-zinc-50 p-2">
          <div className="text-[11px] text-zinc-500">MWp</div>
          <div className="font-semibold text-zinc-900">{client.mwp.toFixed(2)}</div>
        </div>
        <div className="rounded-lg bg-zinc-50 p-2">
          <div className="text-[11px] text-zinc-500">Probabilidad</div>
          <div className="font-semibold text-zinc-900">
            {client.closeProbabilityPct.toFixed(0)}%
          </div>
        </div>
        <div className="rounded-lg bg-zinc-50 p-2 col-span-2">
          <div className="text-[11px] text-zinc-500">Último contacto</div>
          <div className="font-semibold text-zinc-900">
            {formatISODate(client.lastContactISO)}
          </div>
        </div>
      </div>

      {(client.nextAction || client.notes) && (
        <div className="mt-2 space-y-1 text-xs">
          {client.nextAction ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-2">
              <div className="text-[11px] text-zinc-500">Pendiente / próxima acción</div>
              <div className="text-zinc-900">{client.nextAction}</div>
            </div>
          ) : null}
          {client.notes ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-2">
              <div className="text-[11px] text-zinc-500">Notas</div>
              <div className="text-zinc-900 whitespace-pre-wrap">{client.notes}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

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
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200 focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-zinc-900">
              {title}
            </div>
            <div className="text-xs text-zinc-500">
              Los cambios se guardan en este navegador (localStorage).
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Cerrar
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
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
        {hint ? <div className="text-[11px] text-zinc-500">{hint}</div> : null}
      </div>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function Home() {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<Stage | "Todas">("Todas");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ClientDraft>(EMPTY_DRAFT);

  useEffect(() => {
    setClients(safeParseClients(localStorage.getItem(STORAGE_KEY)));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  }, [clients]);

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      const matchesStage = selectedStage === "Todas" ? true : c.stage === selectedStage;
      if (!matchesStage) return false;
      if (!q) return true;
      const haystack = `${c.companyName} ${c.contactName} ${c.stage} ${
        c.subStage ?? ""
      } ${c.nextAction} ${c.notes}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [clients, query, selectedStage]);

  const byStage = useMemo(() => {
    const map = new Map<Stage, ClientRecord[]>();
    for (const s of STAGES) map.set(s, []);
    for (const c of filteredClients) map.get(c.stage)?.push(c);
    for (const s of STAGES) {
      map.get(s)!.sort((a, b) => {
        const ad = a.lastContactISO ? Date.parse(a.lastContactISO) : 0;
        const bd = b.lastContactISO ? Date.parse(b.lastContactISO) : 0;
        return bd - ad;
      });
    }
    return map;
  }, [filteredClients]);

  const metrics = useMemo(() => {
    const totalClients = clients.length;
    const pipelineP1 = clients.filter((c) => c.stage === "Pipeline P1");
    const pipelineP1Count = pipelineP1.length;
    const mwpTotal = clients.reduce((acc, c) => acc + (c.mwp || 0), 0);
    const mwpWeighted = clients.reduce(
      (acc, c) => acc + (c.mwp || 0) * ((c.closeProbabilityPct || 0) / 100),
      0,
    );
    return { totalClients, pipelineP1Count, mwpTotal, mwpWeighted };
  }, [clients]);

  function openCreate() {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT, lastContactISO: todayISO() });
    setModalOpen(true);
  }

  function openEdit(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    setEditingId(id);
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
    });
    setModalOpen(true);
  }

  function removeClient(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    const ok = window.confirm(`¿Eliminar “${c.companyName || "cliente"}”?`);
    if (!ok) return;
    setClients((prev) => prev.filter((x) => x.id !== id));
  }

  function upsertClient() {
    const normalized = normalizeDraft(draft);
    if (!normalized.companyName.trim()) {
      window.alert("Ingresa el nombre de la empresa.");
      return;
    }
    const now = todayISO();
    if (!editingId) {
      const newClient: ClientRecord = {
        id: newId(),
        ...normalized,
        createdAtISO: now,
        updatedAtISO: now,
      };
      setClients((prev) => [newClient, ...prev]);
      setModalOpen(false);
      return;
    }
    setClients((prev) =>
      prev.map((c) =>
        c.id === editingId ? { ...c, ...normalized, updatedAtISO: now } : c,
      ),
    );
    setModalOpen(false);
  }

  function resetDemo() {
    const ok = window.confirm(
      "Esto reemplazará tus datos guardados por un set de ejemplo. ¿Continuar?",
    );
    if (!ok) return;
    const now = todayISO();
    const demo: ClientRecord[] = [
      {
        id: newId(),
        companyName: "Industrias Andinas",
        contactName: "Carolina Muñoz",
        stage: "Contacto",
        mwp: 3.2,
        closeProbabilityPct: 10,
        lastContactISO: now,
        nextAction: "Enviar brochure + solicitar consumo 12 meses",
        notes: "Interés inicial por reducción de costo energético.",
        createdAtISO: now,
        updatedAtISO: now,
      },
      {
        id: newId(),
        companyName: "AgroSol SpA",
        contactName: "Pedro Rivas",
        stage: "Prospecto Activo",
        mwp: 1.8,
        closeProbabilityPct: 25,
        lastContactISO: now,
        nextAction: "Coordinar llamada con operaciones",
        notes: "",
        createdAtISO: now,
        updatedAtISO: now,
      },
      {
        id: newId(),
        companyName: "Centro Logístico Norte",
        contactName: "Marcela Soto",
        stage: "Pipeline P1",
        subStage: "Visita técnica realizada",
        mwp: 6.5,
        closeProbabilityPct: 55,
        lastContactISO: now,
        nextAction: "Enviar evaluación final + timeline de contrato",
        notes: "Validar disponibilidad de techo y acceso.",
        createdAtISO: now,
        updatedAtISO: now,
      },
      {
        id: newId(),
        companyName: "Textiles del Pacífico",
        contactName: "Luis Herrera",
        stage: "Pipeline P2",
        mwp: 2.4,
        closeProbabilityPct: 35,
        lastContactISO: "",
        nextAction: "Re-contactar en 30 días",
        notes: "Sin respuesta desde la última propuesta.",
        createdAtISO: now,
        updatedAtISO: now,
      },
    ];
    setClients(demo);
    setQuery("");
    setSelectedStage("Todas");
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-zinc-50 to-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <div className="text-sm font-medium text-emerald-700">
                Solar CRM
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Pipeline de Clientes
              </h1>
              <p className="mt-1 text-sm text-zinc-600">
                Seguimiento simple por etapas, con métricas de MWp y probabilidad.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={resetDemo}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Cargar ejemplo
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-medium text-zinc-500">Total clientes</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-900">
                {metrics.totalClients}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-medium text-zinc-500">Pipeline P1</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-900">
                {metrics.pipelineP1Count}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-medium text-zinc-500">MWp total</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-900">
                {metrics.mwpTotal.toFixed(2)}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-medium text-zinc-500">
                MWp ponderado (prob.)
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
                  placeholder="Buscar por empresa, contacto, acción, notas…"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>
              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value as Stage | "Todas")}
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
                      <div className="text-xs text-zinc-500">{items.length} clientes</div>
                    </div>
                    <span
                      className={cx(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                        stageBadge(stage),
                      )}
                    >
                      {stage === "Pipeline P1" ? "Activo" : stage === "Pipeline P2" ? "Sin movimiento" : "—"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {items.length ? (
                      items.map((c) => (
                        <Card
                          key={c.id}
                          client={c}
                          onEdit={openEdit}
                          onDelete={removeClient}
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
              onChange={(e) => setDraft((d) => ({ ...d, companyName: e.target.value }))}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="Ej: Soluciones Energéticas S.A."
            />
          </Field>

          <Field label="Nombre contacto">
            <input
              value={draft.contactName}
              onChange={(e) => setDraft((d) => ({ ...d, contactName: e.target.value }))}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder="Ej: Ana Pérez"
            />
          </Field>

          <Field label="Etapa">
            <select
              value={draft.stage}
              onChange={(e) => {
                const stage = e.target.value as Stage;
                setDraft((d) => ({
                  ...d,
                  stage,
                  subStage: stage === "Pipeline P1" ? d.subStage : undefined,
                }));
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
            label="Sub-etapa (solo Pipeline P1)"
            hint={draft.stage === "Pipeline P1" ? "Recomendado" : "N/A"}
          >
            <select
              value={draft.subStage ?? ""}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  subStage: (e.target.value || undefined) as SubStage | undefined,
                }))
              }
              disabled={draft.stage !== "Pipeline P1"}
              className={cx(
                "w-full rounded-xl border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30",
                draft.stage !== "Pipeline P1"
                  ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                  : "border-zinc-200 bg-white text-zinc-900",
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
              value={Number.isFinite(draft.mwp) ? String(draft.mwp) : "0"}
              onChange={(e) => setDraft((d) => ({ ...d, mwp: parseNumber(e.target.value) }))}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </Field>

          <Field label="Probabilidad de cierre (%)" hint="0 a 100">
            <input
              inputMode="numeric"
              value={Number.isFinite(draft.closeProbabilityPct) ? String(draft.closeProbabilityPct) : "0"}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  closeProbabilityPct: clamp(parseNumber(e.target.value), 0, 100),
                }))
              }
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </Field>

          <Field label="Último contacto">
            <input
              type="date"
              value={draft.lastContactISO}
              onChange={(e) => setDraft((d) => ({ ...d, lastContactISO: e.target.value }))}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Pendiente / próxima acción">
              <input
                value={draft.nextAction}
                onChange={(e) => setDraft((d) => ({ ...d, nextAction: e.target.value }))}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                placeholder="Ej: enviar propuesta, coordinar visita, revisar contrato…"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field label="Notas">
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                rows={4}
                className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                placeholder="Contexto, objeciones, acuerdos, próximos pasos…"
              />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
