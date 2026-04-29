"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

type Stage = "Prospecto Pasivo" | "Prospecto Activo" | "Pipeline P2" | "Pipeline P1";
type SubStage =
  | "Evaluación preliminar"
  | "Primera presentación preliminar"
  | "Visita técnica realizada"
  | "Presentación final"
  | "Contrato en revisión"
  | "Contrato firmado";
type ClientTask = { id: string; text: string; done: boolean };
type ClientRecord = {
  id: string; companyName: string; contactName: string;
  stage: Stage; subStage?: SubStage; mwp: number; closeProbabilityPct: number;
  lastContactISO: string; nextAction: string; notes: string;
  aiTasks: ClientTask[]; aiPendiente?: string; createdAtISO: string; updatedAtISO: string;
};

const LOCAL_STORAGE_KEY = "solar-crm:v3";
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQx9xTTA1PLUjIbfcEQa4J8s-vazmF_VGGgDQwP4CEoPI3Dy1oimVkRg3YLeFRvyP04IvY5fgMVci2t/pub?gid=0&single=true&output=csv";
const LOGO_B64 = "data:image/webp;base64,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";

const SUBSTAGE_PROB: Record<SubStage, number> = {
  "Evaluación preliminar": 5,
  "Primera presentación preliminar": 10,
  "Visita técnica realizada": 15,
  "Presentación final": 25,
  "Contrato en revisión": 50,
  "Contrato firmado": 100,
};
const SUBSTAGE_MONTHS: Record<SubStage, number> = {
  "Evaluación preliminar": 8, "Primera presentación preliminar": 8,
  "Visita técnica realizada": 7, "Presentación final": 3,
  "Contrato en revisión": 2, "Contrato firmado": 0,
};
const STAGES: Stage[] = ["Prospecto Pasivo","Prospecto Activo","Pipeline P2","Pipeline P1"];
const PIPELINE_SUBSTAGES: SubStage[] = [
  "Evaluación preliminar","Primera presentación preliminar","Visita técnica realizada",
  "Presentación final","Contrato en revisión","Contrato firmado",
];
const STAGE_PRIORITY: Record<Stage,number> = {"Pipeline P1":1,"Pipeline P2":2,"Prospecto Activo":3,"Prospecto Pasivo":4};
const SUBSTAGE_PRIORITY: Record<SubStage,number> = {
  "Contrato firmado":1,"Contrato en revisión":2,"Presentación final":3,
  "Visita técnica realizada":4,"Primera presentación preliminar":5,"Evaluación preliminar":6,
};

// Design tokens
const D = {
  bg: "#F8F7F4",
  white: "#FFFFFF",
  ink: "#1A1A1A",
  ink2: "#4A4A4A",
  ink3: "#8A8A8A",
  border: "#E8E6E1",
  accent: "#E8500A",   // Solarity orange
  accentMid: "#F5B800", // Solarity yellow
  p1bg: "#FFF9F5",
  p1border: "#F0C5A8",
  p2bg: "#FFFBF0",
  p2border: "#E8D88A",
  signedBg: "#F0FBF4",
  signedBorder: "#9FD4AF",
};

// Font import via style tag
const fontStyle = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap');
  * { font-family: 'DM Sans', sans-serif; }
  .serif { font-family: 'DM Serif Display', serif; }
`;

function todayISO() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function cx(...c: Array<string|false|null|undefined>) { return c.filter(Boolean).join(" "); }
function clamp(n:number,min:number,max:number) { return Math.max(min,Math.min(max,n)); }
function newId() { if(typeof crypto!=="undefined"&&"randomUUID" in crypto)return (crypto as unknown as {randomUUID:()=>string}).randomUUID(); return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`; }

function closingYear(subStage: SubStage|undefined): 2026|2027|null {
  if(!subStage||subStage==="Contrato firmado")return null;
  const months=SUBSTAGE_MONTHS[subStage];
  const today=new Date();
  const closeDate=new Date(today.getFullYear(),today.getMonth()+months,today.getDate());
  return closeDate.getFullYear()<=2026?2026:2027;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSVLine(line:string):string[]{const result:string[]=[]; let current=""; let inQuotes=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"'){if(inQuotes&&line[i+1]==='"'){current+='"';i++;}else inQuotes=!inQuotes;}else if(ch===','&&!inQuotes){result.push(current.trim());current="";}else current+=ch;}result.push(current.trim());return result;}
function normalizeStage(raw:string):Stage{const s=raw.toLowerCase().trim(); if(s.includes("pipeline 1")||s.includes("pipeline p1")||s==="p1")return "Pipeline P1"; if(s.includes("pipeline 2")||s.includes("pipeline p2")||s==="p2")return "Pipeline P2"; if(s.includes("prospecto activo"))return "Prospecto Activo"; if(s.includes("prospecto pasivo"))return "Prospecto Pasivo"; if(s.includes("pipeline"))return "Pipeline P1"; return "Prospecto Pasivo";}
function normalizeSubStage(raw:string):SubStage|undefined{const s=raw.toLowerCase().trim(); if(!s)return undefined; if(s.includes("evaluación preliminar")||s.includes("evaluacion preliminar"))return "Evaluación preliminar"; if(s.includes("primera presentación")||s.includes("primera presentacion")||s.includes("presentación preliminar")||s.includes("presentacion preliminar"))return "Primera presentación preliminar"; if(s.includes("visita técnica")||s.includes("visita tecnica"))return "Visita técnica realizada"; if(s.includes("presentación final")||s.includes("presentacion final"))return "Presentación final"; if(s.includes("revisión")||s.includes("revision")||s.includes("contrato en"))return "Contrato en revisión"; if(s.includes("firmado")||s.includes("firma"))return "Contrato firmado"; return undefined;}

function parseCSVToClients(csv:string):ClientRecord[]{
  const lines=csv.trim().split("\n").filter(Boolean); if(lines.length<2)return [];
  let headerLine=0; for(let i=0;i<Math.min(5,lines.length);i++){const cols=parseCSVLine(lines[i]); if(cols.some(c=>c.trim().length>1)){headerLine=i;break;}}
  const headers=parseCSVLine(lines[headerLine]).map(h=>h.toLowerCase().trim()); const dataStart=headerLine+1;
  const col=(name:string)=>{const variants:Record<string,string[]>={company:["empresa","companyname","nombre empresa","company","nombre"],contact:["contacto","contactname","nombre contacto","contact"],stage:["etapa","stage","fase"],substage:["subetapa","sub-etapa","substage","sub etapa","subestage"],mwp:["kwp","mwp","kw","mw","potencia"],prob:["probabilidad","prob","closeprobabilitypct","%"],lastcontact:["ultimo contacto","lastcontactiso","último contacto","last contact","fecha"],nextaction:["pendiente","nextaction","próxima acción","proxima accion","accion","comentario"],notes:["notas","notes","observaciones"],}; const keys=variants[name]??[name]; return headers.findIndex(h=>keys.some(k=>h.includes(k)));};
  const idx={company:col("company"),contact:col("contact"),stage:col("stage"),substage:col("substage"),mwp:col("mwp"),prob:col("prob"),lastcontact:col("lastcontact"),nextaction:col("nextaction"),notes:col("notes")};
  const now=todayISO(); const clients:ClientRecord[]=[];
  for(let i=dataStart;i<lines.length;i++){const cols=parseCSVLine(lines[i]); const get=(index:number)=>(index>=0?(cols[index]??"").trim():""); const getNum=(index:number)=>{const v=get(index); const n=Number(v.replace(/\./g,"").replace(",",".").trim()); return Number.isFinite(n)?n:0;}; const companyName=get(idx.company); if(!companyName)continue; const stage=normalizeStage(get(idx.stage)); const subStage=(stage==="Pipeline P1"||stage==="Pipeline P2")?normalizeSubStage(get(idx.substage)):undefined; const mwp=getNum(idx.mwp); let closeProbabilityPct=0; if(stage==="Pipeline P2")closeProbabilityPct=5; else if(stage==="Pipeline P1"&&subStage)closeProbabilityPct=SUBSTAGE_PROB[subStage]; clients.push({id:newId(),companyName,contactName:get(idx.contact),stage,subStage,mwp,closeProbabilityPct,lastContactISO:get(idx.lastcontact),nextAction:get(idx.nextaction),notes:get(idx.notes),aiTasks:[],aiPendiente:undefined,createdAtISO:now,updatedAtISO:now});}
  return clients;
}
function safeParseClients(raw:string|null):ClientRecord[]{if(!raw)return []; try{const data=JSON.parse(raw) as unknown; if(!Array.isArray(data))return []; return (data as Partial<ClientRecord>[]).filter(x=>typeof x.id==="string"&&typeof x.companyName==="string").map(x=>({id:x.id!,companyName:x.companyName??"",contactName:x.contactName??"",stage:(x.stage as Stage)??"Prospecto Pasivo",subStage:x.subStage as SubStage|undefined,mwp:typeof x.mwp==="number"?x.mwp:0,closeProbabilityPct:typeof x.closeProbabilityPct==="number"?x.closeProbabilityPct:0,lastContactISO:typeof x.lastContactISO==="string"?x.lastContactISO:"",nextAction:x.nextAction??"",notes:x.notes??"",aiTasks:[],aiPendiente:typeof (x as Record<string,unknown>).aiPendiente==="string"?(x as Record<string,unknown>).aiPendiente as string:undefined,createdAtISO:typeof x.createdAtISO==="string"?x.createdAtISO:todayISO(),updatedAtISO:typeof x.updatedAtISO==="string"?x.updatedAtISO:todayISO()}));}catch{return [];}}

type ClientDraft=Omit<ClientRecord,"id"|"createdAtISO"|"updatedAtISO">;
const EMPTY_DRAFT:ClientDraft={companyName:"",contactName:"",stage:"Prospecto Activo",subStage:undefined,mwp:0,closeProbabilityPct:0,lastContactISO:"",nextAction:"",notes:"",aiTasks:[],aiPendiente:undefined};

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({open,title,children,onClose}:{open:boolean;title:string;children:React.ReactNode;onClose:()=>void}){
  const ref=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{if(!open)return; const fn=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();}; window.addEventListener("keydown",fn); return ()=>window.removeEventListener("keydown",fn);},[open,onClose]);
  useEffect(()=>{if(open){const t=setTimeout(()=>ref.current?.focus(),0);return ()=>clearTimeout(t);}},[open]);
  if(!open)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.3)",backdropFilter:"blur(4px)",padding:"1rem"}} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div ref={ref} tabIndex={-1} style={{width:"100%",maxWidth:"640px",background:D.white,borderRadius:"20px",boxShadow:"0 24px 80px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column",maxHeight:"88vh",outline:"none"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1.25rem 1.5rem",borderBottom:`1px solid ${D.border}`}}>
          <span style={{fontSize:"15px",fontWeight:600,color:D.ink}}>{title}</span>
          <button onClick={onClose} style={{padding:"6px 14px",borderRadius:"10px",border:`1px solid ${D.border}`,background:D.white,fontSize:"13px",cursor:"pointer",color:D.ink2}}>Cerrar</button>
        </div>
        <div style={{overflowY:"auto",padding:"1.25rem 1.5rem",flex:1}}>{children}</div>
      </div>
    </div>
  );
}

function FLabel({label,children,hint}:{label:string;children:React.ReactNode;hint?:string}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:"12px",fontWeight:500,color:D.ink2}}>{label}</span>
        {hint&&<span style={{fontSize:"11px",color:D.ink3}}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

const inputStyle:React.CSSProperties={width:"100%",padding:"9px 12px",borderRadius:"10px",border:`1px solid ${D.border}`,background:D.white,fontSize:"13px",color:D.ink,outline:"none",boxSizing:"border-box"};

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({label,value,unit,accent,large}:{label:string;value:string|number;unit?:string;accent?:boolean;large?:boolean}){
  return(
    <div style={{background:accent?D.white:D.white,border:`1px solid ${accent?D.p1border:D.border}`,borderRadius:"16px",padding:"1.25rem",position:"relative",overflow:"hidden"}}>
      {accent&&<div style={{position:"absolute",top:0,left:0,width:"3px",height:"100%",background:`linear-gradient(${D.accent},${D.accentMid})`,borderRadius:"16px 0 0 16px"}}/>}
      <div style={{fontSize:"11px",fontWeight:500,color:D.ink3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"8px"}}>{label}</div>
      <div style={{fontSize:large?"32px":"24px",fontWeight:700,color:accent?D.accent:D.ink,lineHeight:1,fontFamily:"'DM Serif Display',serif"}}>{value}</div>
      {unit&&<div style={{fontSize:"11px",color:D.ink3,marginTop:"4px"}}>{unit}</div>}
    </div>
  );
}

// ─── Client Card ─────────────────────────────────────────────────────────────
function ClientCard({client,onEdit,onDelete}:{client:ClientRecord;onEdit:(id:string)=>void;onDelete:(id:string)=>void}){
  const isSigned=client.subStage==="Contrato firmado";
  const bg=isSigned?D.signedBg:D.white;
  const border=isSigned?D.signedBorder:D.border;
  return(
    <div style={{background:bg,border:`1px solid ${border}`,borderRadius:"14px",padding:"14px",transition:"box-shadow 0.15s"}}
      onMouseEnter={e=>(e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,0.08)")}
      onMouseLeave={e=>(e.currentTarget.style.boxShadow="none")}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px",marginBottom:"10px"}}>
        <div style={{minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
            {isSigned&&<span style={{color:"#22c55e",fontSize:"13px"}}>✓</span>}
            <div style={{fontSize:"13px",fontWeight:600,color:D.ink,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{client.companyName||"Sin empresa"}</div>
          </div>
          {client.contactName&&<div style={{fontSize:"11px",color:D.ink3,marginTop:"2px"}}>{client.contactName}</div>}
        </div>
        <div style={{display:"flex",gap:"4px",flexShrink:0}}>
          <button onClick={()=>onEdit(client.id)} style={{padding:"4px 10px",borderRadius:"8px",border:`1px solid ${D.border}`,background:D.white,fontSize:"11px",cursor:"pointer",color:D.ink2,fontWeight:500}}>Editar</button>
          <button onClick={()=>onDelete(client.id)} style={{padding:"4px 8px",borderRadius:"8px",border:"1px solid #fecaca",background:"#fff5f5",fontSize:"11px",cursor:"pointer",color:"#dc2626",fontWeight:500}}>×</button>
        </div>
      </div>
      {client.subStage&&(
        <div style={{marginBottom:"10px"}}>
          <span style={{fontSize:"10px",fontWeight:600,color:D.accent,textTransform:"uppercase",letterSpacing:"0.05em",borderLeft:`2px solid ${D.accent}`,paddingLeft:"6px"}}>{client.subStage}</span>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:client.nextAction?"10px":"0"}}>
        <div style={{background:D.bg,borderRadius:"8px",padding:"8px 10px"}}>
          <div style={{fontSize:"10px",color:D.ink3,marginBottom:"2px"}}>MWp</div>
          <div style={{fontSize:"14px",fontWeight:600,color:D.ink}}>{client.mwp.toFixed(2)}</div>
        </div>
        <div style={{background:D.bg,borderRadius:"8px",padding:"8px 10px"}}>
          <div style={{fontSize:"10px",color:D.ink3,marginBottom:"2px"}}>Probabilidad</div>
          <div style={{fontSize:"14px",fontWeight:600,color:D.ink}}>{client.closeProbabilityPct}%</div>
        </div>
      </div>
      {client.nextAction&&(
        <div style={{background:D.bg,borderRadius:"8px",padding:"8px 10px",borderLeft:`2px solid ${D.border}`}}>
          <div style={{fontSize:"10px",color:D.ink3,marginBottom:"2px"}}>Pendiente</div>
          <div style={{fontSize:"12px",color:D.ink2,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{client.nextAction}</div>
        </div>
      )}
    </div>
  );
}

// ─── Chart ────────────────────────────────────────────────────────────────────
function ClosingChart({clients}:{clients:ClientRecord[]}){
  const data=useMemo(()=>{
    const pipeline=clients.filter(c=>c.stage==="Pipeline P1"||c.stage==="Pipeline P2");
    const bySubStage:Record<string,{mwp:number;count:number}>={}; 
    for(const c of pipeline){if(!c.subStage||c.subStage==="Contrato firmado")continue; if(!bySubStage[c.subStage])bySubStage[c.subStage]={mwp:0,count:0}; bySubStage[c.subStage].mwp+=c.mwp; bySubStage[c.subStage].count++;}
    return PIPELINE_SUBSTAGES.filter(s=>s!=="Contrato firmado").map(s=>({label:s,mwp:bySubStage[s]?.mwp??0,prob:SUBSTAGE_PROB[s],count:bySubStage[s]?.count??0,mwpW:(bySubStage[s]?.mwp??0)*(SUBSTAGE_PROB[s]/100),year:closingYear(s)})).filter(d=>d.mwp>0);
  },[clients]);
  const maxMwp=Math.max(...data.map(d=>d.mwp),0.01);
  if(data.length===0)return null;
  return(
    <div style={{background:D.white,border:`1px solid ${D.border}`,borderRadius:"16px",padding:"1.5rem"}}>
      <div style={{marginBottom:"1.25rem"}}>
        <div style={{fontSize:"13px",fontWeight:600,color:D.ink,marginBottom:"2px"}}>Cierres probables por etapa</div>
        <div style={{fontSize:"11px",color:D.ink3}}>MWp total vs. MWp ponderado por probabilidad</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
        {data.map(d=>(
          <div key={d.label}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"6px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <span style={{fontSize:"12px",fontWeight:500,color:D.ink}}>{d.label}</span>
                <span style={{fontSize:"10px",padding:"2px 7px",borderRadius:"20px",fontWeight:500,background:d.year===2026?"#EFF6FF":"#F5F3FF",color:d.year===2026?"#2563EB":"#7C3AED"}}>{d.year} · {d.count} cli.</span>
              </div>
              <div style={{textAlign:"right"}}>
                <span style={{fontSize:"13px",fontWeight:600,color:D.ink}}>{d.mwpW.toFixed(2)}</span>
                <span style={{fontSize:"10px",color:D.ink3,marginLeft:"3px"}}>MWp · {d.prob}%</span>
              </div>
            </div>
            <div style={{height:"8px",borderRadius:"4px",background:D.bg,overflow:"hidden",position:"relative"}}>
              <div style={{position:"absolute",inset:"0 auto 0 0",width:`${(d.mwp/maxMwp)*100}%`,borderRadius:"4px",background:D.border}}/>
              <div style={{position:"absolute",inset:"0 auto 0 0",width:`${(d.mwpW/maxMwp)*100}%`,borderRadius:"4px",background:`linear-gradient(90deg,${D.accent},${D.accentMid})`}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:"3px"}}>
              <span style={{fontSize:"10px",color:D.ink3}}>{d.mwp.toFixed(2)} MWp total</span>
              <span style={{fontSize:"10px",color:D.accent,fontWeight:500}}>{d.mwpW.toFixed(2)} MWp probable</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pendientes Panel ─────────────────────────────────────────────────────────
function PendientesPanel({clients}:{clients:ClientRecord[]}){
  const [open,setOpen]=useState(false);
  const [pendientes,setPendientes]=useState<Array<{client:ClientRecord;resumen:string}>>([]);
  const [loading,setLoading]=useState(false);
  const [generated,setGenerated]=useState(false);
  const clientsWithNotes=useMemo(()=>[...clients].filter(c=>c.nextAction?.trim()).sort((a,b)=>{const sp=STAGE_PRIORITY[a.stage]-STAGE_PRIORITY[b.stage]; if(sp!==0)return sp; const ap=a.subStage?SUBSTAGE_PRIORITY[a.subStage]:99; const bp=b.subStage?SUBSTAGE_PRIORITY[b.subStage]:99; return ap-bp;}),[clients]);
  async function generar(){
    if(!clientsWithNotes.length)return; setLoading(true);setGenerated(false);
    const results:Array<{client:ClientRecord;resumen:string}>=[];
    for(const client of clientsWithNotes){
      try{const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:100,messages:[{role:"user",content:`Asesor comercial solar. Cliente: "${client.companyName}" (${client.stage}${client.subStage?` · ${client.subStage}`:""}).\nÚltimo movimiento: "${client.nextAction}"\nDa UNA acción concreta y específica que debe tomar el vendedor ahora. Máx 2 oraciones. Solo la acción.`}]})});
      const data=await res.json() as {content?:Array<{text?:string}>}; results.push({client,resumen:data.content?.[0]?.text?.trim()??client.nextAction});}
      catch{results.push({client,resumen:client.nextAction});}
    }
    setPendientes(results);setLoading(false);setGenerated(true);
  }
  const stagePill=(stage:Stage)=>{const m={["Pipeline P1"]:{bg:"#FFF5EE",c:D.accent},["Pipeline P2"]:{bg:"#FFFBEB",c:"#D97706"},["Prospecto Activo"]:{bg:"#EFF6FF",c:"#2563EB"},["Prospecto Pasivo"]:{bg:"#F9FAFB",c:D.ink3}}; return m[stage]||{bg:D.bg,c:D.ink3};};
  return(
    <div style={{background:D.white,border:`1px solid ${D.border}`,borderRadius:"16px",overflow:"hidden"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1.1rem 1.5rem",background:"none",border:"none",cursor:"pointer",textAlign:"left"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <div style={{width:"32px",height:"32px",borderRadius:"10px",background:`linear-gradient(135deg,${D.accent},${D.accentMid})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",flexShrink:0}}>✦</div>
          <div>
            <div style={{fontSize:"13px",fontWeight:600,color:D.ink}}>Acciones recomendadas por IA</div>
            <div style={{fontSize:"11px",color:D.ink3,marginTop:"1px"}}>{clientsWithNotes.length} clientes con comentarios · ordenados por prioridad</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          {generated&&<span style={{fontSize:"10px",padding:"3px 8px",borderRadius:"20px",background:`${D.accent}18`,color:D.accent,fontWeight:600}}>IA activa</span>}
          <span style={{color:D.ink3,fontSize:"12px",fontWeight:300}}>{open?"▲":"▼"}</span>
        </div>
      </button>
      {open&&(
        <div style={{borderTop:`1px solid ${D.border}`,padding:"1rem 1.5rem 1.5rem"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}}>
            <p style={{fontSize:"12px",color:D.ink3,margin:0}}>La IA lee tus comentarios y sugiere el próximo paso para cada cliente</p>
            <button onClick={generar} disabled={loading||!clientsWithNotes.length} style={{padding:"8px 16px",borderRadius:"10px",border:"none",background:loading?D.border:`linear-gradient(135deg,${D.accent},${D.accentMid})`,color:loading?D.ink3:D.white,fontSize:"12px",fontWeight:600,cursor:loading?"not-allowed":"pointer",opacity:!clientsWithNotes.length?0.5:1}}>
              {loading?"Analizando…":generated?"↻ Regenerar":"✦ Generar"}
            </button>
          </div>
          {!generated&&!loading&&(
            <div style={{borderRadius:"12px",border:`1px dashed ${D.border}`,background:D.bg,padding:"2.5rem",textAlign:"center",color:D.ink3,fontSize:"13px"}}>
              Apretá "Generar" para ver qué hacer con cada cliente
            </div>
          )}
          {loading&&<div style={{display:"flex",flexDirection:"column",gap:"8px"}}>{[...Array(4)].map((_,i)=><div key={i} style={{borderRadius:"10px",height:"60px",background:D.bg,animation:"pulse 1.5s infinite"}}/>)}</div>}
          {generated&&!loading&&(
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {pendientes.map(({client,resumen},i)=>{const p=stagePill(client.stage); return(
                <div key={i} style={{borderRadius:"12px",border:`1px solid ${p.bg==="white"?D.border:p.bg}`,background:p.bg,padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px",flexWrap:"wrap"}}>
                    <span style={{fontSize:"10px",fontWeight:700,color:p.c,textTransform:"uppercase",letterSpacing:"0.05em"}}>{client.stage}{client.subStage?` · ${client.subStage}`:""}</span>
                    <span style={{fontSize:"12px",fontWeight:600,color:D.ink}}>{client.companyName}</span>
                    {client.contactName&&<span style={{fontSize:"11px",color:D.ink3}}>— {client.contactName}</span>}
                  </div>
                  <p style={{fontSize:"13px",color:D.ink,margin:0,lineHeight:1.5}}>{resumen}</p>
                </div>
              );})}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pipeline P1 View ─────────────────────────────────────────────────────────
function PipelineP1View({clients,onEdit,onDelete,onBack}:{clients:ClientRecord[];onEdit:(id:string)=>void;onDelete:(id:string)=>void;onBack:()=>void}){
  const p1=clients.filter(c=>c.stage==="Pipeline P1");
  const signed=p1.filter(c=>c.subStage==="Contrato firmado");
  const active=p1.filter(c=>c.subStage!=="Contrato firmado");
  const bySubStage=useMemo(()=>{const map=new Map<SubStage,ClientRecord[]>(); for(const s of PIPELINE_SUBSTAGES.filter(s=>s!=="Contrato firmado"))map.set(s,[]); for(const c of active){const key=c.subStage&&c.subStage!=="Contrato firmado"?c.subStage:"Evaluación preliminar"; map.get(key)?.push(c);} return map;},[active]);
  return(
    <div style={{minHeight:"100dvh",background:D.bg}}>
      <style>{fontStyle}</style>
      <header style={{background:D.white,borderBottom:`1px solid ${D.border}`,position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:"1280px",margin:"0 auto",padding:"0.875rem 2rem",display:"flex",alignItems:"center",gap:"16px"}}>
          <button onClick={onBack} style={{padding:"7px 14px",borderRadius:"10px",border:`1px solid ${D.border}`,background:D.white,fontSize:"13px",cursor:"pointer",color:D.ink2,fontWeight:500}}>← Volver</button>
          <img src={LOGO_B64} alt="Solarity" style={{height:"36px",width:"auto"}}/>
          <div style={{width:"1px",height:"24px",background:D.border}}/>
          <span style={{fontSize:"16px",fontWeight:600,color:D.ink}}>Pipeline P1 — Detalle</span>
        </div>
      </header>
      <div style={{maxWidth:"1280px",margin:"0 auto",padding:"2rem"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"12px",marginBottom:"2rem"}}>
          <StatCard label="En gestión" value={active.length} unit="clientes"/>
          <StatCard label="MWp en gestión" value={active.reduce((s,c)=>s+(c.mwp||0),0).toFixed(2)} unit="MWp" accent/>
          <StatCard label="Contratos firmados" value={signed.length} unit="proyectos"/>
          <StatCard label="MWp firmado" value={signed.reduce((s,c)=>s+(c.mwp||0),0).toFixed(2)} unit="MWp"/>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"16px",marginBottom:"2rem"}}>
          {PIPELINE_SUBSTAGES.filter(s=>s!=="Contrato firmado").map(sub=>{
            const items=bySubStage.get(sub)??[];
            return(
              <div key={sub} style={{background:D.white,border:`1px solid ${D.border}`,borderRadius:"16px",padding:"1.25rem",borderLeft:`3px solid ${D.accent}`}}>
                <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"1rem"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:"13px",fontWeight:600,color:D.ink}}>{sub}</div>
                    <div style={{fontSize:"11px",color:D.ink3,marginTop:"2px"}}>{items.length} cliente{items.length!==1?"s":""}</div>
                  </div>
                  <span style={{fontSize:"12px",fontWeight:700,color:D.accent,background:`${D.accent}12`,padding:"4px 10px",borderRadius:"20px"}}>{SUBSTAGE_PROB[sub]}%</span>
                </div>
                {items.length?(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"10px"}}>
                    {items.map(c=><ClientCard key={c.id} client={c} onEdit={onEdit} onDelete={onDelete}/>)}
                  </div>
                ):(
                  <div style={{borderRadius:"10px",border:`1px dashed ${D.border}`,padding:"1rem",fontSize:"12px",color:D.ink3,textAlign:"center"}}>Sin clientes en esta etapa</div>
                )}
              </div>
            );
          })}
        </div>
        {signed.length>0&&(
          <div style={{background:D.signedBg,border:`1px solid ${D.signedBorder}`,borderRadius:"16px",padding:"1.25rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"1rem"}}>
              <span style={{fontSize:"18px"}}>✓</span>
              <div style={{fontSize:"13px",fontWeight:600,color:"#166534"}}>Contratos firmados · {signed.reduce((s,c)=>s+(c.mwp||0),0).toFixed(2)} MWp</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"10px"}}>
              {signed.map(c=><ClientCard key={c.id} client={c} onEdit={onEdit} onDelete={onDelete}/>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home(){
  const [clients,setClients]=useState<ClientRecord[]>([]);
  const [sheetStatus,setSheetStatus]=useState<"idle"|"loading"|"ok"|"error">("idle");
  const [query,setQuery]=useState("");
  const [view,setView]=useState<"dashboard"|"pipeline-p1">("dashboard");
  const [modalOpen,setModalOpen]=useState(false);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [draft,setDraft]=useState<ClientDraft>(EMPTY_DRAFT);
  const [extractTasksLoading,setExtractTasksLoading]=useState(false);

  const loadFromSheet=useCallback(async()=>{
    setSheetStatus("loading");
    try{const res=await fetch(SHEET_CSV_URL); if(!res.ok)throw new Error(); const csv=await res.text(); const parsed=parseCSVToClients(csv);
    if(parsed.length>0){const local=safeParseClients(localStorage.getItem(LOCAL_STORAGE_KEY)); const localMap=new Map(local.map(c=>[c.companyName.toLowerCase(),c])); const merged=parsed.map(c=>{const e=localMap.get(c.companyName.toLowerCase()); return e?{...c,id:e.id,aiTasks:e.aiTasks,aiPendiente:e.aiPendiente,createdAtISO:e.createdAtISO}:c;}); setClients(merged);localStorage.setItem(LOCAL_STORAGE_KEY,JSON.stringify(merged));setSheetStatus("ok");}
    else{setClients(safeParseClients(localStorage.getItem(LOCAL_STORAGE_KEY)));setSheetStatus("ok");}}
    catch{setClients(safeParseClients(localStorage.getItem(LOCAL_STORAGE_KEY)));setSheetStatus("error");}
  },[]);

  useEffect(()=>{loadFromSheet();},[loadFromSheet]);
  useEffect(()=>{if(sheetStatus!=="idle")localStorage.setItem(LOCAL_STORAGE_KEY,JSON.stringify(clients));},[clients,sheetStatus]);

  const filteredClients=useMemo(()=>{const q=query.trim().toLowerCase(); return clients.filter(c=>{if(!q)return true; return `${c.companyName} ${c.contactName} ${c.stage} ${c.subStage??""} ${c.nextAction} ${c.notes}`.toLowerCase().includes(q);});},[clients,query]);
  const byStage=useMemo(()=>{const map=new Map<Stage,ClientRecord[]>(); for(const s of STAGES)map.set(s,[]); for(const c of filteredClients)map.get(c.stage)?.push(c); return map;},[filteredClients]);

  const metrics=useMemo(()=>{
    const pipeline=clients.filter(c=>c.stage==="Pipeline P1"||c.stage==="Pipeline P2");
    const signed=clients.filter(c=>c.subStage==="Contrato firmado");
    const p1Active=clients.filter(c=>c.stage==="Pipeline P1"&&c.subStage!=="Contrato firmado");
    return{
      mwpTotal:pipeline.reduce((s,c)=>s+(c.mwp||0),0),
      totalPipeline:pipeline.length,
      mwpP1:p1Active.reduce((s,c)=>s+(c.mwp||0),0),
      mwpFirmado:signed.reduce((s,c)=>s+(c.mwp||0),0),
      mwpProb2026:pipeline.filter(c=>c.subStage!=="Contrato firmado"&&closingYear(c.subStage)===2026).reduce((s,c)=>s+(c.mwp||0)*(c.closeProbabilityPct/100),0),
      mwpProb2027:pipeline.filter(c=>c.subStage!=="Contrato firmado"&&closingYear(c.subStage)===2027).reduce((s,c)=>s+(c.mwp||0)*(c.closeProbabilityPct/100),0),
      p1Count:p1Active.length,
    };
  },[clients]);

  function openCreate(){setEditingId(null);setExtractTasksLoading(false);setDraft({...EMPTY_DRAFT,lastContactISO:todayISO()});setModalOpen(true);}
  function openEdit(id:string){const c=clients.find(x=>x.id===id);if(!c)return;setEditingId(id);setExtractTasksLoading(false);setDraft({companyName:c.companyName,contactName:c.contactName,stage:c.stage,subStage:c.subStage,mwp:c.mwp,closeProbabilityPct:c.closeProbabilityPct,lastContactISO:c.lastContactISO,nextAction:c.nextAction,notes:c.notes,aiTasks:c.aiTasks.map(t=>({...t})),aiPendiente:c.aiPendiente});setModalOpen(true);}
  function removeClient(id:string){const c=clients.find(x=>x.id===id);if(!c||!window.confirm(`¿Eliminar "${c.companyName}"?`))return;setClients(prev=>prev.filter(x=>x.id!==id));}
  function upsertClient(){if(!draft.companyName.trim()){window.alert("Ingresa el nombre de la empresa.");return;}const now=todayISO();let prob=0;if(draft.stage==="Pipeline P2")prob=5;else if(draft.stage==="Pipeline P1"&&draft.subStage)prob=SUBSTAGE_PROB[draft.subStage];const n={...draft,closeProbabilityPct:prob,subStage:(draft.stage==="Pipeline P1"||draft.stage==="Pipeline P2")?draft.subStage:undefined};if(!editingId){setClients(prev=>[{id:newId(),...n,createdAtISO:now,updatedAtISO:now},...prev]);}else{setClients(prev=>prev.map(c=>c.id===editingId?{...c,...n,updatedAtISO:now}:c));}setModalOpen(false);}
  async function extractTasksWithAI(){if(!draft.notes.trim()){window.alert("Escribe notas antes.");return;}setExtractTasksLoading(true);try{const res=await fetch("/api/extract-tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({notes:draft.notes})});const data=await res.json() as {tasks?:string[];error?:string};if(!res.ok){window.alert(data.error??"Error.");return;}setDraft(d=>({...d,aiTasks:(Array.isArray(data.tasks)?data.tasks:[]).map(text=>({id:newId(),text,done:false}))}));}catch{window.alert("Error de red.");}finally{setExtractTasksLoading(false);}}

  if(view==="pipeline-p1")return <PipelineP1View clients={clients} onEdit={openEdit} onDelete={removeClient} onBack={()=>setView("dashboard")}/>;

  const syncLabel=sheetStatus==="loading"?"Sincronizando…":sheetStatus==="ok"?"✓ Sincronizado":sheetStatus==="error"?"⚠ Error · Reintentar":"↻ Cargar";
  const syncColor=sheetStatus==="ok"?"#166534":sheetStatus==="error"?"#dc2626":D.ink2;

  return(
    <div style={{minHeight:"100dvh",background:D.bg}}>
      <style>{fontStyle}</style>

      {/* Header */}
      <header style={{background:D.white,borderBottom:`1px solid ${D.border}`,position:"sticky",top:0,zIndex:10}}>
        <div style={{maxWidth:"1280px",margin:"0 auto",padding:"0.875rem 2rem",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
            <img src={LOGO_B64} alt="Solarity" style={{height:"38px",width:"auto"}}/>
            <div style={{width:"1px",height:"28px",background:D.border}}/>
            <div>
              <div style={{fontSize:"15px",fontWeight:600,color:D.ink,fontFamily:"'DM Serif Display',serif"}}>CRM Comercial</div>
              <div style={{fontSize:"10px",color:D.ink3,letterSpacing:"0.06em",textTransform:"uppercase"}}>Pipeline de proyectos solares</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <button onClick={loadFromSheet} disabled={sheetStatus==="loading"} style={{padding:"7px 14px",borderRadius:"10px",border:`1px solid ${D.border}`,background:D.white,fontSize:"12px",cursor:"pointer",color:syncColor,fontWeight:500}}>
              {syncLabel}
            </button>
            <button onClick={openCreate} style={{padding:"8px 16px",borderRadius:"10px",border:"none",background:D.ink,fontSize:"12px",cursor:"pointer",color:D.white,fontWeight:600}}>
              + Cliente
            </button>
          </div>
        </div>
      </header>

      <div style={{maxWidth:"1280px",margin:"0 auto",padding:"2rem",display:"flex",flexDirection:"column",gap:"1.5rem"}}>

        {/* Pendientes IA */}
        <PendientesPanel clients={filteredClients}/>

        {/* Métricas */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"12px"}}>
          <StatCard label="Pipeline total" value={metrics.mwpTotal.toFixed(2)} unit="MWp" accent large/>
          <StatCard label="Clientes P1 + P2" value={metrics.totalPipeline} unit="proyectos"/>
          <StatCard label="MWp Pipeline P1" value={metrics.mwpP1.toFixed(2)} unit="MWp activos"/>
          <StatCard label="Probable cierre 2026" value={metrics.mwpProb2026.toFixed(2)} unit="MWp ponderado"/>
          <StatCard label="MWp firmado" value={metrics.mwpFirmado.toFixed(2)} unit="contratos cerrados"/>
        </div>

        {/* 2027 banner */}
        {metrics.mwpProb2027>0&&(
          <div style={{display:"flex",alignItems:"center",gap:"12px",background:D.white,border:`1px solid ${D.border}`,borderRadius:"12px",padding:"10px 16px"}}>
            <span style={{fontSize:"11px",fontWeight:600,color:"#7C3AED",textTransform:"uppercase",letterSpacing:"0.05em"}}>Probable cierre 2027</span>
            <span style={{fontSize:"15px",fontWeight:700,color:D.ink}}>{metrics.mwpProb2027.toFixed(2)} MWp</span>
            <span style={{fontSize:"11px",color:D.ink3}}>Proyectos que no cierran este año según plazos mínimos</span>
          </div>
        )}

        {/* Búsqueda */}
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar empresa o contacto…" style={{...inputStyle,maxWidth:"360px",background:D.white}}/>
          <span style={{fontSize:"12px",color:D.ink3}}>{filteredClients.length} de {clients.length} clientes</span>
        </div>

        {/* Chart */}
        <ClosingChart clients={filteredClients}/>

        {/* Pipeline P1 — protagonista */}
        <div>
          <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"1rem"}}>
            <div style={{width:"4px",height:"20px",borderRadius:"2px",background:`linear-gradient(${D.accent},${D.accentMid})`}}/>
            <span style={{fontSize:"16px",fontWeight:700,color:D.ink,fontFamily:"'DM Serif Display',serif"}}>Pipeline P1</span>
            <span style={{fontSize:"12px",color:D.ink3}}>{byStage.get("Pipeline P1")?.length??0} clientes · {(byStage.get("Pipeline P1")||[]).reduce((s,c)=>s+(c.mwp||0),0).toFixed(2)} MWp</span>
            <button onClick={()=>setView("pipeline-p1")} style={{marginLeft:"auto",padding:"7px 14px",borderRadius:"10px",border:`1px solid ${D.p1border}`,background:D.p1bg,fontSize:"12px",cursor:"pointer",color:D.accent,fontWeight:600}}>
              Ver detalle →
            </button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"10px"}}>
            {(byStage.get("Pipeline P1")||[]).length?(byStage.get("Pipeline P1")||[]).map(c=><ClientCard key={c.id} client={c} onEdit={openEdit} onDelete={removeClient}/>):(<div style={{gridColumn:"1/-1",borderRadius:"12px",border:`1px dashed ${D.border}`,padding:"2rem",textAlign:"center",fontSize:"13px",color:D.ink3}}>Sin clientes en Pipeline P1</div>)}
          </div>
        </div>

        {/* Pipeline P2 */}
        <div>
          <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"1rem"}}>
            <div style={{width:"4px",height:"16px",borderRadius:"2px",background:D.accentMid}}/>
            <span style={{fontSize:"14px",fontWeight:600,color:D.ink}}>Pipeline P2</span>
            <span style={{fontSize:"12px",color:D.ink3}}>{byStage.get("Pipeline P2")?.length??0} clientes</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"10px"}}>
            {(byStage.get("Pipeline P2")||[]).length?(byStage.get("Pipeline P2")||[]).map(c=><ClientCard key={c.id} client={c} onEdit={openEdit} onDelete={removeClient}/>):(<div style={{gridColumn:"1/-1",borderRadius:"12px",border:`1px dashed ${D.border}`,padding:"1.5rem",textAlign:"center",fontSize:"12px",color:D.ink3}}>Sin clientes</div>)}
          </div>
        </div>

        {/* Prospectos — compactos */}
        <div>
          <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"1rem"}}>
            <div style={{width:"4px",height:"12px",borderRadius:"2px",background:D.border}}/>
            <span style={{fontSize:"13px",fontWeight:500,color:D.ink3}}>Prospectos</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"16px"}}>
            {(["Prospecto Activo","Prospecto Pasivo"] as Stage[]).map(stage=>{
              const items=byStage.get(stage)||[];
              return(
                <div key={stage} style={{background:D.white,border:`1px solid ${D.border}`,borderRadius:"14px",padding:"1rem"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
                    <span style={{fontSize:"12px",fontWeight:600,color:D.ink2}}>{stage}</span>
                    <span style={{fontSize:"11px",color:D.ink3}}>{items.length} clientes</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:"8px",maxHeight:"320px",overflowY:"auto"}}>
                    {items.length?items.map(c=><ClientCard key={c.id} client={c} onEdit={openEdit} onDelete={removeClient}/>):(<div style={{borderRadius:"10px",border:`1px dashed ${D.border}`,padding:"1rem",textAlign:"center",fontSize:"12px",color:D.ink3}}>Sin clientes</div>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Modal */}
      <Modal open={modalOpen} title={editingId?"Editar cliente":"Agregar cliente"} onClose={()=>setModalOpen(false)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
          <FLabel label="Nombre empresa" hint="Requerido"><input value={draft.companyName} onChange={e=>setDraft(d=>({...d,companyName:e.target.value}))} style={inputStyle} placeholder="Ej: Soluciones Energéticas S.A."/></FLabel>
          <FLabel label="Nombre contacto"><input value={draft.contactName} onChange={e=>setDraft(d=>({...d,contactName:e.target.value}))} style={inputStyle} placeholder="Ej: Ana Pérez"/></FLabel>
          <FLabel label="Etapa">
            <select value={draft.stage} onChange={e=>setDraft(d=>({...d,stage:e.target.value as Stage,subStage:undefined}))} style={inputStyle}>
              {STAGES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </FLabel>
          <FLabel label="Sub-etapa" hint={(draft.stage==="Pipeline P1"||draft.stage==="Pipeline P2")?"Recomendado":"N/A"}>
            <select value={draft.subStage??""} onChange={e=>setDraft(d=>({...d,subStage:(e.target.value||undefined) as SubStage|undefined}))} disabled={draft.stage!=="Pipeline P1"&&draft.stage!=="Pipeline P2"} style={{...inputStyle,opacity:(draft.stage!=="Pipeline P1"&&draft.stage!=="Pipeline P2")?0.5:1}}>
              <option value="">(Sin sub-etapa)</option>
              {PIPELINE_SUBSTAGES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </FLabel>
          <FLabel label="MWp de propuesta"><input inputMode="decimal" value={String(draft.mwp)} onChange={e=>{const n=Number(e.target.value.replace(",",".")); setDraft(d=>({...d,mwp:Number.isFinite(n)?n:0}));}} style={inputStyle}/></FLabel>
          <FLabel label="Probabilidad" hint="Automática">
            <div style={{...inputStyle,background:D.bg,color:D.ink3,cursor:"default"}}>
              {draft.stage==="Pipeline P2"?"5% (Pipeline P2)":draft.subStage?`${SUBSTAGE_PROB[draft.subStage]}% — ${draft.subStage}`:"—"}
            </div>
          </FLabel>
          <FLabel label="Último contacto"><input type="date" value={draft.lastContactISO} onChange={e=>setDraft(d=>({...d,lastContactISO:e.target.value}))} style={inputStyle}/></FLabel>
          <div style={{gridColumn:"1/-1"}}><FLabel label="Comentario / último movimiento"><input value={draft.nextAction} onChange={e=>setDraft(d=>({...d,nextAction:e.target.value}))} style={inputStyle} placeholder="¿Qué pasó? ¿Qué falta hacer?"/></FLabel></div>
          <div style={{gridColumn:"1/-1"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"6px"}}>
              <span style={{fontSize:"12px",fontWeight:500,color:D.ink2}}>Notas adicionales</span>
              <button disabled={extractTasksLoading} onClick={extractTasksWithAI} style={{padding:"5px 12px",borderRadius:"8px",border:`1px solid #DDD6FE`,background:"#F5F3FF",fontSize:"11px",cursor:"pointer",color:"#7C3AED",fontWeight:500}}>
                {extractTasksLoading?"Extrayendo…":"Extraer tareas con IA"}
              </button>
            </div>
            <textarea value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))} rows={3} style={{...inputStyle,resize:"vertical"}} placeholder="Contexto, objeciones, acuerdos…"/>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:"8px",marginTop:"1.25rem",paddingTop:"1rem",borderTop:`1px solid ${D.border}`}}>
          <button onClick={()=>setModalOpen(false)} style={{padding:"8px 16px",borderRadius:"10px",border:`1px solid ${D.border}`,background:D.white,fontSize:"13px",cursor:"pointer",color:D.ink2,fontWeight:500}}>Cancelar</button>
          <button onClick={upsertClient} style={{padding:"8px 18px",borderRadius:"10px",border:"none",background:D.ink,fontSize:"13px",cursor:"pointer",color:D.white,fontWeight:600}}>Guardar</button>
        </div>
      </Modal>
    </div>
  );
}
