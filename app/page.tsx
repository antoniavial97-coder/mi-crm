"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

// --- Types --------------------------------------------------------------------
type Stage = "Prospecto Pasivo" | "Prospecto Activo" | "Pipeline P2" | "Pipeline P1" | "Perdido";
type SubStage =
  | "Evaluación preliminar" | "Primera presentación preliminar"
  | "Visita técnica realizada" | "Presentación final"
  | "Contrato en revisión" | "Contrato firmado";
type Tab = "dashboard" | "pipeline1" | "pipeline2" | "prospectos" | "perdidos" | "semana";
type FollowUp = { id: string; text: string; dueDateISO: string; done: boolean; dismissed: boolean; };
type ClientTask = { id: string; text: string; done: boolean; followUp?: FollowUp; };
type Meeting = { id: string; date: string; type: "reunion"|"llamado"|"correo"; subject?: string; summary?: string; notes?: string; fromDiio?: boolean; };
type ClientRecord = {
  id: string; companyName: string; contactName: string;
  stage: Stage; subStage?: SubStage; mwp: number; closeProbabilityPct: number;
  lastContactISO: string; nextAction: string; notes: string; stageDate?: string;
  aiTasks: ClientTask[]; meetings: Meeting[]; salesforce?: boolean; ingressDate?: string; createdAtISO: string; updatedAtISO: string;
};
type ContactInfo = { company: string; name: string; email: string; phone: string; };
type TranscriptInfo = { company: string; date: string; transcript: string; };

// --- Constants ----------------------------------------------------------------
const LOCAL_STORAGE_KEY = "solar-crm:v8";
const ANNUAL_GOAL_MWP = 5;
const START_MONTH = "2026-03"; // Marzo 2026
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQx9xTTA1PLUjIbfcEQa4J8s-vazmF_VGGgDQwP4CEoPI3Dy1oimVkRg3YLeFRvyP04IvY5fgMVci2t/pub?gid=0&single=true&output=csv";
const CONTACTS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQx9xTTA1PLUjIbfcEQa4J8s-vazmF_VGGgDQwP4CEoPI3Dy1oimVkRg3YLeFRvyP04IvY5fgMVci2t/pub?gid=652559693&single=true&output=csv";
const TRANSCRIPTS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQx9xTTA1PLUjIbfcEQa4J8s-vazmF_VGGgDQwP4CEoPI3Dy1oimVkRg3YLeFRvyP04IvY5fgMVci2t/pub?gid=1050795278&single=true&output=csv";
const LOGO_B64 = "data:image/webp;base64,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";

const SUBSTAGE_PROB: Record<SubStage,number> = {
  "Evaluación preliminar":5,"Primera presentación preliminar":10,
  "Visita técnica realizada":15,"Presentación final":25,
  "Contrato en revisión":50,"Contrato firmado":100,
};
const SUBSTAGE_MONTHS: Record<SubStage,number> = {
  "Evaluación preliminar":8,"Primera presentación preliminar":8,
  "Visita técnica realizada":7,"Presentación final":5,
  "Contrato en revisión":2,"Contrato firmado":0,
};
const P1_SUBSTAGE_ORDER: SubStage[] = [
  "Contrato en revisión","Presentación final","Visita técnica realizada",
  "Primera presentación preliminar","Evaluación preliminar","Contrato firmado",
];
const STAGES: Stage[] = ["Prospecto Pasivo","Prospecto Activo","Pipeline P2","Pipeline P1","Perdido"];
const D = {
  bg:"#F8F7F4", white:"#FFFFFF", ink:"#1A1A1A", ink2:"#4A4A4A", ink3:"#8A8A8A",
  border:"#E8E6E1", accent:"#E8500A", accentY:"#F5B800",
  signedBg:"#F0FBF4", signedBorder:"#9FD4AF",
  alarmBg:"#FFF5F5", alarmBorder:"#FCA5A5",
  lostBg:"#FFF5F5", lostBorder:"#FCA5A5",
};
const fontStyle = `@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap'); *{font-family:'DM Sans',sans-serif;}`;
const iStyle: React.CSSProperties = {width:"100%",padding:"9px 12px",borderRadius:"10px",border:`1px solid ${D.border}`,background:D.white,fontSize:"13px",color:D.ink,outline:"none",boxSizing:"border-box"};

// --- Utils --------------------------------------------------------------------
function todayISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function addDays(iso:string,days:number){const d=new Date(iso);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}
function isPast(iso:string){return new Date(iso)<new Date();}
function newId(){if(typeof crypto!=="undefined"&&"randomUUID" in crypto)return (crypto as unknown as {randomUUID:()=>string}).randomUUID();return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;}
function closingDate(subStage:SubStage|undefined,stageDate?:string):Date|null{
  if(!subStage||subStage==="Contrato firmado")return null;
  if(subStage==="Presentación final"&&stageDate){const base=new Date(stageDate);if(!isNaN(base.getTime()))return new Date(base.getFullYear(),base.getMonth()+5,base.getDate());}
  const months=SUBSTAGE_MONTHS[subStage];const today=new Date();return new Date(today.getFullYear(),today.getMonth()+months,today.getDate());
}
function closingMonthKey(subStage:SubStage|undefined,stageDate?:string):string|null{const d=closingDate(subStage,stageDate);if(!d)return null;return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}
function monthLabel(key:string){const [y,m]=key.split("-");const names=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];return `${names[parseInt(m)-1]} ${y}`;}
function formatDateShort(iso:string):string{if(!iso)return "";const d=new Date(iso);if(isNaN(d.getTime()))return iso;return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;}
function monthKey(iso:string):string{if(!iso)return "";const d=new Date(iso);if(isNaN(d.getTime()))return "";return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;}

// --- CSV Parsers --------------------------------------------------------------
function parseCSVLine(line:string):string[]{const r:string[]=[]; let c="",q=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++;}else q=!q;}else if(ch===','&&!q){r.push(c.trim());c="";}else c+=ch;}r.push(c.trim());return r;}
function normalizeStage(raw:string):Stage{const s=raw.toLowerCase().trim(); if(s.includes("perdido")||s.includes("lost"))return "Perdido"; if(s.includes("pipeline 1")||s.includes("pipeline p1")||s==="p1")return "Pipeline P1"; if(s.includes("pipeline 2")||s.includes("pipeline p2")||s==="p2")return "Pipeline P2"; if(s.includes("prospecto activo"))return "Prospecto Activo"; if(s.includes("prospecto pasivo"))return "Prospecto Pasivo"; if(s.includes("pipeline"))return "Pipeline P1"; return "Prospecto Pasivo";}
function normalizeSubStage(raw:string):SubStage|undefined{const s=raw.toLowerCase().trim(); if(!s)return undefined; if(s.includes("evaluación preliminar")||s.includes("evaluacion preliminar"))return "Evaluación preliminar"; if(s.includes("primera presentación")||s.includes("primera presentacion")||s.includes("presentación preliminar")||s.includes("presentacion preliminar"))return "Primera presentación preliminar"; if(s.includes("visita técnica")||s.includes("visita tecnica"))return "Visita técnica realizada"; if(s.includes("presentación final")||s.includes("presentacion final"))return "Presentación final"; if(s.includes("revisión")||s.includes("revision")||s.includes("contrato en"))return "Contrato en revisión"; if(s.includes("firmado")||s.includes("firma"))return "Contrato firmado"; return undefined;}

function parseClientsCSV(csv:string):ClientRecord[]{
  const lines=csv.trim().split("\n").filter(Boolean); if(lines.length<2)return [];
  let hLine=0; for(let i=0;i<Math.min(5,lines.length);i++){if(parseCSVLine(lines[i]).some(c=>c.trim().length>1)){hLine=i;break;}}
  const hdrs=parseCSVLine(lines[hLine]).map(h=>h.toLowerCase().trim());
  const col=(name:string)=>{const v:Record<string,string[]>={company:["empresa","company","nombre"],contact:["contacto","contact"],stage:["etapa","stage"],substage:["subetapa","sub-etapa","substage","subestage"],mwp:["kwp","mwp","kw","mw","potencia"],nextaction:["comentario","pendiente","accion","nextaction"],notes:["notas","notes"],stagedate:["fecha etapa","fecha_etapa","stagedate","fechaetapa","fecha de etapa"],salesforce:["salesforce"],ingressdate:["fecha de ingreso al pipeline","fecha ingreso","fecha_ingreso","ingressdate"]}; return hdrs.findIndex(h=>(v[name]??[name]).some(k=>h.includes(k)));};
  const idx={company:col("company"),contact:col("contact"),stage:col("stage"),substage:col("substage"),mwp:col("mwp"),nextaction:col("nextaction"),notes:col("notes"),stagedate:col("stagedate"),salesforce:col("salesforce"),ingressdate:col("ingressdate")};
  const now=todayISO();
  return lines.slice(hLine+1).map(line=>{
    const cols=parseCSVLine(line);
    const get=(i:number)=>(i>=0?(cols[i]??"").trim():"");
    const getNum=(i:number)=>{const v=get(i); const n=Number(v.replace(/\./g,"").replace(",",".").trim()); return Number.isFinite(n)?n:0;};
    const companyName=get(idx.company); if(!companyName)return null;
    const stage=normalizeStage(get(idx.stage));
    const subStage=(stage==="Pipeline P1"||stage==="Pipeline P2")?normalizeSubStage(get(idx.substage)):undefined;
    const mwp=getNum(idx.mwp);
    const stageDate=idx.stagedate>=0?get(idx.stagedate):undefined;
    const salesforce=idx.salesforce>=0?/^s[ií]/i.test(get(idx.salesforce)):false;
    const ingressDate=idx.ingressdate>=0?get(idx.ingressdate):undefined;
    let prob=0; if(stage==="Pipeline P2")prob=5; else if(stage==="Pipeline P1"&&subStage)prob=SUBSTAGE_PROB[subStage];
    return {id:newId(),companyName,contactName:get(idx.contact),stage,subStage,mwp,closeProbabilityPct:prob,lastContactISO:"",nextAction:get(idx.nextaction),notes:get(idx.notes),stageDate:stageDate||undefined,salesforce,ingressDate:ingressDate||undefined,aiTasks:[],meetings:[],createdAtISO:now,updatedAtISO:now};
  }).filter(Boolean) as ClientRecord[];
}

function parseContactsCSV(csv:string):ContactInfo[]{
  const lines=csv.trim().split("\n").filter(Boolean); if(lines.length<2)return [];
  let hLine=0; for(let i=0;i<Math.min(5,lines.length);i++){if(parseCSVLine(lines[i]).some(c=>c.trim().length>1)){hLine=i;break;}}
  const hdrs=parseCSVLine(lines[hLine]).map(h=>h.toLowerCase().trim());
  const col=(names:string[])=>hdrs.findIndex(h=>names.some(n=>h.includes(n)));
  const idx={company:col(["empresa","company"]),name:col(["contacto","nombre","contact","name"]),email:col(["email","correo","mail"]),phone:col(["teléfono","telefono","phone","tel","cel","número"])};
  return lines.slice(hLine+1).map(line=>{
    const cols=parseCSVLine(line);
    const get=(i:number)=>(i>=0?(cols[i]??"").trim():"");
    const company=get(idx.company); if(!company)return null;
    return {company,name:get(idx.name),email:get(idx.email),phone:get(idx.phone)};
  }).filter(Boolean) as ContactInfo[];
}

function parseTranscriptsCSV(csv:string):TranscriptInfo[]{
  const lines=csv.trim().split("\n").filter(Boolean); if(lines.length<2)return [];
  let hLine=0; for(let i=0;i<Math.min(5,lines.length);i++){if(parseCSVLine(lines[i]).some(c=>c.trim().length>1)){hLine=i;break;}}
  const hdrs=parseCSVLine(lines[hLine]).map(h=>h.toLowerCase().trim());
  const col=(names:string[])=>hdrs.findIndex(h=>names.some(n=>h.includes(n)));
  const idx={company:col(["empresa","company"]),date:col(["fecha","date"]),transcript:col(["transcripción","transcripcion","transcript","texto"])};
  return lines.slice(hLine+1).map(line=>{
    const cols=parseCSVLine(line);
    const get=(i:number)=>(i>=0?(cols[i]??"").trim():"");
    const company=get(idx.company); if(!company)return null;
    return {company,date:get(idx.date),transcript:get(idx.transcript)};
  }).filter(Boolean) as TranscriptInfo[];
}

function safeParseClients(raw:string|null):ClientRecord[]{
  if(!raw)return []; try{const data=JSON.parse(raw) as unknown; if(!Array.isArray(data))return [];
  return (data as Partial<ClientRecord>[]).filter(x=>typeof x.id==="string"&&typeof x.companyName==="string").map(x=>({
    id:x.id!,companyName:x.companyName??"",contactName:x.contactName??"",
    stage:(x.stage as Stage)??"Prospecto Pasivo",subStage:x.subStage as SubStage|undefined,
    mwp:typeof x.mwp==="number"?x.mwp:0,closeProbabilityPct:typeof x.closeProbabilityPct==="number"?x.closeProbabilityPct:0,
    lastContactISO:(x as Record<string,unknown>).lastContactISO as string||"",nextAction:x.nextAction??"",notes:x.notes??"",stageDate:x.stageDate as string|undefined,salesforce:Boolean((x as Record<string,unknown>).salesforce),ingressDate:(x as Record<string,unknown>).ingressDate as string|undefined,
    aiTasks:Array.isArray((x as Record<string,unknown>).aiTasks)
      ?((x as Record<string,unknown>).aiTasks as Array<Record<string,unknown>>).map((t)=>({id:String(t.id||newId()),text:String(t.text||""),done:Boolean(t.done),followUp:t.followUp as FollowUp|undefined}))
      :[],
    meetings:Array.isArray((x as Record<string,unknown>).meetings)
      ?((x as Record<string,unknown>).meetings as Array<Record<string,unknown>>).map((m)=>({id:String(m.id||newId()),date:String(m.date||""),type:(m.type as "reunion"|"llamado"|"correo")||"reunion",subject:m.subject as string|undefined,summary:m.summary as string|undefined,notes:m.notes as string|undefined,fromDiio:Boolean(m.fromDiio)}))
      :[],
    createdAtISO:typeof x.createdAtISO==="string"?x.createdAtISO:todayISO(),
    updatedAtISO:typeof x.updatedAtISO==="string"?x.updatedAtISO:todayISO(),
  }));}catch{return [];}}

// --- Modal --------------------------------------------------------------------
function Modal({open,title,children,onClose,wide}:{open:boolean;title:string;children:React.ReactNode;onClose:()=>void;wide?:boolean}){
  const ref=useRef<HTMLDivElement|null>(null);
  useEffect(()=>{if(!open)return; const fn=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();}; window.addEventListener("keydown",fn); return ()=>window.removeEventListener("keydown",fn);},[open,onClose]);
  if(!open)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.3)",backdropFilter:"blur(4px)",padding:"1rem"}} onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div ref={ref} style={{width:"100%",maxWidth:wide?"860px":"640px",background:D.white,borderRadius:"20px",boxShadow:"0 24px 80px rgba(0,0,0,0.12)",display:"flex",flexDirection:"column",maxHeight:"90vh",outline:"none"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1.1rem 1.5rem",borderBottom:`1px solid ${D.border}`,flexShrink:0}}>
          <span style={{fontSize:"15px",fontWeight:600,color:D.ink}}>{title}</span>
          <button onClick={onClose} style={{padding:"5px 12px",borderRadius:"8px",border:`1px solid ${D.border}`,background:D.white,fontSize:"12px",cursor:"pointer",color:D.ink2}}>Cerrar</button>
        </div>
        <div style={{overflowY:"auto",padding:"1.25rem 1.5rem",flex:1}}>{children}</div>
      </div>
    </div>
  );
}

// --- Copy Button --------------------------------------------------------------
function CopyButton({text}:{text:string}){
  const [copied,setCopied]=useState(false);
  function copy(){navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1500);});}
  return(
    <button onClick={copy} title="Copiar correo" style={{background:"none",border:"none",cursor:"pointer",padding:"0 0 0 4px",color:copied?"#22c55e":D.ink3,fontSize:"11px",verticalAlign:"middle"}}>
      {copied?"✓":"⧉"}
    </button>
  );
}

// --- Contact Popup ------------------------------------------------------------
function ContactPopup({contacts,companyName,contactName}:{contacts:ContactInfo[];companyName:string;contactName:string}){
  const [show,setShow]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  const matches=contacts.filter(c=>c.company.toLowerCase()===companyName.toLowerCase()&&(!contactName||c.name.toLowerCase().includes(contactName.toLowerCase())));
  useEffect(()=>{if(!show)return; const fn=(e:MouseEvent)=>{if(ref.current&&!ref.current.contains(e.target as Node))setShow(false);}; document.addEventListener("mousedown",fn); return ()=>document.removeEventListener("mousedown",fn);},[show]);
  if(!contactName)return <span style={{fontSize:"12px",color:D.ink3}}>—</span>;
  return(
    <div style={{position:"relative",display:"inline-block"}} ref={ref}>
      <button onClick={()=>setShow(s=>!s)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"12px",color:matches.length?D.accent:D.ink2,fontWeight:matches.length?500:400,padding:0,textDecoration:matches.length?"underline dotted":"none"}}>{contactName}</button>
      {show&&(
        <div style={{position:"absolute",top:"100%",left:0,zIndex:40,marginTop:"4px",background:D.white,border:`1px solid ${D.border}`,borderRadius:"12px",boxShadow:"0 8px 32px rgba(0,0,0,0.12)",padding:"12px 16px",minWidth:"240px",whiteSpace:"nowrap"}}>
          {matches.length?(matches.map((m,i)=>(
            <div key={i} style={{marginBottom:i<matches.length-1?"10px":"0"}}>
              <div style={{fontSize:"12px",fontWeight:600,color:D.ink,marginBottom:"4px"}}>{m.name||contactName}</div>
              {m.email&&<div style={{fontSize:"11px",color:D.ink2,marginBottom:"2px",display:"flex",alignItems:"center"}}>✉ {m.email}<CopyButton text={m.email}/></div>}
              {m.phone&&<div style={{fontSize:"11px",color:D.ink2}}>📞 {m.phone}</div>}
              {!m.email&&!m.phone&&<div style={{fontSize:"11px",color:D.ink3}}>Sin datos aún</div>}
            </div>
          ))):(
            <div style={{fontSize:"11px",color:D.ink3}}>Sin datos en hoja de contactos</div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Client Detail Modal (Reuniones + Llamados) -------------------------------
function ClientDetailModal({client,transcripts,onUpdateMeetings,onClose}:{client:ClientRecord;transcripts:TranscriptInfo[];onUpdateMeetings:(meetings:Meeting[])=>void;onClose:()=>void}){
  const [meetings,setMeetings]=useState<Meeting[]>(()=>{
    // Merge Diio transcripts as meetings
    const diioMeetings=transcripts
      .filter(t=>t.company.toLowerCase()===client.companyName.toLowerCase())
      .map(t=>({id:`diio-${t.date}-${t.company}`,date:t.date,type:"reunion" as const,summary:undefined,notes:t.transcript,fromDiio:true}));
    const existing=client.meetings||[];
    const diioIds=new Set(diioMeetings.map(m=>m.id));
    return [...existing.filter(m=>!m.fromDiio),...diioMeetings].sort((a,b)=>b.date.localeCompare(a.date));
  });
  const [showForm,setShowForm]=useState(false);
  const [newMeeting,setNewMeeting]=useState<{date:string;type:"reunion"|"llamado"|"correo";subject:string;notes:string}>({date:todayISO(),type:"reunion",subject:"",notes:""});
  const [summarizing,setSummarizing]=useState<string|null>(null);
  const [summaries,setSummaries]=useState<Record<string,string>>({});

  function addMeeting(){
    if(!newMeeting.notes.trim()&&!newMeeting.subject.trim())return;
    const m:Meeting={id:newId(),date:newMeeting.date,type:newMeeting.type,subject:newMeeting.subject||undefined,notes:newMeeting.notes,fromDiio:false};
    const updated=[m,...meetings].sort((a,b)=>b.date.localeCompare(a.date));
    setMeetings(updated);
    onUpdateMeetings(updated.filter(x=>!x.fromDiio));
    setNewMeeting({date:todayISO(),type:"reunion",subject:"",notes:""});
    setShowForm(false);
  }

  function deleteMeeting(id:string){
    const updated=meetings.filter(m=>m.id!==id);
    setMeetings(updated);
    onUpdateMeetings(updated.filter(x=>!x.fromDiio));
  }

  async function summarize(meeting:Meeting){
    if(!meeting.notes||summaries[meeting.id])return;
    setSummarizing(meeting.id);
    try{
      const res=await fetch("/api/generate-actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({company:client.companyName,stage:client.stage,comment:`Resume en 2-3 líneas qué pasó en esta ${meeting.type}: ${meeting.notes.substring(0,800)}`,transcripts:[]})});
      const data=await res.json() as {tasks?:string[]};
      setSummaries(prev=>({...prev,[meeting.id]:data.tasks?.[0]||"Sin resumen disponible"}));
    }catch{setSummaries(prev=>({...prev,[meeting.id]:"Error al generar resumen"}));}
    setSummarizing(null);
  }

  return(
    <div>
      {/* Historial de etapa */}
      {client.stageDate&&(
        <div style={{background:D.bg,borderRadius:"10px",padding:"10px 14px",marginBottom:"1rem",display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          <div style={{fontSize:"11px",color:D.ink3}}>Etapa actual:</div>
          <div style={{fontSize:"12px",fontWeight:600,color:D.accent}}>{client.subStage||client.stage}</div>
          <div style={{fontSize:"11px",color:D.ink3}}>desde</div>
          <div style={{fontSize:"12px",fontWeight:500,color:D.ink}}>{formatDateShort(client.stageDate)}</div>
          <div style={{fontSize:"11px",color:D.ink3}}>·</div>
          <div style={{fontSize:"12px",fontWeight:600,color:Math.floor((new Date().getTime()-new Date(client.stageDate).getTime())/(1000*60*60*24))>30?"#dc2626":"#16a34a"}}>
            {Math.floor((new Date().getTime()-new Date(client.stageDate).getTime())/(1000*60*60*24))} días en esta etapa
          </div>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
        <div style={{fontSize:"13px",color:D.ink3}}>{meetings.length} interacciones registradas</div>
        <button onClick={()=>setShowForm(s=>!s)} style={{padding:"7px 14px",borderRadius:"9px",border:"none",background:D.ink,color:D.white,fontSize:"12px",cursor:"pointer",fontWeight:600}}>
          + Agregar
        </button>
      </div>

      {showForm&&(
        <div style={{background:D.bg,borderRadius:"12px",padding:"14px",marginBottom:"1rem",display:"flex",flexDirection:"column",gap:"10px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <div>
              <div style={{fontSize:"11px",color:D.ink2,marginBottom:"4px",fontWeight:500}}>Fecha</div>
              <input type="date" value={newMeeting.date} onChange={e=>setNewMeeting(p=>({...p,date:e.target.value}))} style={iStyle}/>
            </div>
            <div>
              <div style={{fontSize:"11px",color:D.ink2,marginBottom:"4px",fontWeight:500}}>Tipo</div>
              <select value={newMeeting.type} onChange={e=>setNewMeeting(p=>({...p,type:e.target.value as "reunion"|"llamado"|"correo"}))} style={iStyle}>
                <option value="reunion">📅 Reunión</option>
                <option value="llamado">📞 Llamado</option>
                <option value="correo">✉ Correo</option>
              </select>
            </div>
          </div>
          {newMeeting.type==="correo"&&(
            <div>
              <div style={{fontSize:"11px",color:D.ink2,marginBottom:"4px",fontWeight:500}}>Asunto del correo</div>
              <input value={newMeeting.subject} onChange={e=>setNewMeeting(p=>({...p,subject:e.target.value}))} style={iStyle} placeholder="Ej: Propuesta comercial Agrícola San Osvaldo"/>
            </div>
          )}
          <div>
            <div style={{fontSize:"11px",color:D.ink2,marginBottom:"4px",fontWeight:500}}>{newMeeting.type==="correo"?"Contenido / resumen del correo":"Notas"}</div>
            <textarea value={newMeeting.notes} onChange={e=>setNewMeeting(p=>({...p,notes:e.target.value}))} rows={3} style={{...iStyle,resize:"vertical"}} placeholder={newMeeting.type==="correo"?"¿Qué decía el correo? ¿Qué respondiste?":"¿Qué se habló? ¿Cuáles fueron los acuerdos?"}/>
          </div>
          <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
            <button onClick={()=>setShowForm(false)} style={{padding:"6px 12px",borderRadius:"8px",border:`1px solid ${D.border}`,background:D.white,fontSize:"12px",cursor:"pointer",color:D.ink2}}>Cancelar</button>
            <button onClick={addMeeting} style={{padding:"6px 14px",borderRadius:"8px",border:"none",background:D.accent,color:D.white,fontSize:"12px",cursor:"pointer",fontWeight:600}}>Guardar</button>
          </div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
        {meetings.length===0&&<div style={{textAlign:"center",color:D.ink3,fontSize:"12px",padding:"2rem",border:`1px dashed ${D.border}`,borderRadius:"12px"}}>Sin interacciones registradas todavía</div>}
        {meetings.map(m=>(
          <div key={m.id} style={{background:D.bg,borderRadius:"12px",padding:"12px 14px",border:`1px solid ${D.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}>
              <span style={{fontSize:"11px",fontWeight:600,color:D.white,background:m.type==="reunion"?D.accent:m.type==="llamado"?"#7C3AED":"#0891b2",padding:"2px 8px",borderRadius:"20px"}}>
                {m.type==="reunion"?"📅 Reunión":m.type==="llamado"?"📞 Llamado":"✉ Correo"}
              </span>
              <span style={{fontSize:"11px",color:D.ink3}}>{formatDateShort(m.date)}</span>
              {m.fromDiio&&<span style={{fontSize:"9px",color:"#7C3AED",background:"#F5F3FF",padding:"1px 6px",borderRadius:"10px",fontWeight:500}}>Diio</span>}
              <div style={{flex:1}}/>
              {!m.fromDiio&&<button onClick={()=>deleteMeeting(m.id)} style={{background:"none",border:"none",cursor:"pointer",color:D.ink3,fontSize:"12px",padding:"2px 6px"}}>×</button>}
            </div>
            {m.subject&&(
              <div style={{fontSize:"12px",fontWeight:500,color:D.ink,marginBottom:"4px"}}>📌 {m.subject}</div>
            )}
            {m.notes&&(
              <div style={{fontSize:"12px",color:D.ink2,lineHeight:1.5,marginBottom:"6px",maxHeight:"80px",overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>
                {m.notes}
              </div>
            )}
            {summaries[m.id]&&(
              <div style={{background:D.white,borderRadius:"8px",padding:"8px 10px",fontSize:"11px",color:D.ink2,borderLeft:`2px solid ${D.accent}`,marginTop:"6px"}}>
                <span style={{fontWeight:600,color:D.accent,marginRight:"4px"}}>Resumen IA:</span>{summaries[m.id]}
              </div>
            )}
            {m.fromDiio&&m.notes&&!summaries[m.id]&&(
              <button onClick={()=>summarize(m)} disabled={summarizing===m.id} style={{marginTop:"4px",padding:"3px 10px",borderRadius:"7px",border:`1px solid ${D.border}`,background:D.white,fontSize:"11px",cursor:"pointer",color:D.ink2}}>
                {summarizing===m.id?"Resumiendo…":"✦ Resumir con IA"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const DIAS_ALERTA = 14;
const RECENT_CONTACTS_KEY = "solar-crm:recent-contacts";
const MI_DIA_KEY = "solar-crm:midia";
type DailyTask = { id: string; text: string; done: boolean; date: string; clientId?: string; clientName?: string; };

function getRecentContacts():Record<string,string>{
  try{const raw=localStorage.getItem(RECENT_CONTACTS_KEY);return raw?JSON.parse(raw):{};}catch{return {};}
}
function saveRecentContact(clientId:string,date:string){
  try{const data=getRecentContacts();data[clientId]=date;localStorage.setItem(RECENT_CONTACTS_KEY,JSON.stringify(data));}catch{}
}
function getLastActivity(c:ClientRecord,transcripts:TranscriptInfo[],recentContacts:Record<string,string>):Date|null{
  const fechas:Date[]=[];
  if(c.stageDate){const d=new Date(c.stageDate);if(!isNaN(d.getTime()))fechas.push(d);}
  if(c.lastContactISO){const d=new Date(c.lastContactISO);if(!isNaN(d.getTime()))fechas.push(d);}
  if(recentContacts[c.id]){const d=new Date(recentContacts[c.id]);if(!isNaN(d.getTime()))fechas.push(d);}
  for(const m of (c.meetings||[])){const d=new Date(m.date);if(!isNaN(d.getTime()))fechas.push(d);}
  for(const t of transcripts.filter(t=>t.company.toLowerCase()===c.companyName.toLowerCase())){const d=new Date(t.date);if(!isNaN(d.getTime()))fechas.push(d);}
  if(fechas.length===0)return null;
  return new Date(Math.max(...fechas.map(d=>d.getTime())));
}

// --- Dashboard Panel: Mi día + Sin contacto ------------------------------------
function DashboardPanels({clients,transcripts,onEdit,onUpdateMeetings,onUpdateLastContact,onMarkContact,recentContacts,alertOnly}:{clients:ClientRecord[];transcripts:TranscriptInfo[];onEdit:(id:string)=>void;onUpdateMeetings:(id:string,meetings:Meeting[])=>void;onUpdateLastContact:(id:string)=>void;onMarkContact:(id:string)=>void;recentContacts:Record<string,string>;alertOnly?:boolean}){
  // Mi día state
  const [miDiaOpen,setMiDiaOpen]=useState(false);
  const [alertOpen,setAlertOpen]=useState(false);
  const [tasks,setTasks]=useState<DailyTask[]>([]);
  const [input,setInput]=useState("");
  const [selectedClient,setSelectedClient]=useState("");
  const [editingClientFor,setEditingClientFor]=useState<string|null>(null);
  const hoy=todayISO();

  useEffect(()=>{
    try{
      const raw=localStorage.getItem(MI_DIA_KEY);
      if(raw)setTasks((JSON.parse(raw) as DailyTask[]).map(t=>t.done?t:{...t,date:hoy}));
    }catch{}
  },[]);
  useEffect(()=>{localStorage.setItem(MI_DIA_KEY,JSON.stringify(tasks));},[tasks]);

  // Alerta sin contacto — usa recentContacts del estado React, no localStorage
  const alertas=useMemo(()=>{
    const hoyDate=new Date();
    return clients
      .filter(c=>(c.stage==="Pipeline P1"&&c.subStage!=="Contrato firmado")||c.stage==="Prospecto Activo")
      .map(c=>{
        const ultima=getLastActivity(c,transcripts,recentContacts);
        if(!ultima)return {client:c,dias:999,ultimaActividad:"Sin registro"};
        const dias=Math.floor((hoyDate.getTime()-ultima.getTime())/(1000*60*60*24));
        return {client:c,dias,ultimaActividad:formatDateShort(ultima.toISOString().slice(0,10))};
      })
      .filter(x=>x.dias>=DIAS_ALERTA)
      .sort((a,b)=>b.dias-a.dias);
  },[clients,transcripts,recentContacts]);

  function markContact(clientId:string){
    onMarkContact(clientId);
  }

  function addTask(){
    const text=input.trim(); if(!text)return;
    const client=clients.find(c=>c.id===selectedClient);
    setTasks(prev=>[...prev,{id:newId(),text,done:false,date:hoy,clientId:client?.id,clientName:client?.companyName}]);
    setInput("");setSelectedClient("");
  }
  function toggleTask(id:string){
    setTasks(prev=>prev.map(t=>{
      if(t.id!==id)return t;
      const nowDone=!t.done;
      if(nowDone&&t.clientId){
        const client=clients.find(c=>c.id===t.clientId);
        if(client){
          const tipo:Meeting["type"]=/correo|email|mail|enviar/i.test(t.text)?"correo":/llamar|llamado|teléfono/i.test(t.text)?"llamado":"reunion";
          const m:Meeting={id:newId(),date:hoy,type:tipo,notes:`Tarea completada: ${t.text}`,fromDiio:false};
          onUpdateMeetings(t.clientId,[...(client.meetings||[]),m]);
          onUpdateLastContact(t.clientId);
          // Actualizar recentContacts en el estado React → alerta se actualiza inmediatamente
          markContact(t.clientId);
        }
      }
      return {...t,done:nowDone};
    }));
  }
  function assignClient(taskId:string,clientId:string){
    const client=clients.find(c=>c.id===clientId);
    setTasks(prev=>prev.map(t=>t.id===taskId?{...t,clientId:client?.id,clientName:client?.companyName}:t));
    setEditingClientFor(null);
  }
  function deleteTask(id:string){setTasks(prev=>prev.filter(t=>t.id!==id));}
  function clearCompleted(){setTasks(prev=>prev.filter(t=>!t.done));}

  const pendientes=tasks.filter(t=>!t.done);
  const completadas=tasks.filter(t=>t.done);
  const pendientesDeAyer=pendientes.filter(t=>t.date<hoy);
  const pendientesDeHoy=pendientes.filter(t=>t.date===hoy);
  const pipelineClients=clients.filter(c=>c.stage==="Pipeline P1"||c.stage==="Pipeline P2"||c.stage==="Prospecto Activo").sort((a,b)=>a.companyName.localeCompare(b.companyName));

  const renderTask=(t:DailyTask)=>(
    <div key={t.id} style={{padding:"7px 10px",borderRadius:"8px",background:t.date<hoy?"#FFFBEB":t.done?"#F0FBF4":D.bg,border:t.date<hoy?"1px solid #FDE68A":"none",marginBottom:"4px"}}>
      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
        <input type="checkbox" checked={t.done} onChange={()=>toggleTask(t.id)} style={{accentColor:t.done?"#16a34a":D.accent,flexShrink:0}}/>
        <span style={{flex:1,fontSize:"12px",color:t.done?D.ink3:D.ink,textDecoration:t.done?"line-through":"none"}}>{t.text}</span>
        {t.date<hoy&&!t.done&&<span style={{fontSize:"10px",color:"#d97706",flexShrink:0}}>{t.date}</span>}
        {!t.done&&<button onClick={()=>setEditingClientFor(editingClientFor===t.id?null:t.id)} style={{background:"none",border:`1px solid ${D.border}`,borderRadius:"6px",cursor:"pointer",fontSize:"10px",color:D.ink3,padding:"2px 6px",flexShrink:0}}>{t.clientName?"✎":"+ cliente"}</button>}
        <button onClick={()=>deleteTask(t.id)} style={{background:"none",border:"none",cursor:"pointer",color:D.ink3,fontSize:"12px",padding:"0 2px",flexShrink:0}}>×</button>
      </div>
      {t.clientName&&editingClientFor!==t.id&&(
        <div style={{marginTop:"4px",marginLeft:"22px"}}>
          <span style={{fontSize:"10px",fontWeight:600,color:D.accent,background:`${D.accent}12`,padding:"1px 7px",borderRadius:"10px"}}>📌 {t.clientName}</span>
          {t.done&&<span style={{marginLeft:"6px",fontSize:"10px",color:"#16a34a"}}>✓ registrado en historial</span>}
        </div>
      )}
      {editingClientFor===t.id&&(
        <div style={{marginTop:"6px",marginLeft:"22px"}}>
          <select defaultValue={t.clientId||""} onChange={e=>assignClient(t.id,e.target.value)} style={{...iStyle,fontSize:"11px"}} autoFocus>
            <option value="">Sin cliente</option>
            <optgroup label="Pipeline P1">{pipelineClients.filter(c=>c.stage==="Pipeline P1").map(c=><option key={c.id} value={c.id}>{c.companyName}</option>)}</optgroup>
            <optgroup label="Pipeline P2">{pipelineClients.filter(c=>c.stage==="Pipeline P2").map(c=><option key={c.id} value={c.id}>{c.companyName}</option>)}</optgroup>
            <optgroup label="Prospectos">{pipelineClients.filter(c=>c.stage==="Prospecto Activo").map(c=><option key={c.id} value={c.id}>{c.companyName}</option>)}</optgroup>
          </select>
        </div>
      )}
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
      {/* Alerta sin contacto */}
      {alertas.length>0&&(
        <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:"14px",overflow:"hidden"}}>
          <button onClick={()=>setAlertOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"none",border:"none",cursor:"pointer"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <span style={{fontSize:"16px"}}>⏰</span>
              <div style={{textAlign:"left"}}>
                <div style={{fontSize:"13px",fontWeight:600,color:"#9A3412"}}>{alertas.length} cliente{alertas.length>1?"s":""} sin contacto hace +{DIAS_ALERTA} días</div>
                <div style={{fontSize:"11px",color:"#C2410C"}}>Pipeline P1 y Prospectos Activos · Requiere atención</div>
              </div>
            </div>
            <span style={{color:"#C2410C",fontSize:"12px"}}>{alertOpen?"▲":"▼"}</span>
          </button>
          {alertOpen&&(
            <div style={{borderTop:"1px solid #FED7AA",padding:"10px 16px",display:"flex",flexDirection:"column",gap:"6px"}}>
              {alertas.map(({client,dias,ultimaActividad})=>(
                <div key={client.id} style={{display:"flex",alignItems:"center",gap:"12px",padding:"8px 10px",background:"white",borderRadius:"10px",border:"1px solid #FED7AA"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"12px",fontWeight:600,color:"#1A1A1A"}}>{client.companyName}</div>
                    <div style={{fontSize:"11px",color:"#8A8A8A",marginTop:"1px"}}>
                      {client.subStage&&<span style={{marginRight:"8px"}}>{client.subStage}</span>}
                      Última actividad: {ultimaActividad}
                    </div>
                  </div>
                  <div style={{flexShrink:0,textAlign:"right"}}>
                    <div style={{fontSize:"12px",fontWeight:700,color:dias>30?"#dc2626":"#ea580c"}}>{dias} días</div>
                    <button onClick={()=>onEdit(client.id)} style={{fontSize:"10px",padding:"2px 8px",borderRadius:"6px",border:"1px solid #FED7AA",background:"white",cursor:"pointer",color:"#C2410C",marginTop:"2px"}}>Editar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mi día */}
      {!alertOnly&&(
      <div style={{background:D.white,border:`1px solid ${D.border}`,borderRadius:"16px",overflow:"hidden"}}>
        <button onClick={()=>setMiDiaOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"none",border:"none",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{width:"30px",height:"30px",borderRadius:"8px",background:`linear-gradient(135deg,#1D4ED8,#7C3AED)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",flexShrink:0}}>📋</div>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:"13px",fontWeight:600,color:D.ink}}>Mi día</div>
              <div style={{fontSize:"11px",color:D.ink3}}>
                {pendientes.length>0?`${pendientes.length} pendiente${pendientes.length>1?"s":""}`:completadas.length>0?"✓ Todo completado":"Sin tareas para hoy"}
                {pendientesDeAyer.length>0&&<span style={{color:"#d97706",marginLeft:"6px"}}>· {pendientesDeAyer.length} de ayer</span>}
              </div>
            </div>
          </div>
          <span style={{color:D.ink3,fontSize:"12px"}}>{miDiaOpen?"▲":"▼"}</span>
        </button>
        {miDiaOpen&&(
          <div style={{borderTop:`1px solid ${D.border}`,padding:"12px 16px"}}>
            <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"12px"}}>
              <div style={{display:"flex",gap:"8px"}}>
                <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addTask();}} placeholder="¿Qué querés hacer hoy? (Enter para guardar)" style={{...iStyle,flex:1}}/>
                <button onClick={addTask} disabled={!input.trim()} style={{padding:"9px 14px",borderRadius:"10px",border:"none",background:input.trim()?`linear-gradient(135deg,#1D4ED8,#7C3AED)`:"#E5E7EB",color:input.trim()?"white":"#9CA3AF",fontSize:"12px",cursor:input.trim()?"pointer":"default",fontWeight:600,flexShrink:0}}>+ Agregar</button>
              </div>
              <select value={selectedClient} onChange={e=>setSelectedClient(e.target.value)} style={{...iStyle,fontSize:"11px",color:selectedClient?D.ink:D.ink3}}>
                <option value="">Sin cliente asociado (opcional)</option>
                <optgroup label="Pipeline P1">{pipelineClients.filter(c=>c.stage==="Pipeline P1").map(c=><option key={c.id} value={c.id}>{c.companyName}</option>)}</optgroup>
                <optgroup label="Pipeline P2">{pipelineClients.filter(c=>c.stage==="Pipeline P2").map(c=><option key={c.id} value={c.id}>{c.companyName}</option>)}</optgroup>
                <optgroup label="Prospectos">{pipelineClients.filter(c=>c.stage==="Prospecto Activo").map(c=><option key={c.id} value={c.id}>{c.companyName}</option>)}</optgroup>
              </select>
            </div>
            {pendientesDeAyer.length>0&&(<div style={{marginBottom:"10px"}}><div style={{fontSize:"10px",fontWeight:600,color:"#d97706",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>⏳ Quedaron pendientes</div>{pendientesDeAyer.map(renderTask)}</div>)}
            {pendientesDeHoy.length>0&&(<div style={{marginBottom:"10px"}}><div style={{fontSize:"10px",fontWeight:600,color:D.ink3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Hoy</div>{pendientesDeHoy.map(renderTask)}</div>)}
            {completadas.length>0&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                  <div style={{fontSize:"10px",fontWeight:600,color:"#16a34a",textTransform:"uppercase",letterSpacing:"0.05em"}}>✓ Completadas</div>
                  <button onClick={clearCompleted} style={{fontSize:"10px",color:D.ink3,background:"none",border:"none",cursor:"pointer"}}>Limpiar</button>
                </div>
                {completadas.map(renderTask)}
              </div>
            )}
            {tasks.length===0&&<div style={{textAlign:"center",padding:"1.5rem",color:D.ink3,fontSize:"12px"}}>Sin tareas para hoy — agregá lo que querés hacer</div>}
          </div>
        )}
      </div>
      )}
    </div>
  );
}


// --- AI Pendientes Panel ------------------------------------------------------
function AIPendientesPanel({clients,onUpdateTasks,transcripts}:{clients:ClientRecord[];onUpdateTasks:(clientId:string,tasks:ClientTask[])=>void;transcripts:TranscriptInfo[]}){
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [generated,setGenerated]=useState(false);
  const [localTasks,setLocalTasks]=useState<Record<string,ClientTask[]>>({});
  const companiesWithTranscripts=useMemo(()=>new Set(transcripts.map(t=>t.company.toLowerCase())),[transcripts]);
  const clientsToProcess=useMemo(()=>clients.filter(c=>c.nextAction?.trim()||companiesWithTranscripts.has(c.companyName.toLowerCase())),[clients,companiesWithTranscripts]);

  async function generar(){
    if(!clientsToProcess.length)return; setLoading(true);setGenerated(false);
    const result:Record<string,ClientTask[]>={};
    for(const client of clientsToProcess){
      const clientTranscripts=transcripts.filter(t=>t.company.toLowerCase()===client.companyName.toLowerCase()).sort((a,b)=>a.date>b.date?-1:1).slice(0,3).map(t=>`[${t.date}] ${t.transcript}`);
      try{
        const res=await fetch("/api/generate-actions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({company:client.companyName,stage:`${client.stage}${client.subStage?` · ${client.subStage}`:""}`,comment:client.nextAction||"(sin comentario)",transcripts:clientTranscripts})});
        const data=await res.json() as {tasks?:string[]};
        result[client.id]=(data.tasks||[]).map((t:string)=>({id:newId(),text:t,done:false}));
      }catch{result[client.id]=client.nextAction?[{id:newId(),text:client.nextAction,done:false}]:[];}
    }
    // Guardar en estado global para Mi semana
    for(const [clientId,tasks] of Object.entries(result)){onUpdateTasks(clientId,tasks);}
    setLocalTasks(result);setLoading(false);setGenerated(true);
  }

  function toggleTask(clientId:string,taskId:string){
    setLocalTasks(prev=>{
      const tasks=(prev[clientId]||[]).map(t=>{
        if(t.id!==taskId)return t;
        const done=!t.done;
        const isEmail=/correo|email|mail|mensaje|whatsapp|escribir|enviar/i.test(t.text);
        const followUp:FollowUp|undefined=done&&isEmail&&!t.followUp?{id:newId(),text:`Esperar respuesta — ${t.text.substring(0,60)}`,dueDateISO:addDays(todayISO(),5),done:false,dismissed:false}:t.followUp;
        return {...t,done,followUp};
      });
      onUpdateTasks(clientId,tasks);
      return {...prev,[clientId]:tasks};
    });
  }
  function dismissFollowUp(clientId:string,taskId:string){setLocalTasks(prev=>{const tasks=(prev[clientId]||[]).map(t=>t.id===taskId?{...t,followUp:t.followUp?{...t.followUp,dismissed:true}:undefined}:t);onUpdateTasks(clientId,tasks);return {...prev,[clientId]:tasks};});}
  function completeFollowUp(clientId:string,taskId:string){setLocalTasks(prev=>{const tasks=(prev[clientId]||[]).map(t=>t.id===taskId?{...t,followUp:t.followUp?{...t.followUp,done:true}:undefined}:t);onUpdateTasks(clientId,tasks);return {...prev,[clientId]:tasks};});}

  const alarms=useMemo(()=>{const a:Array<{client:ClientRecord;task:ClientTask;followUp:FollowUp}>=[];for(const client of clients){for(const task of (localTasks[client.id]||client.aiTasks||[])){if(task.followUp&&!task.followUp.done&&!task.followUp.dismissed&&isPast(task.followUp.dueDateISO)){a.push({client,task,followUp:task.followUp});}}}return a;},[clients,localTasks]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
      {alarms.length>0&&(
        <div style={{background:D.alarmBg,border:`1px solid ${D.alarmBorder}`,borderRadius:"14px",padding:"12px 16px"}}>
          <div style={{fontSize:"13px",fontWeight:600,color:"#dc2626",marginBottom:"8px"}}>⚠ {alarms.length} seguimiento{alarms.length>1?"s":""} vencido{alarms.length>1?"s":""}</div>
          {alarms.map(({client,task,followUp},i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"6px",fontSize:"12px",color:"#7f1d1d"}}>
              <span style={{flex:1}}><strong>{client.companyName}</strong> — {followUp.text} (venció {followUp.dueDateISO})</span>
              <button onClick={()=>completeFollowUp(client.id,task.id)} style={{padding:"3px 8px",borderRadius:"6px",border:"1px solid #fca5a5",background:D.white,fontSize:"11px",cursor:"pointer",color:"#dc2626"}}>Resuelto</button>
              <button onClick={()=>dismissFollowUp(client.id,task.id)} style={{padding:"3px 8px",borderRadius:"6px",border:`1px solid ${D.border}`,background:D.white,fontSize:"11px",cursor:"pointer",color:D.ink3}}>Ignorar</button>
            </div>
          ))}
        </div>
      )}
      <div style={{background:D.white,border:`1px solid ${D.border}`,borderRadius:"16px",overflow:"hidden"}}>
        <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1rem 1.25rem",background:"none",border:"none",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <div style={{width:"30px",height:"30px",borderRadius:"8px",background:`linear-gradient(135deg,${D.accent},${D.accentY})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",flexShrink:0}}>✦</div>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:"13px",fontWeight:600,color:D.ink}}>Acciones recomendadas por IA</div>
              <div style={{fontSize:"11px",color:D.ink3}}>{clientsToProcess.length} cliente{clientsToProcess.length!==1?"s":""} con comentarios o transcripciones</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            {generated&&<span style={{fontSize:"10px",padding:"2px 8px",borderRadius:"20px",background:`${D.accent}15`,color:D.accent,fontWeight:600}}>activo</span>}
            <span style={{color:D.ink3,fontSize:"12px"}}>{open?"▲":"▼"}</span>
          </div>
        </button>
        {open&&(
          <div style={{borderTop:`1px solid ${D.border}`,padding:"1rem 1.25rem 1.25rem"}}>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"1rem"}}>
              <button onClick={generar} disabled={loading||!clientsToProcess.length} style={{padding:"7px 16px",borderRadius:"10px",border:"none",background:loading?D.border:`linear-gradient(135deg,${D.accent},${D.accentY})`,color:loading?D.ink3:D.white,fontSize:"12px",fontWeight:600,cursor:"pointer"}}>
                {loading?"Analizando…":generated?"↻ Regenerar":"✦ Generar con IA"}
              </button>
            </div>
            {!generated&&!loading&&<div style={{borderRadius:"10px",border:`1px dashed ${D.border}`,background:D.bg,padding:"2rem",textAlign:"center",color:D.ink3,fontSize:"12px"}}>Apretá "Generar con IA" para ver qué hacer con cada cliente</div>}
            {loading&&<div style={{display:"flex",flexDirection:"column",gap:"8px"}}>{[...Array(3)].map((_,i)=><div key={i} style={{height:"56px",borderRadius:"10px",background:D.bg}}/>)}</div>}
            {generated&&!loading&&(
              <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                {clientsToProcess.map(client=>{
                  const tasks=localTasks[client.id]||[];
                  const hasDiio=companiesWithTranscripts.has(client.companyName.toLowerCase());
                  return(
                    <div key={client.id} style={{background:D.bg,borderRadius:"12px",padding:"12px 14px"}}>
                      <div style={{fontSize:"12px",fontWeight:600,color:D.ink,marginBottom:"6px",display:"flex",alignItems:"center",gap:"8px"}}>
                        <span style={{width:"6px",height:"6px",borderRadius:"50%",background:D.accent,flexShrink:0,display:"inline-block"}}/>
                        {client.companyName}
                        {client.subStage&&<span style={{fontSize:"10px",color:D.ink3,fontWeight:400}}>· {client.subStage}</span>}
                        {hasDiio&&<span style={{fontSize:"9px",color:"#7C3AED",background:"#F5F3FF",padding:"1px 6px",borderRadius:"10px",fontWeight:500}}>+ Diio</span>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                        {tasks.length===0&&<div style={{fontSize:"11px",color:D.ink3}}>Sin tareas generadas</div>}
                        {tasks.map(task=>(
                          <div key={task.id}>
                            <label style={{display:"flex",alignItems:"flex-start",gap:"8px",cursor:"pointer"}}>
                              <input type="checkbox" checked={task.done} onChange={()=>toggleTask(client.id,task.id)} style={{marginTop:"2px",accentColor:D.accent,flexShrink:0}}/>
                              <span style={{fontSize:"12px",color:task.done?D.ink3:D.ink,textDecoration:task.done?"line-through":"none",lineHeight:1.4}}>{task.text}</span>
                            </label>
                            {task.followUp&&!task.followUp.done&&!task.followUp.dismissed&&(
                              <div style={{marginLeft:"24px",marginTop:"4px",padding:"5px 10px",borderRadius:"8px",background:isPast(task.followUp.dueDateISO)?D.alarmBg:"#FFF9F0",border:`1px solid ${isPast(task.followUp.dueDateISO)?D.alarmBorder:"#FDE68A"}`,fontSize:"11px",color:isPast(task.followUp.dueDateISO)?"#dc2626":"#92400e",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px"}}>
                                <span>⏱ Seguimiento al {task.followUp.dueDateISO}{isPast(task.followUp.dueDateISO)?" — ¡VENCIDO!":""}</span>
                                <button onClick={()=>completeFollowUp(client.id,task.id)} style={{padding:"2px 7px",borderRadius:"5px",border:"none",background:"transparent",fontSize:"10px",cursor:"pointer",color:"inherit",fontWeight:600}}>✓ Listo</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Dashboard Charts ---------------------------------------------------------
function ProbChart({clients}:{clients:ClientRecord[]}){
  const data=useMemo(()=>{
    const pipeline=clients.filter(c=>c.stage==="Pipeline P1"||c.stage==="Pipeline P2");
    const byS:Record<string,{mwp:number;names:string[]}>={}; 
    for(const c of pipeline){if(!c.subStage||c.subStage==="Contrato firmado")continue; if(!byS[c.subStage])byS[c.subStage]={mwp:0,names:[]}; byS[c.subStage].mwp+=c.mwp; byS[c.subStage].names.push(c.companyName);}
    return ["Contrato en revisión","Presentación final","Visita técnica realizada","Primera presentación preliminar","Evaluación preliminar"].map(s=>({label:s as SubStage,mwp:byS[s]?.mwp??0,prob:SUBSTAGE_PROB[s as SubStage],mwpW:(byS[s]?.mwp??0)*(SUBSTAGE_PROB[s as SubStage]/100),names:byS[s]?.names??[]})).filter(d=>d.mwp>0);
  },[clients]);
  const max=Math.max(...data.map(d=>d.mwp),0.01);
  if(data.length===0)return null;
  return(
    <div style={{background:D.white,border:`1px solid ${D.border}`,borderRadius:"16px",padding:"1.5rem",flex:1}}>
      <div style={{fontSize:"13px",fontWeight:600,color:D.ink,marginBottom:"4px"}}>Cierres probables por etapa</div>
      <div style={{fontSize:"11px",color:D.ink3,marginBottom:"1.25rem"}}>MWp ponderado por probabilidad</div>
      <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
        {data.map(d=>(
          <div key={d.label} style={{display:"grid",gridTemplateColumns:"1fr 180px",gap:"16px",alignItems:"center"}}>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
                <span style={{fontSize:"12px",fontWeight:500,color:D.ink}}>{d.label}</span>
                <span style={{fontSize:"12px",fontWeight:600,color:D.accent}}>{d.mwpW.toFixed(2)} MWp · {d.prob}%</span>
              </div>
              <div style={{height:"6px",borderRadius:"3px",background:D.bg,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${(d.mwp/max)*100}%`,borderRadius:"3px",background:D.border,position:"relative"}}>
                  <div style={{position:"absolute",inset:0,width:`${d.prob}%`,background:`linear-gradient(90deg,${D.accent},${D.accentY})`,borderRadius:"3px"}}/>
                </div>
              </div>
            </div>
            <div style={{fontSize:"10px",color:D.ink3,lineHeight:1.5}}>
              {d.names.slice(0,4).map((n,i)=><div key={i} style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>· {n}</div>)}
              {d.names.length>4&&<div style={{color:D.accent}}>+{d.names.length-4} más</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// --- Monthly Projection Chart (líneas acumuladas) -----------------------------
function MonthlyChart({clients}:{clients:ClientRecord[]}){
  const today=new Date();
  const currentMonthKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
  const months2026=useMemo(()=>{const m:string[]=[];for(let i=2;i<=11;i++)m.push(`2026-${String(i+1).padStart(2,"0")}`);return m;},[]);

  const data=useMemo(()=>{
    const byMonth:Record<string,{firmado:number;altaProb:number;bajaProb:number}>={};
    for(const m of months2026)byMonth[m]={firmado:0,altaProb:0,bajaProb:0};
    const pipeline=clients.filter(c=>c.stage==="Pipeline P1"||c.stage==="Pipeline P2");
    for(const c of pipeline){
      if(!c.subStage||c.subStage==="Contrato firmado"){
        const key=c.stageDate?monthKey(c.stageDate):"";
        if(key&&byMonth[key])byMonth[key].firmado+=c.mwp;
        continue;
      }
      const key=closingMonthKey(c.subStage,c.stageDate);
      if(!key||!byMonth[key])continue;
      const mwpW=c.mwp*(c.closeProbabilityPct/100);
      if(c.closeProbabilityPct>=25)byMonth[key].altaProb+=mwpW;
      else byMonth[key].bajaProb+=mwpW;
    }
    const metaMensual=ANNUAL_GOAL_MWP/10;
    let accFirmado=0,accAlta=0,accBaja=0,accMeta=0;
    return months2026.map(m=>{
      accFirmado+=byMonth[m].firmado;
      accAlta+=byMonth[m].altaProb;
      accBaja+=byMonth[m].bajaProb;
      accMeta+=metaMensual;
      return {key:m,label:monthLabel(m),firmadoAcum:Math.round(accFirmado*100)/100,proyAcum:Math.round((accFirmado+accAlta+accBaja)*100)/100,metaAcum:Math.round(accMeta*100)/100,isCurrent:m===currentMonthKey};
    });
  },[clients,months2026,currentMonthKey]);

  const totalFirmado=data[data.length-1]?.firmadoAcum||0;
  const totalProy=data[data.length-1]?.proyAcum||0;
  const maxVal=Math.max(ANNUAL_GOAL_MWP+0.5,...data.map(d=>d.proyAcum));
  const nM=months2026.length;
  const H=180;

  return(
    <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1.25rem",flex:1}}>
      <div style={{fontSize:"13px",fontWeight:500,color:"var(--color-text-primary)",marginBottom:"4px"}}>Proyección de cierres 2026 — acumulado vs meta</div>
      <div style={{fontSize:"11px",color:"var(--color-text-secondary)",marginBottom:"14px"}}>Mar — Dic 2026 · MWp acumulado</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"16px"}}>
        {[{l:"Meta 2026",v:`${ANNUAL_GOAL_MWP} MWp`,c:"#1D4ED8"},{l:"Proyectado",v:`${totalProy.toFixed(1)} MWp`,c:totalProy>=ANNUAL_GOAL_MWP?"#16a34a":"#d97706"},{l:"Firmado",v:`${totalFirmado.toFixed(1)} MWp`,c:"#16a34a"}].map((k,i)=>(
          <div key={i} style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"8px 10px"}}>
            <div style={{fontSize:"9px",color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"2px"}}>{k.l}</div>
            <div style={{fontSize:"16px",fontWeight:500,color:k.c}}>{k.v}</div>
          </div>
        ))}
      </div>
      <div style={{width:"100%",overflowX:"auto"}}>
        <svg viewBox={`0 0 520 ${H+30}`} width="100%" style={{display:"block"}}>
          {[0,1,2,3,4,5].filter(v=>v<=Math.ceil(maxVal)).map((v,i)=>(
            <g key={i}>
              <line x1="30" y1={H-(v/maxVal)*H} x2="510" y2={H-(v/maxVal)*H} stroke="var(--color-border-tertiary)" strokeWidth="0.5"/>
              <text x="26" y={H-(v/maxVal)*H+4} textAnchor="end" fontSize="9" fill="var(--color-text-secondary)">{v}</text>
            </g>
          ))}
          {data.map((d,i)=>{
            const x=30+(i/(nM-1))*480;
            return(
              <g key={i}>
                {d.isCurrent&&<line x1={x} y1={0} x2={x} y2={H} stroke="var(--color-border-secondary)" strokeWidth="1" strokeDasharray="4,3"/>}
                <text x={x} y={H+20} textAnchor="middle" fontSize="9" fill={d.isCurrent?"#E8500A":"var(--color-text-secondary)"} fontWeight={d.isCurrent?"500":"400"}>{d.label}</text>
              </g>
            );
          })}
          <polyline points={data.map((d,i)=>`${30+(i/(nM-1))*480},${H-(d.metaAcum/maxVal)*H}`).join(" ")} fill="none" stroke="#1D4ED8" strokeWidth="2"/>
          {data.map((d,i)=><circle key={i} cx={30+(i/(nM-1))*480} cy={H-(d.metaAcum/maxVal)*H} r="3" fill="#1D4ED8"/>)}
          <polyline points={data.map((d,i)=>`${30+(i/(nM-1))*480},${H-(d.proyAcum/maxVal)*H}`).join(" ")} fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="6,3"/>
          {data.map((d,i)=><circle key={i} cx={30+(i/(nM-1))*480} cy={H-(d.proyAcum/maxVal)*H} r="2.5" fill="#d97706"/>)}
          <polyline points={data.map((d,i)=>`${30+(i/(nM-1))*480},${H-(d.firmadoAcum/maxVal)*H}`).join(" ")} fill="none" stroke="#16a34a" strokeWidth="2.5"/>
          {data.map((d,i)=>d.firmadoAcum>0?<circle key={i} cx={30+(i/(nM-1))*480} cy={H-(d.firmadoAcum/maxVal)*H} r="4" fill="#16a34a"/>:null)}
        </svg>
      </div>
      <div style={{display:"flex",gap:"14px",marginTop:"8px",fontSize:"11px",color:"var(--color-text-secondary)",flexWrap:"wrap"}}>
        <span style={{display:"flex",alignItems:"center",gap:"5px"}}><span style={{width:"16px",height:"2px",background:"#1D4ED8",display:"inline-block",borderRadius:"1px"}}/> Meta ({ANNUAL_GOAL_MWP} MWp)</span>
        <span style={{display:"flex",alignItems:"center",gap:"5px"}}><span style={{width:"16px",height:"2px",background:"#d97706",display:"inline-block",borderTop:"2px dashed #d97706"}}/> Proyectado</span>
        <span style={{display:"flex",alignItems:"center",gap:"5px"}}><span style={{width:"16px",height:"2.5px",background:"#16a34a",display:"inline-block",borderRadius:"1px"}}/> Firmado</span>
      </div>
    </div>
  );
}


// --- Pipeline Generated Chart -------------------------------------------------
function PipelineGeneradoChart({clients}:{clients:ClientRecord[]}){
  const today=new Date();
  const currentMonthKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;

  // Solo meses 2026: marzo a diciembre
  const months2026=useMemo(()=>{
    const m:string[]=[];
    for(let i=2;i<=11;i++)m.push(`2026-${String(i+1).padStart(2,"0")}`);
    return m;
  },[]);

  const data=useMemo(()=>{
    const pipeline=clients.filter(c=>c.stage==="Pipeline P1"||c.stage==="Pipeline P2");
    const byMonth:Record<string,{mwp:number;names:string[]}>={}; 
    for(const m of months2026)byMonth[m]={mwp:0,names:[]};
    const withDate=pipeline.filter(c=>c.ingressDate&&months2026.includes(monthKey(c.ingressDate)));
    const withoutDate=pipeline.filter(c=>!c.ingressDate||!months2026.includes(monthKey(c.ingressDate)));
    for(const c of withDate){const key=monthKey(c.ingressDate!);if(byMonth[key]){byMonth[key].mwp+=c.mwp;byMonth[key].names.push(c.companyName);}}
    const half2=Math.ceil(withoutDate.length/2);
    withoutDate.forEach((c,i)=>{const m=i<half2?"2026-03":"2026-04";byMonth[m].mwp+=c.mwp;byMonth[m].names.push(c.companyName);});
    const avgProb=pipeline.length>0?pipeline.reduce((s,c)=>s+c.closeProbabilityPct,0)/pipeline.length:15;
    const monthlyGoalMwp=ANNUAL_GOAL_MWP/10;
    const monthlyPipelineNeeded=avgProb>0?(monthlyGoalMwp/(avgProb/100)):monthlyGoalMwp*5;
    return months2026.map(m=>({
      key:m,label:monthLabel(m),
      mwp:Math.round(byMonth[m].mwp*100)/100,
      names:byMonth[m].names,
      needed:Math.round(monthlyPipelineNeeded*100)/100,
      isCurrent:m===currentMonthKey,
      isPast:m<currentMonthKey,
    }));
  },[clients,months2026,currentMonthKey]);

  const maxCount=Math.max(...data.map(d=>Math.max(d.mwp,d.needed+0.5)),0.5);
  const CHART_H=120;
  const yTicks=[0,Math.round(maxCount*0.33*10)/10,Math.round(maxCount*0.66*10)/10,Math.round(maxCount*10)/10];
  const totalPipeline=clients.filter(c=>c.stage==="Pipeline P1"||c.stage==="Pipeline P2").reduce((s,c)=>s+(c.mwp||0),0);

  return(
    <div style={{background:D.white,border:`1px solid ${D.border}`,borderRadius:"16px",padding:"1.5rem"}}>
      <div style={{fontSize:"13px",fontWeight:600,color:D.ink,marginBottom:"4px"}}>Pipeline P1+P2 generado por mes · 2026</div>
      <div style={{fontSize:"11px",color:D.ink3,marginBottom:"12px"}}>
        Eje Y = MWp · Línea punteada = pipeline mensual necesario · Total acumulado: {totalPipeline.toFixed(1)} MWp
      </div>
      <div style={{display:"flex",gap:"6px"}}>
        {/* Y axis */}
        <div style={{display:"flex",flexDirection:"column",justifyContent:"space-between",height:`${CHART_H}px`,flexShrink:0}}>
          {[...yTicks].reverse().map((v,i)=><div key={i} style={{fontSize:"8px",color:D.ink3,textAlign:"right",width:"18px"}}>{v}</div>)}
        </div>
        {/* Chart */}
        <div style={{flex:1,position:"relative"}}>
          {yTicks.map((v,i)=>(
            <div key={i} style={{position:"absolute",left:0,right:0,bottom:`${(v/maxCount)*CHART_H}px`,height:"1px",background:D.border,opacity:0.6}}/>
          ))}
          {/* Needed line */}
          <div style={{position:"absolute",left:0,right:0,bottom:`${(data[0]?.needed/maxCount)*CHART_H}px`,zIndex:3}}>
            <div style={{height:"2px",borderTop:"2px dashed #7C3AED",width:"100%",opacity:0.8}}/>
          </div>
          <div style={{display:"flex",gap:"4px",alignItems:"flex-end",height:`${CHART_H}px`}}>
            {data.map(d=>{
              const barH=Math.max((d.mwp/maxCount)*CHART_H,d.mwp>0?4:0);
              const metCriteria=d.mwp>=d.needed;
              return(
                <div key={d.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",height:`${CHART_H}px`,justifyContent:"flex-end",position:"relative",minWidth:"28px",zIndex:1}}>
                  {d.mwp>0&&<div style={{position:"absolute",bottom:`${barH+4}px`,left:"50%",transform:"translateX(-50%)",fontSize:"8px",fontWeight:700,color:metCriteria?"#22c55e":D.accent,whiteSpace:"nowrap"}}>{d.mwp.toFixed(1)}</div>}
                  <div style={{width:"80%",height:`${barH}px`,background:metCriteria?`linear-gradient(180deg,#4ade80,#22c55e)`:d.mwp>0?`linear-gradient(180deg,${D.accentY},${D.accent})`:"transparent",borderRadius:"4px 4px 0 0",minHeight:d.mwp>0?4:0}}/>
                </div>
              );
            })}
          </div>
          <div style={{display:"flex",gap:"4px",marginTop:"4px"}}>
            {data.map(d=><div key={d.key} style={{flex:1,fontSize:"7px",color:d.isCurrent?D.accent:D.ink3,textAlign:"center",fontWeight:d.isCurrent?700:400,minWidth:"28px"}}>{d.label}</div>)}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:"12px",marginTop:"10px",fontSize:"10px",color:D.ink3,flexWrap:"wrap"}}>
        <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:"10px",height:"4px",background:`linear-gradient(90deg,${D.accentY},${D.accent})`,borderRadius:"2px",display:"inline-block"}}/> Generado</span>
        <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:"10px",height:"4px",background:"#22c55e",borderRadius:"2px",display:"inline-block"}}/> Objetivo cumplido</span>
        <span style={{display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:"10px",height:"2px",borderTop:"2px dashed #7C3AED",display:"inline-block"}}/> Objetivo mensual</span>
      </div>
    </div>
  );
}

// --- Client Card -------------------------------------------------------------
function ClientCard({client,contacts,transcripts,onEdit,onDelete,onUpdateMeetings,onUpdateNote}:{client:ClientRecord;contacts:ContactInfo[];transcripts:TranscriptInfo[];onEdit:(id:string)=>void;onDelete:(id:string)=>void;onUpdateMeetings:(id:string,meetings:Meeting[])=>void;onUpdateNote:(id:string,note:string)=>void}){
  const [showDetail,setShowDetail]=useState(false);
  const [editingNote,setEditingNote]=useState(false);
  const [noteVal,setNoteVal]=useState(client.nextAction);
  const isSigned=client.subStage==="Contrato firmado";
  const isPresentacion=client.subStage==="Presentación final";
  const closingD=isPresentacion&&client.stageDate?closingDate(client.subStage,client.stageDate):null;
  const meetingCount=(client.meetings||[]).length+transcripts.filter(t=>t.company.toLowerCase()===client.companyName.toLowerCase()).length;
  const daysInStage=client.stageDate?Math.floor((new Date().getTime()-new Date(client.stageDate).getTime())/(1000*60*60*24)):null;

  function saveNote(){onUpdateNote(client.id,noteVal);setEditingNote(false);}

  return(
    <>
    <div style={{background:isSigned?D.signedBg:D.white,border:`1px solid ${isSigned?D.signedBorder:D.border}`,borderRadius:"14px",padding:"14px",transition:"box-shadow 0.15s"}}
      onMouseEnter={e=>(e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,0.07)")}
      onMouseLeave={e=>(e.currentTarget.style.boxShadow="none")}>
      <div style={{display:"flex",justifyContent:"space-between",gap:"8px",marginBottom:"8px"}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:"13px",fontWeight:600,color:D.ink,display:"flex",alignItems:"center",gap:"5px"}}>
            {isSigned&&<span style={{color:"#22c55e",fontSize:"12px"}}>✓</span>}
            <button onClick={()=>setShowDetail(true)} style={{background:"none",border:"none",cursor:"pointer",fontSize:"13px",fontWeight:600,color:D.ink,padding:0,textAlign:"left"}}>
              {client.companyName||"Sin empresa"}
            </button>
          </div>
          <div style={{fontSize:"11px",color:D.ink3,marginTop:"2px"}}>
            <ContactPopup contacts={contacts} companyName={client.companyName} contactName={client.contactName}/>
          </div>
        </div>
        <div style={{display:"flex",gap:"4px",flexShrink:0,alignItems:"flex-start"}}>
          {meetingCount>0&&<button onClick={()=>setShowDetail(true)} style={{padding:"4px 7px",borderRadius:"7px",border:`1px solid ${D.border}`,background:D.bg,fontSize:"10px",cursor:"pointer",color:D.ink3}} title="Ver reuniones">📅{meetingCount}</button>}
          <button onClick={()=>onEdit(client.id)} style={{padding:"4px 9px",borderRadius:"7px",border:`1px solid ${D.border}`,background:D.white,fontSize:"11px",cursor:"pointer",color:D.ink2}}>Editar</button>
          <button onClick={()=>onDelete(client.id)} style={{padding:"4px 7px",borderRadius:"7px",border:"1px solid #fecaca",background:"#fff5f5",fontSize:"11px",cursor:"pointer",color:"#dc2626"}}>×</button>
        </div>
      </div>
      {client.subStage&&(
        <div style={{marginBottom:"6px",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
          <span style={{fontSize:"10px",fontWeight:600,color:D.accent,borderLeft:`2px solid ${D.accent}`,paddingLeft:"5px"}}>{client.subStage}</span>
          {client.salesforce&&<span style={{fontSize:"9px",fontWeight:600,color:"#1D4ED8",background:"#EFF6FF",padding:"1px 6px",borderRadius:"10px",border:"1px solid #BFDBFE"}}>SF ✓</span>}
          {daysInStage!==null&&<span style={{fontSize:"9px",color:daysInStage>30?"#dc2626":D.ink3}}>⏱ {daysInStage}d</span>}
          {isPresentacion&&client.stageDate&&(
            <span style={{fontSize:"10px",color:D.ink3}}>
              Pres. {formatDateShort(client.stageDate)}{closingD&&<> · Cierre est. {formatDateShort(closingD.toISOString().slice(0,10))}</>}
            </span>
          )}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px",marginBottom:"8px"}}>
        <div style={{background:D.bg,borderRadius:"8px",padding:"7px 9px"}}><div style={{fontSize:"10px",color:D.ink3}}>MWp</div><div style={{fontSize:"13px",fontWeight:600,color:D.ink}}>{client.mwp.toFixed(2)}</div></div>
        <div style={{background:D.bg,borderRadius:"8px",padding:"7px 9px"}}><div style={{fontSize:"10px",color:D.ink3}}>Prob.</div><div style={{fontSize:"13px",fontWeight:600,color:D.ink}}>{client.closeProbabilityPct}%</div></div>
      </div>
      {/* Nota rápida inline */}
      <div style={{background:D.bg,borderRadius:"8px",padding:"7px 9px",borderLeft:`2px solid ${D.border}`,cursor:"pointer"}} onClick={()=>!editingNote&&setEditingNote(true)}>
        <div style={{fontSize:"10px",color:D.ink3,marginBottom:"2px",display:"flex",justifyContent:"space-between"}}>
          <span>Comentario</span>
          {!editingNote&&<span style={{color:D.accent,fontSize:"9px"}}>✎ editar</span>}
        </div>
        {editingNote?(
          <div onClick={e=>e.stopPropagation()}>
            <textarea value={noteVal} onChange={e=>setNoteVal(e.target.value)} rows={2} style={{...iStyle,fontSize:"12px",resize:"none",marginBottom:"6px"}} autoFocus onKeyDown={e=>{if(e.key==="Enter"&&e.metaKey)saveNote();if(e.key==="Escape"){setNoteVal(client.nextAction);setEditingNote(false);}}}/>
            <div style={{display:"flex",gap:"6px",justifyContent:"flex-end"}}>
              <button onClick={()=>{setNoteVal(client.nextAction);setEditingNote(false);}} style={{padding:"3px 10px",borderRadius:"6px",border:`1px solid ${D.border}`,background:D.white,fontSize:"11px",cursor:"pointer",color:D.ink2}}>Cancelar</button>
              <button onClick={saveNote} style={{padding:"3px 10px",borderRadius:"6px",border:"none",background:D.accent,fontSize:"11px",cursor:"pointer",color:D.white,fontWeight:600}}>Guardar</button>
            </div>
          </div>
        ):(
          <div style={{fontSize:"12px",color:client.nextAction?D.ink2:D.ink3,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
            {client.nextAction||"Click para agregar comentario…"}
          </div>
        )}
      </div>
    </div>
    {showDetail&&(
      <Modal open={showDetail} title={`${client.companyName} — Reuniones y llamados`} onClose={()=>setShowDetail(false)} wide>
        <ClientDetailModal client={client} transcripts={transcripts} onUpdateMeetings={(meetings)=>onUpdateMeetings(client.id,meetings)} onClose={()=>setShowDetail(false)}/>
      </Modal>
    )}
    </>
  );
}
// --- Prospecto Row -------------------------------------------------------------
function ProspectoRow({client,contacts,onEdit,onDelete}:{client:ClientRecord;contacts:ContactInfo[];onEdit:(id:string)=>void;onDelete:(id:string)=>void}){
  const match=contacts.find(c=>c.company.toLowerCase()===client.companyName.toLowerCase());
  return(
    <div style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 14px",background:D.white,border:`1px solid ${D.border}`,borderRadius:"12px",transition:"box-shadow 0.15s"}}
      onMouseEnter={e=>(e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.06)")}
      onMouseLeave={e=>(e.currentTarget.style.boxShadow="none")}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:"13px",fontWeight:600,color:D.ink,marginBottom:"2px"}}>{client.companyName}</div>
        <div style={{fontSize:"11px",color:D.ink3,display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
          {match?.name&&<span>{match.name}</span>}
          {match?.phone&&<span>📞 {match.phone}</span>}
          {match?.email&&<span style={{display:"flex",alignItems:"center",gap:"2px"}}>✉ {match.email}<CopyButton text={match.email}/></span>}
          {!match&&client.contactName&&<span>{client.contactName}</span>}
        </div>
      </div>
      <div style={{display:"flex",gap:"4px",flexShrink:0}}>
        <button onClick={()=>onEdit(client.id)} style={{padding:"4px 9px",borderRadius:"7px",border:`1px solid ${D.border}`,background:D.white,fontSize:"11px",cursor:"pointer",color:D.ink2}}>Editar</button>
        <button onClick={()=>onDelete(client.id)} style={{padding:"4px 7px",borderRadius:"7px",border:"1px solid #fecaca",background:"#fff5f5",fontSize:"11px",cursor:"pointer",color:"#dc2626"}}>×</button>
      </div>
    </div>
  );
}

// --- Tab Views ----------------------------------------------------------------
// --- Semana Tab ---------------------------------------------------------------
function SemanaTab({clients,transcripts,onUpdateTasks}:{clients:ClientRecord[];transcripts:TranscriptInfo[];onUpdateTasks:(id:string,tasks:ClientTask[])=>void}){
  const hoy=new Date();
  const lunesISO=useMemo(()=>{
    const d=new Date(hoy);
    const day=d.getDay();
    const diff=day===0?-6:1-day;
    d.setDate(d.getDate()+diff);
    return d.toISOString().slice(0,10);
  },[]);

  // Tareas IA pendientes ordenadas por urgencia
  const tareas=useMemo(()=>{
    const result:Array<{client:ClientRecord;task:ClientTask;urgencia:number}>=[];
    for(const client of clients.filter(c=>c.stage!=="Perdido")){
      for(const task of (client.aiTasks||[])){
        if(task.done)continue;
        let urgencia=0;
        if(task.followUp&&!task.followUp.done&&!task.followUp.dismissed){
          const dias=Math.floor((hoy.getTime()-new Date(task.followUp.dueDateISO).getTime())/(1000*60*60*24));
          urgencia=dias>0?100+dias:50;
        }
        if(client.stage==="Pipeline P1")urgencia+=30;
        if(client.stage==="Pipeline P2")urgencia+=10;
        result.push({client,task,urgencia});
      }
    }
    return result.sort((a,b)=>b.urgencia-a.urgencia);
  },[clients]);

  // Actividad de esta semana por cliente (reuniones + meetings manuales desde el lunes)
  const actividadSemana=useMemo(()=>{
    const porCliente:Array<{client:ClientRecord;actividades:Array<{tipo:string;fecha:string;nota:string}>}>=[];
    for(const client of clients.filter(c=>c.stage!=="Perdido")){
      const acts:Array<{tipo:string;fecha:string;nota:string}>=[];
      // Meetings manuales esta semana
      for(const m of (client.meetings||[])){
        if(m.date>=lunesISO){
          acts.push({tipo:m.type==="reunion"?"📅 Reunión":m.type==="llamado"?"📞 Llamado":"✉ Correo",fecha:m.date,nota:m.subject||m.notes?.substring(0,80)||""});
        }
      }
      // Transcripciones Diio esta semana
      for(const t of transcripts.filter(t=>t.company.toLowerCase()===client.companyName.toLowerCase())){
        if(t.date>=lunesISO)acts.push({tipo:"📅 Reunión (Diio)",fecha:t.date,nota:t.transcript?.substring(0,80)||""});
      }
      if(acts.length>0){
        porCliente.push({client,actividades:acts.sort((a,b)=>b.fecha.localeCompare(a.fecha))});
      }
    }
    return porCliente.sort((a,b)=>{
      const ord={["Pipeline P1"]:0,["Pipeline P2"]:1,["Prospecto Activo"]:2,["Prospecto Pasivo"]:3,["Perdido"]:4};
      return (ord[a.client.stage]||0)-(ord[b.client.stage]||0);
    });
  },[clients,transcripts,lunesISO]);

  function toggleTask(clientId:string,taskId:string){
    const client=clients.find(c=>c.id===clientId);
    if(!client)return;
    const tasks=(client.aiTasks||[]).map(t=>t.id===taskId?{...t,done:!t.done}:t);
    onUpdateTasks(clientId,tasks);
  }

  return(
    <div style={{display:"flex",flexDirection:"column",gap:"1.5rem"}}>
      {/* Lo que hice esta semana */}
      <div>
        <div style={{fontSize:"14px",fontWeight:600,color:D.ink,marginBottom:"10px",display:"flex",alignItems:"center",gap:"8px"}}>
          <div style={{width:"3px",height:"14px",borderRadius:"2px",background:"#16a34a"}}/>
          Lo que hice esta semana
          <span style={{fontSize:"11px",color:D.ink3,fontWeight:400}}>desde el {formatDateShort(lunesISO)}</span>
        </div>
        {actividadSemana.length===0?(
          <div style={{borderRadius:"12px",border:`1px dashed ${D.border}`,padding:"2rem",textAlign:"center",fontSize:"12px",color:D.ink3}}>
            Sin actividad registrada esta semana — las reuniones y llamados que agregues en cada cliente aparecerán acá
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {actividadSemana.map(({client,actividades})=>(
              <div key={client.id} style={{background:D.white,border:`1px solid ${D.border}`,borderRadius:"12px",padding:"12px 14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
                  <span style={{fontSize:"12px",fontWeight:600,color:D.ink}}>{client.companyName}</span>
                  <span style={{fontSize:"10px",color:D.accent,background:`${D.accent}12`,padding:"1px 7px",borderRadius:"10px",fontWeight:500}}>{client.stage}</span>
                  {client.subStage&&<span style={{fontSize:"10px",color:D.ink3}}>{client.subStage}</span>}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                  {actividades.map((a,i)=>(
                    <div key={i} style={{display:"flex",gap:"10px",fontSize:"11px",color:D.ink2,padding:"4px 8px",background:D.bg,borderRadius:"6px"}}>
                      <span style={{flexShrink:0,fontWeight:500}}>{a.tipo}</span>
                      <span style={{color:D.ink3,flexShrink:0}}>{formatDateShort(a.fecha)}</span>
                      {a.nota&&<span style={{color:D.ink2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{a.nota}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tareas IA pendientes */}
      <div>
        <div style={{fontSize:"14px",fontWeight:600,color:D.ink,marginBottom:"10px",display:"flex",alignItems:"center",gap:"8px"}}>
          <div style={{width:"3px",height:"14px",borderRadius:"2px",background:D.accent}}/>
          Tareas pendientes
          <span style={{fontSize:"11px",color:D.ink3,fontWeight:400}}>generadas por IA</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"12px"}}>
          {[{l:"Pendientes",v:tareas.length,accent:true},{l:"Completadas",v:clients.reduce((s,c)=>(c.aiTasks||[]).filter(t=>t.done).length+s,0)},{l:"Clientes con tareas",v:new Set(tareas.map(t=>t.client.id)).size}].map((m,i)=>(
            <div key={i} style={{background:D.white,border:`1px solid ${m.accent?`${D.accent}44`:D.border}`,borderRadius:"12px",padding:"10px 14px",borderLeft:m.accent?`3px solid ${D.accent}`:"none"}}>
              <div style={{fontSize:"10px",color:D.ink3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"4px"}}>{m.l}</div>
              <div style={{fontSize:"20px",fontWeight:700,color:m.accent?D.accent:D.ink,fontFamily:"'DM Serif Display',serif"}}>{m.v}</div>
            </div>
          ))}
        </div>
        {tareas.length===0?(
          <div style={{textAlign:"center",padding:"2rem",color:D.ink3,fontSize:"13px",border:`1px dashed ${D.border}`,borderRadius:"14px"}}>🎉 Sin tareas pendientes — generá acciones con IA en Pipeline P1</div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {tareas.map(({client,task,urgencia},i)=>(
              <div key={i} style={{background:D.white,border:`1px solid ${urgencia>=100?D.alarmBorder:D.border}`,borderRadius:"12px",padding:"12px 14px",display:"flex",gap:"12px",alignItems:"flex-start"}}>
                <input type="checkbox" checked={false} onChange={()=>toggleTask(client.id,task.id)} style={{marginTop:"2px",accentColor:D.accent,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"12px",color:D.ink,lineHeight:1.4,marginBottom:"4px"}}>{task.text}</div>
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{fontSize:"10px",fontWeight:600,color:client.stage==="Pipeline P1"?D.accent:"#7C3AED",background:client.stage==="Pipeline P1"?`${D.accent}15`:"#F5F3FF",padding:"1px 7px",borderRadius:"10px"}}>{client.companyName}</span>
                    {client.subStage&&<span style={{fontSize:"10px",color:D.ink3}}>{client.subStage}</span>}
                    {task.followUp&&!task.followUp.done&&!task.followUp.dismissed&&(
                      <span style={{fontSize:"10px",color:urgencia>=100?"#dc2626":"#92400e",fontWeight:600}}>⏱ {urgencia>=100?"VENCIDO":"Vence"} {task.followUp.dueDateISO}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
  const tareas=useMemo(()=>{
function FiltrosPipeline({subStages,onFilter}:{subStages:SubStage[];onFilter:(f:{subStage:string;minMwp:number;soloSf:boolean})=>void}){
  const [subStage,setSubStage]=useState("");
  const [minMwp,setMinMwp]=useState(0);
  const [soloSf,setSoloSf]=useState(false);
  useEffect(()=>onFilter({subStage,minMwp,soloSf}),[subStage,minMwp,soloSf]);
  const active=subStage||minMwp>0||soloSf;
  return(
    <div style={{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center",padding:"10px 14px",background:active?`${D.accent}08`:D.white,border:`1px solid ${active?`${D.accent}44`:D.border}`,borderRadius:"12px"}}>
      <span style={{fontSize:"11px",fontWeight:600,color:D.ink2,flexShrink:0}}>🔍 Filtros</span>
      <select value={subStage} onChange={e=>setSubStage(e.target.value)} style={{...iStyle,width:"auto",fontSize:"11px",padding:"4px 8px"}}>
        <option value="">Todas las etapas</option>
        {P1_SUBSTAGE_ORDER.map(s=><option key={s} value={s}>{s}</option>)}
      </select>
      <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
        <span style={{fontSize:"11px",color:D.ink2}}>MWp ≥</span>
        <input type="number" value={minMwp||""} onChange={e=>setMinMwp(Number(e.target.value)||0)} placeholder="0" style={{...iStyle,width:"60px",fontSize:"11px",padding:"4px 8px"}}/>
      </div>
      <label style={{display:"flex",alignItems:"center",gap:"4px",cursor:"pointer",fontSize:"11px",color:D.ink2}}>
        <input type="checkbox" checked={soloSf} onChange={e=>setSoloSf(e.target.checked)} style={{accentColor:"#1D4ED8"}}/>
        Solo Salesforce
      </label>
      {active&&<button onClick={()=>{setSubStage("");setMinMwp(0);setSoloSf(false);}} style={{fontSize:"10px",padding:"3px 8px",borderRadius:"6px",border:`1px solid ${D.border}`,background:D.white,cursor:"pointer",color:D.ink3}}>× Limpiar</button>}
    </div>
  );
}

// --- Tasa de Conversión -------------------------------------------------------
function ConversionRate({clients}:{clients:ClientRecord[]}){
  const stats=useMemo(()=>{
    const prospectos=clients.filter(c=>c.stage==="Prospecto Activo"||c.stage==="Prospecto Pasivo").length;
    const pipeline=clients.filter(c=>c.stage==="Pipeline P1"||c.stage==="Pipeline P2").length;
    const firmados=clients.filter(c=>c.subStage==="Contrato firmado").length;
    const perdidos=clients.filter(c=>c.stage==="Perdido").length;
    const total=prospectos+pipeline+firmados+perdidos;
    const convProsp=total>0?Math.round((pipeline+firmados)/(total)*100):0;
    const convPipe=pipeline+firmados>0?Math.round(firmados/(pipeline+firmados)*100):0;
    return{prospectos,pipeline,firmados,perdidos,convProsp,convPipe};
  },[clients]);
  return(
    <div style={{background:D.white,border:`1px solid ${D.border}`,borderRadius:"16px",padding:"1.25rem"}}>
      <div style={{fontSize:"13px",fontWeight:600,color:D.ink,marginBottom:"1rem"}}>Tasa de conversión</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"12px"}}>
        <div style={{background:D.bg,borderRadius:"10px",padding:"12px"}}>
          <div style={{fontSize:"10px",color:D.ink3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Prospectos → Pipeline</div>
          <div style={{fontSize:"28px",fontWeight:700,color:stats.convProsp>=50?"#16a34a":D.accent,fontFamily:"'DM Serif Display',serif"}}>{stats.convProsp}%</div>
          <div style={{fontSize:"11px",color:D.ink3,marginTop:"4px"}}>{stats.pipeline+stats.firmados} de {stats.prospectos+stats.pipeline+stats.firmados+stats.perdidos} clientes</div>
          <div style={{marginTop:"8px",height:"4px",background:D.border,borderRadius:"2px"}}>
            <div style={{height:"100%",width:`${stats.convProsp}%`,background:`linear-gradient(90deg,${D.accentY},${D.accent})`,borderRadius:"2px"}}/>
          </div>
        </div>
        <div style={{background:D.bg,borderRadius:"10px",padding:"12px"}}>
          <div style={{fontSize:"10px",color:D.ink3,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px"}}>Pipeline → Firmado</div>
          <div style={{fontSize:"28px",fontWeight:700,color:stats.convPipe>=30?"#16a34a":D.accent,fontFamily:"'DM Serif Display',serif"}}>{stats.convPipe}%</div>
          <div style={{fontSize:"11px",color:D.ink3,marginTop:"4px"}}>{stats.firmados} de {stats.pipeline+stats.firmados} proyectos</div>
          <div style={{marginTop:"8px",height:"4px",background:D.border,borderRadius:"2px"}}>
            <div style={{height:"100%",width:`${stats.convPipe}%`,background:"linear-gradient(90deg,#4ade80,#16a34a)",borderRadius:"2px"}}/>
          </div>
        </div>
      </div>
      <div style={{marginTop:"10px",paddingTop:"10px",borderTop:`1px solid ${D.border}`,display:"flex",gap:"16px",fontSize:"11px",color:D.ink3,flexWrap:"wrap"}}>
        <span>🔵 Prospectos: <strong>{stats.prospectos}</strong></span>
        <span>🟠 Pipeline: <strong>{stats.pipeline}</strong></span>
        <span>🟢 Firmados: <strong>{stats.firmados}</strong></span>
        <span>🔴 Perdidos: <strong>{stats.perdidos}</strong></span>
      </div>
    </div>
  );
}

function Pipeline1Tab({clients,contacts,transcripts,onEdit,onDelete,onUpdateTasks,onUpdateMeetings,onUpdateNote,onUpdateLastContact}:{clients:ClientRecord[];contacts:ContactInfo[];transcripts:TranscriptInfo[];onEdit:(id:string)=>void;onDelete:(id:string)=>void;onUpdateTasks:(id:string,tasks:ClientTask[])=>void;onUpdateMeetings:(id:string,meetings:Meeting[])=>void;onUpdateNote:(id:string,note:string)=>void;onUpdateLastContact:(id:string)=>void}){
  const p1=clients.filter(c=>c.stage==="Pipeline P1");
  const [filtro,setFiltro]=useState({subStage:"",minMwp:0,soloSf:false});
  const bySubStage=useMemo(()=>{
    const m=new Map<SubStage,ClientRecord[]>();
    for(const s of P1_SUBSTAGE_ORDER)m.set(s,[]);
    for(const c of p1){
      if(filtro.subStage&&c.subStage!==filtro.subStage)continue;
      if(filtro.minMwp&&c.mwp<filtro.minMwp)continue;
      if(filtro.soloSf&&!c.salesforce)continue;
      const k=c.subStage??("Evaluación preliminar" as SubStage);
      m.get(k)?.push(c);
    }
    return m;
  },[p1,filtro]);
  const metrics=useMemo(()=>{const signed=p1.filter(c=>c.subStage==="Contrato firmado");const active=p1.filter(c=>c.subStage!=="Contrato firmado");return{active:active.length,signed:signed.length,mwpActive:active.reduce((s,c)=>s+(c.mwp||0),0),mwpSigned:signed.reduce((s,c)=>s+(c.mwp||0),0)};},[p1]);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:"1.5rem"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px"}}>
        {[{l:"Clientes activos",v:metrics.active},{l:"MWp activos",v:metrics.mwpActive.toFixed(2),accent:true},{l:"Contratos firmados",v:metrics.signed},{l:"MWp firmado",v:metrics.mwpSigned.toFixed(2)}].map((m,i)=>(
          <div key={i} style={{background:D.white,border:`1px solid ${m.accent?`${D.accent}44`:D.border}`,borderRadius:"14px",padding:"1rem",borderLeft:m.accent?`3px solid ${D.accent}`:"none"}}>
            <div style={{fontSize:"10px",color:D.ink3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>{m.l}</div>
            <div style={{fontSize:"22px",fontWeight:700,color:m.accent?D.accent:D.ink,fontFamily:"'DM Serif Display',serif"}}>{m.v}</div>
          </div>
        ))}
      </div>
      <FiltrosPipeline subStages={P1_SUBSTAGE_ORDER} onFilter={setFiltro}/>
      <DashboardPanels clients={clients} transcripts={transcripts} onEdit={onEdit} onUpdateMeetings={onUpdateMeetings} onUpdateLastContact={onUpdateLastContact} onMarkContact={()=>{}} recentContacts={{}} alertOnly/>
      <AIPendientesPanel clients={p1} onUpdateTasks={onUpdateTasks} transcripts={transcripts}/>
      <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
        {P1_SUBSTAGE_ORDER.map(sub=>{
          const items=bySubStage.get(sub)??[];
          const isSigned=sub==="Contrato firmado";
          return(
            <div key={sub} style={{background:isSigned?D.signedBg:D.white,border:`1px solid ${isSigned?D.signedBorder:D.border}`,borderRadius:"16px",padding:"1.25rem",borderLeft:`3px solid ${isSigned?"#22c55e":D.accent}`}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"1rem"}}>
                {isSigned&&<span style={{color:"#22c55e"}}>✓</span>}
                <div style={{fontSize:"13px",fontWeight:600,color:D.ink}}>{sub}</div>
                <div style={{fontSize:"11px",color:D.ink3}}>{items.length} cliente{items.length!==1?"s":""}</div>
                {!isSigned&&<span style={{marginLeft:"auto",fontSize:"11px",fontWeight:700,color:D.accent,background:`${D.accent}12`,padding:"3px 9px",borderRadius:"20px"}}>{SUBSTAGE_PROB[sub]}%</span>}
              </div>
              {items.length?(<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"10px"}}>{items.map(c=><ClientCard key={c.id} client={c} contacts={contacts} transcripts={transcripts} onEdit={onEdit} onDelete={onDelete} onUpdateMeetings={onUpdateMeetings} onUpdateNote={onUpdateNote}/>)}</div>):(<div style={{borderRadius:"10px",border:`1px dashed ${D.border}`,padding:"1rem",fontSize:"12px",color:D.ink3,textAlign:"center"}}>Sin clientes</div>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Pipeline2Tab({clients,contacts,transcripts,onEdit,onDelete,onUpdateTasks,onUpdateMeetings,onUpdateNote}:{clients:ClientRecord[];contacts:ContactInfo[];transcripts:TranscriptInfo[];onEdit:(id:string)=>void;onDelete:(id:string)=>void;onUpdateTasks:(id:string,tasks:ClientTask[])=>void;onUpdateMeetings:(id:string,meetings:Meeting[])=>void;onUpdateNote:(id:string,note:string)=>void}){
  const p2=clients.filter(c=>c.stage==="Pipeline P2");
  const [filtro,setFiltro]=useState({subStage:"",minMwp:0,soloSf:false});
  const p2Filtered=useMemo(()=>p2.filter(c=>{
    if(filtro.minMwp&&c.mwp<filtro.minMwp)return false;
    if(filtro.soloSf&&!c.salesforce)return false;
    return true;
  }),[p2,filtro]);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:"1.5rem"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px"}}>
        {[{l:"Total clientes",v:p2.length},{l:"MWp total",v:p2.reduce((s,c)=>s+(c.mwp||0),0).toFixed(2),accent:true},{l:"Probabilidad",v:"5%"}].map((m,i)=>(
          <div key={i} style={{background:D.white,border:`1px solid ${m.accent?`${D.accent}44`:D.border}`,borderRadius:"14px",padding:"1rem",borderLeft:m.accent?`3px solid ${D.accent}`:"none"}}>
            <div style={{fontSize:"10px",color:D.ink3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>{m.l}</div>
            <div style={{fontSize:"22px",fontWeight:700,color:m.accent?D.accent:D.ink,fontFamily:"'DM Serif Display',serif"}}>{m.v}</div>
          </div>
        ))}
      </div>
      <FiltrosPipeline subStages={[]} onFilter={setFiltro}/>
      <AIPendientesPanel clients={p2} onUpdateTasks={onUpdateTasks} transcripts={transcripts}/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"10px"}}>
        {p2Filtered.length?p2Filtered.map(c=><ClientCard key={c.id} client={c} contacts={contacts} transcripts={transcripts} onEdit={onEdit} onDelete={onDelete} onUpdateMeetings={onUpdateMeetings} onUpdateNote={onUpdateNote}/>):(<div style={{gridColumn:"1/-1",borderRadius:"12px",border:`1px dashed ${D.border}`,padding:"2rem",textAlign:"center",fontSize:"13px",color:D.ink3}}>Sin clientes{filtro.soloSf||filtro.minMwp?" con estos filtros":" en Pipeline P2"}</div>)}
      </div>
    </div>
  );
}

function ProspectosTab({clients,contacts,transcripts,onEdit,onDelete,onUpdateTasks,onUpdateMeetings}:{clients:ClientRecord[];contacts:ContactInfo[];transcripts:TranscriptInfo[];onEdit:(id:string)=>void;onDelete:(id:string)=>void;onUpdateTasks:(id:string,tasks:ClientTask[])=>void;onUpdateMeetings:(id:string,meetings:Meeting[])=>void}){
  const activos=clients.filter(c=>c.stage==="Prospecto Activo");
  const pasivos=clients.filter(c=>c.stage==="Prospecto Pasivo");
  return(
    <div style={{display:"flex",flexDirection:"column",gap:"1.5rem"}}>
      <AIPendientesPanel clients={[...activos,...pasivos]} onUpdateTasks={onUpdateTasks} transcripts={transcripts}/>
      {[{label:"Prospectos Activos",items:activos},{label:"Prospectos Pasivos",items:pasivos}].map(({label,items})=>(
        <div key={label}>
          <div style={{fontSize:"14px",fontWeight:600,color:D.ink,marginBottom:"10px",display:"flex",alignItems:"center",gap:"8px"}}>
            <div style={{width:"3px",height:"14px",borderRadius:"2px",background:D.accentY}}/>{label}
            <span style={{fontSize:"12px",color:D.ink3,fontWeight:400}}>· {items.length} clientes</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
            {items.length?items.map(c=><ProspectoRow key={c.id} client={c} contacts={contacts} onEdit={onEdit} onDelete={onDelete}/>):(
              <div style={{borderRadius:"12px",border:`1px dashed ${D.border}`,padding:"1.5rem",textAlign:"center",fontSize:"12px",color:D.ink3}}>Sin clientes</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PerdidosTab({clients}:{clients:ClientRecord[]}){
  const perdidos=clients.filter(c=>c.stage==="Perdido").sort((a,b)=>b.updatedAtISO.localeCompare(a.updatedAtISO));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"10px",marginBottom:"0.5rem"}}>
        <div style={{background:D.white,border:`1px solid ${D.border}`,borderRadius:"14px",padding:"1rem"}}>
          <div style={{fontSize:"10px",color:D.ink3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>Proyectos perdidos</div>
          <div style={{fontSize:"22px",fontWeight:700,color:"#dc2626",fontFamily:"'DM Serif Display',serif"}}>{perdidos.length}</div>
        </div>
        <div style={{background:D.white,border:`1px solid ${D.border}`,borderRadius:"14px",padding:"1rem"}}>
          <div style={{fontSize:"10px",color:D.ink3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>MWp no cerrado</div>
          <div style={{fontSize:"22px",fontWeight:700,color:"#dc2626",fontFamily:"'DM Serif Display',serif"}}>{perdidos.reduce((s,c)=>s+(c.mwp||0),0).toFixed(2)}</div>
        </div>
      </div>
      {perdidos.length===0&&(
        <div style={{borderRadius:"12px",border:`1px dashed ${D.border}`,padding:"3rem",textAlign:"center",fontSize:"13px",color:D.ink3}}>
          Sin proyectos perdidos registrados 🎉
        </div>
      )}
      {perdidos.map(c=>(
        <div key={c.id} style={{background:D.lostBg,border:`1px solid ${D.lostBorder}`,borderRadius:"14px",padding:"14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
            <div>
              <div style={{fontSize:"13px",fontWeight:600,color:D.ink}}>{c.companyName}</div>
              {c.contactName&&<div style={{fontSize:"11px",color:D.ink3,marginTop:"2px"}}>{c.contactName}</div>}
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:"11px",fontWeight:600,color:"#dc2626"}}>{c.mwp.toFixed(2)} MWp</div>
              <div style={{fontSize:"10px",color:D.ink3,marginTop:"2px"}}>{c.updatedAtISO}</div>
            </div>
          </div>
          {c.nextAction&&(
            <div style={{background:D.white,borderRadius:"8px",padding:"8px 10px",fontSize:"12px",color:D.ink2,borderLeft:"2px solid #fca5a5"}}>
              <div style={{fontSize:"10px",color:"#dc2626",marginBottom:"2px",fontWeight:500}}>Motivo</div>
              {c.nextAction}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Edit/Create Modal Form ---------------------------------------------------
type ClientDraft=Omit<ClientRecord,"id"|"createdAtISO"|"updatedAtISO">;
const EMPTY_DRAFT:ClientDraft={companyName:"",contactName:"",stage:"Prospecto Activo",subStage:undefined,mwp:0,closeProbabilityPct:0,lastContactISO:"",nextAction:"",notes:"",stageDate:undefined,aiTasks:[],meetings:[]};

function ClientForm({draft,setDraft,onSave,onCancel,extractTasksLoading,onExtract}:{draft:ClientDraft;setDraft:React.Dispatch<React.SetStateAction<ClientDraft>>;onSave:()=>void;onCancel:()=>void;extractTasksLoading:boolean;onExtract:()=>void}){
  const prob=draft.stage==="Pipeline P2"?5:draft.stage==="Pipeline P1"&&draft.subStage?SUBSTAGE_PROB[draft.subStage]:0;
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
        <div><div style={{fontSize:"12px",fontWeight:500,color:D.ink2,marginBottom:"5px"}}>Empresa <span style={{color:D.accent}}>*</span></div><input value={draft.companyName} onChange={e=>setDraft(d=>({...d,companyName:e.target.value}))} style={iStyle} placeholder="Ej: Agrícola San Osvaldo"/></div>
        <div><div style={{fontSize:"12px",fontWeight:500,color:D.ink2,marginBottom:"5px"}}>Contacto</div><input value={draft.contactName} onChange={e=>setDraft(d=>({...d,contactName:e.target.value}))} style={iStyle} placeholder="Ej: Pedro Bulnes"/></div>
        <div><div style={{fontSize:"12px",fontWeight:500,color:D.ink2,marginBottom:"5px"}}>Etapa</div>
          <select value={draft.stage} onChange={e=>setDraft(d=>({...d,stage:e.target.value as Stage,subStage:undefined}))} style={iStyle}>
            {STAGES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div><div style={{fontSize:"12px",fontWeight:500,color:D.ink2,marginBottom:"5px"}}>Sub-etapa</div>
          <select value={draft.subStage??""} onChange={e=>setDraft(d=>({...d,subStage:(e.target.value||undefined) as SubStage|undefined}))} disabled={draft.stage!=="Pipeline P1"&&draft.stage!=="Pipeline P2"} style={{...iStyle,opacity:(draft.stage!=="Pipeline P1"&&draft.stage!=="Pipeline P2")?0.5:1}}>
            <option value="">(Sin sub-etapa)</option>
            {P1_SUBSTAGE_ORDER.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div><div style={{fontSize:"12px",fontWeight:500,color:D.ink2,marginBottom:"5px"}}>MWp</div><input inputMode="decimal" value={String(draft.mwp)} onChange={e=>{const n=Number(e.target.value.replace(",",".")); setDraft(d=>({...d,mwp:Number.isFinite(n)?n:0}));}} style={iStyle}/></div>
        <div><div style={{fontSize:"12px",fontWeight:500,color:D.ink2,marginBottom:"5px"}}>Probabilidad</div><div style={{...iStyle,background:D.bg,color:D.ink3,cursor:"default"}}>{prob?`${prob}%${draft.subStage?` — ${draft.subStage}`:""}`:draft.stage==="Pipeline P2"?"5%":"—"}</div></div>
        {draft.subStage==="Presentación final"&&(
          <div style={{gridColumn:"1/-1"}}><div style={{fontSize:"12px",fontWeight:500,color:D.ink2,marginBottom:"5px"}}>Fecha presentación final <span style={{color:D.ink3,fontWeight:400}}>(para calcular cierre estimado)</span></div><input type="date" value={draft.stageDate||""} onChange={e=>setDraft(d=>({...d,stageDate:e.target.value||undefined}))} style={iStyle}/></div>
        )}
        <div style={{gridColumn:"1/-1"}}><div style={{fontSize:"12px",fontWeight:500,color:D.ink2,marginBottom:"5px"}}>{draft.stage==="Perdido"?"Motivo de pérdida":"Comentario / último movimiento"}</div><input value={draft.nextAction} onChange={e=>setDraft(d=>({...d,nextAction:e.target.value}))} style={iStyle} placeholder={draft.stage==="Perdido"?"¿Qué pasó? ¿Por qué se perdió?":"¿Qué pasó? ¿Qué falta hacer?"}/></div>
        <div style={{gridColumn:"1/-1"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"5px"}}>
            <div style={{fontSize:"12px",fontWeight:500,color:D.ink2}}>Notas adicionales</div>
            <button disabled={extractTasksLoading} onClick={onExtract} style={{padding:"4px 12px",borderRadius:"8px",border:"1px solid #DDD6FE",background:"#F5F3FF",fontSize:"11px",cursor:"pointer",color:"#7C3AED"}}>{extractTasksLoading?"Extrayendo…":"Extraer tareas IA"}</button>
          </div>
          <textarea value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))} rows={3} style={{...iStyle,resize:"vertical"}} placeholder="Contexto, objeciones, acuerdos…"/>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:"8px",paddingTop:"1rem",borderTop:`1px solid ${D.border}`}}>
        <button onClick={onCancel} style={{padding:"8px 16px",borderRadius:"10px",border:`1px solid ${D.border}`,background:D.white,fontSize:"13px",cursor:"pointer",color:D.ink2}}>Cancelar</button>
        <button onClick={onSave} style={{padding:"8px 18px",borderRadius:"10px",border:"none",background:draft.stage==="Perdido"?"#dc2626":D.ink,fontSize:"13px",cursor:"pointer",color:D.white,fontWeight:600}}>Guardar</button>
      </div>
    </div>
  );
}

// --- Main ---------------------------------------------------------------------
export default function Home(){
  const [clients,setClients]=useState<ClientRecord[]>([]);
  const [contacts,setContacts]=useState<ContactInfo[]>([]);
  const [transcripts,setTranscripts]=useState<TranscriptInfo[]>([]);
  const [recentContacts,setRecentContacts]=useState<Record<string,string>>({});

  // Load recentContacts from localStorage on mount
  useEffect(()=>{setRecentContacts(getRecentContacts());},[]);
  const [sheetStatus,setSheetStatus]=useState<"idle"|"loading"|"ok"|"error">("idle");
  const [activeTab,setActiveTab]=useState<Tab>("dashboard");
  const [modalOpen,setModalOpen]=useState(false);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [draft,setDraft]=useState<ClientDraft>(EMPTY_DRAFT);
  const [extractTasksLoading,setExtractTasksLoading]=useState(false);

  const loadFromSheet=useCallback(async()=>{
    setSheetStatus("loading");
    try{
      const [res1,res2,res3]=await Promise.all([
        fetch(`/api/sheet-proxy?url=${encodeURIComponent(SHEET_CSV_URL)}`),
        fetch(`/api/sheet-proxy?url=${encodeURIComponent(CONTACTS_CSV_URL)}`),
        fetch(`/api/sheet-proxy?url=${encodeURIComponent(TRANSCRIPTS_CSV_URL)}`),
      ]);
      if(!res1.ok)throw new Error();
      const csv1=await res1.text();
      const parsed=parseClientsCSV(csv1);
      if(res2.ok){const csv2=await res2.text();setContacts(parseContactsCSV(csv2));}
      if(res3.ok){const csv3=await res3.text();setTranscripts(parseTranscriptsCSV(csv3));}
      if(parsed.length>0){
        const local=safeParseClients(localStorage.getItem(LOCAL_STORAGE_KEY));
        const localMap=new Map(local.map(c=>[c.companyName.toLowerCase(),c]));
        const recentC=getRecentContacts();
        const merged=parsed.map(c=>{
          const e=localMap.get(c.companyName.toLowerCase());
          const recent=recentC[e?.id||""]||recentC[c.companyName]||"";
          const bestLastContact=recent>(e?.lastContactISO||"")?(recent):(e?.lastContactISO||"");
          return e?{...c,id:e.id,aiTasks:e.aiTasks,meetings:e.meetings||[],lastContactISO:bestLastContact,createdAtISO:e.createdAtISO}:c;
        });
        setClients(merged);localStorage.setItem(LOCAL_STORAGE_KEY,JSON.stringify(merged));setSheetStatus("ok");
      }else{setClients(safeParseClients(localStorage.getItem(LOCAL_STORAGE_KEY)));setSheetStatus("ok");}
    }catch{setClients(safeParseClients(localStorage.getItem(LOCAL_STORAGE_KEY)));setSheetStatus("error");}
  },[]);

  useEffect(()=>{loadFromSheet();},[loadFromSheet]);
  useEffect(()=>{if(sheetStatus!=="idle")localStorage.setItem(LOCAL_STORAGE_KEY,JSON.stringify(clients));},[clients,sheetStatus]);

  function updateClientTasks(clientId:string,tasks:ClientTask[]){setClients(prev=>prev.map(c=>c.id===clientId?{...c,aiTasks:tasks,updatedAtISO:todayISO()}:c));}
  function updateClientMeetings(clientId:string,meetings:Meeting[]){setClients(prev=>prev.map(c=>c.id===clientId?{...c,meetings,updatedAtISO:todayISO()}:c));}
  function updateClientLastContact(clientId:string){setClients(prev=>prev.map(c=>c.id===clientId?{...c,lastContactISO:todayISO(),updatedAtISO:todayISO()}:c));}
  function markRecentContact(clientId:string){
    const newRecent={...recentContacts,[clientId]:todayISO()};
    setRecentContacts(newRecent);
    saveRecentContact(clientId,todayISO());
    // También actualizar lastContactISO en el cliente directamente
    updateClientLastContact(clientId);
  }
  function updateClientNote(clientId:string,note:string){setClients(prev=>prev.map(c=>c.id===clientId?{...c,nextAction:note,updatedAtISO:todayISO()}:c));}
  function openCreate(){setEditingId(null);setExtractTasksLoading(false);setDraft({...EMPTY_DRAFT,lastContactISO:todayISO()});setModalOpen(true);}
  function openEdit(id:string){const c=clients.find(x=>x.id===id);if(!c)return;setEditingId(id);setDraft({companyName:c.companyName,contactName:c.contactName,stage:c.stage,subStage:c.subStage,mwp:c.mwp,closeProbabilityPct:c.closeProbabilityPct,lastContactISO:c.lastContactISO,nextAction:c.nextAction,notes:c.notes,stageDate:c.stageDate,aiTasks:c.aiTasks,meetings:c.meetings||[]});setModalOpen(true);}
  function removeClient(id:string){const c=clients.find(x=>x.id===id);if(!c||!window.confirm(`¿Eliminar "${c.companyName}"?`))return;setClients(prev=>prev.filter(x=>x.id!==id));}
  function saveClient(){
    if(!draft.companyName.trim()){window.alert("Ingresa el nombre de la empresa.");return;}
    const now=todayISO();
    let prob=0;if(draft.stage==="Pipeline P2")prob=5;else if(draft.stage==="Pipeline P1"&&draft.subStage)prob=SUBSTAGE_PROB[draft.subStage];
    const n={...draft,closeProbabilityPct:prob,subStage:(draft.stage==="Pipeline P1"||draft.stage==="Pipeline P2")?draft.subStage:undefined};
    if(!editingId){setClients(prev=>[{id:newId(),...n,createdAtISO:now,updatedAtISO:now},...prev]);}
    else{setClients(prev=>prev.map(c=>c.id===editingId?{...c,...n,updatedAtISO:now}:c));}
    setModalOpen(false);
  }
  async function extractTasksWithAI(){
    if(!draft.notes.trim()){window.alert("Escribe notas antes.");return;}
    setExtractTasksLoading(true);
    try{const res=await fetch("/api/extract-tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({notes:draft.notes})});const data=await res.json() as {tasks?:string[];error?:string};if(!res.ok){window.alert(data.error??"Error.");return;}setDraft(d=>({...d,aiTasks:(Array.isArray(data.tasks)?data.tasks:[]).map(text=>({id:newId(),text,done:false}))}));}
    catch{window.alert("Error de red.");}finally{setExtractTasksLoading(false);}
  }

  const activeClients=useMemo(()=>clients.filter(c=>c.stage!=="Perdido"),[clients]);

  const metrics=useMemo(()=>{
    const pipeline=activeClients.filter(c=>c.stage==="Pipeline P1"||c.stage==="Pipeline P2");
    const signed=activeClients.filter(c=>c.subStage==="Contrato firmado");
    const p1Active=activeClients.filter(c=>c.stage==="Pipeline P1"&&c.subStage!=="Contrato firmado");
    const sfPipeline=pipeline.filter(c=>c.salesforce);
    return{
      mwpTotal:pipeline.reduce((s,c)=>s+(c.mwp||0),0),
      totalPipeline:pipeline.length,
      mwpP1:p1Active.reduce((s,c)=>s+(c.mwp||0),0),
      mwpFirmado:signed.reduce((s,c)=>s+(c.mwp||0),0),
      mwpSalesforce:sfPipeline.reduce((s,c)=>s+(c.mwp||0),0),
      countSalesforce:sfPipeline.length,
      mwpProb2026:pipeline.filter(c=>c.subStage!=="Contrato firmado").filter(c=>{const d=closingDate(c.subStage,c.stageDate);return d&&d.getFullYear()===2026;}).reduce((s,c)=>s+(c.mwp||0)*(c.closeProbabilityPct/100),0),
      mwpProb2027:pipeline.filter(c=>c.subStage!=="Contrato firmado").filter(c=>{const d=closingDate(c.subStage,c.stageDate);return d&&d.getFullYear()===2027;}).reduce((s,c)=>s+(c.mwp||0)*(c.closeProbabilityPct/100),0),
    };
  },[activeClients]);

  async function exportToExcel(){
    // Load SheetJS dynamically
    await new Promise<void>((resolve,reject)=>{
      if((window as unknown as Record<string,unknown>).XLSX){resolve();return;}
      const s=document.createElement("script");
      s.src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
      s.onload=()=>resolve();s.onerror=()=>reject();
      document.head.appendChild(s);
    }).catch(()=>null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const XLSX=(window as any).XLSX;
    const header=["Empresa","Contacto","Etapa","Sub-etapa","MWp","Prob%","Comentario","Fecha etapa","Salesforce","Fecha ingreso pipeline"];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toRows=(arr:ClientRecord[])=>arr.map((c:ClientRecord)=>[c.companyName,c.contactName,c.stage,c.subStage||"",c.mwp,c.closeProbabilityPct,c.nextAction,c.stageDate||"",c.salesforce?"Sí":"No",c.ingressDate||""]);
    const pipeline=activeClients.filter(c=>c.stage==="Pipeline P1"||c.stage==="Pipeline P2");
    const prospectos=activeClients.filter(c=>c.stage==="Prospecto Activo"||c.stage==="Prospecto Pasivo");
    const perdidos=clients.filter(c=>c.stage==="Perdido");
    if(XLSX){
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([header,...toRows(pipeline)]),"Pipeline");
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([header,...toRows(prospectos)]),"Prospectos");
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([header,...toRows(perdidos)]),"Perdidos");
      XLSX.writeFile(wb,`CRM_Solarity_${todayISO()}.xlsx`);
    } else {
      // Fallback CSV
      const toCSV=(data:ClientRecord[])=>[header,...toRows(data)].map(r=>r.map(v=>typeof v==="string"&&String(v).includes(",")? `"${v}"`:v).join(",")).join("\n");
      const content=`Pipeline\n${toCSV(pipeline)}\n\nProspectos\n${toCSV(prospectos)}\n\nPerdidos\n${toCSV(perdidos)}`;
      const blob=new Blob(["\ufeff"+content],{type:"text/csv;charset=utf-8;"});
      const url=URL.createObjectURL(blob);
      const a=document.createElement("a");a.href=url;a.download=`CRM_Solarity_${todayISO()}.csv`;a.click();
      URL.revokeObjectURL(url);
    }
  }

  const perdidosCount=useMemo(()=>clients.filter(c=>c.stage==="Perdido").length,[clients]);
  const tareasCount=useMemo(()=>activeClients.reduce((s,c)=>(c.aiTasks||[]).filter(t=>!t.done).length+s,0),[activeClients]);
  const tabs:[Tab,string][]=[
    ["dashboard","Dashboard"],
    ["semana",`Mi semana${tareasCount>0?` (${tareasCount})`:""}` ],
    ["pipeline1","Pipeline P1"],
    ["pipeline2","Pipeline P2"],
    ["prospectos","Prospectos"],
    ["perdidos",`Perdidos${perdidosCount>0?` (${perdidosCount})`:""}` ],
  ];

  return(
    <div style={{minHeight:"100dvh",background:D.bg}}>
      <style>{fontStyle}</style>
      <header style={{background:D.white,borderBottom:`1px solid ${D.border}`,position:"sticky",top:0,zIndex:20}}>
        <div style={{maxWidth:"1280px",margin:"0 auto",padding:"0 2rem"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.75rem 0",gap:"16px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
              <img src={LOGO_B64} alt="Solarity" style={{height:"36px",width:"auto"}}/>
              <div style={{width:"1px",height:"24px",background:D.border}}/>
              <div>
                <div style={{fontSize:"14px",fontWeight:600,color:D.ink,fontFamily:"'DM Serif Display',serif"}}>CRM de Ventas Antonia Vial</div>
                <div style={{fontSize:"10px",color:D.ink3,letterSpacing:"0.06em",textTransform:"uppercase"}}>Solarity · Meta 2026: {ANNUAL_GOAL_MWP} MWp</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              <button onClick={exportToExcel} style={{padding:"6px 13px",borderRadius:"9px",border:`1px solid ${D.border}`,background:D.white,fontSize:"12px",cursor:"pointer",color:D.ink2,fontWeight:500}}>↓ Excel</button>
              <button onClick={loadFromSheet} disabled={sheetStatus==="loading"} style={{padding:"6px 13px",borderRadius:"9px",border:`1px solid ${D.border}`,background:D.white,fontSize:"12px",cursor:"pointer",color:sheetStatus==="ok"?"#166534":sheetStatus==="error"?"#dc2626":D.ink2,fontWeight:500}}>
                {sheetStatus==="loading"?"⏳ Sync…":sheetStatus==="ok"?"✓ Sincronizado":sheetStatus==="error"?"⚠ Error · Reintentar":"↻ Cargar"}
              </button>
              <button onClick={openCreate} style={{padding:"7px 15px",borderRadius:"9px",border:"none",background:D.ink,fontSize:"12px",cursor:"pointer",color:D.white,fontWeight:600}}>+ Cliente</button>
            </div>
          </div>
          <div style={{display:"flex",gap:"0",borderTop:`1px solid ${D.border}`}}>
            {tabs.map(([tab,label])=>(
              <button key={tab} onClick={()=>setActiveTab(tab)} style={{padding:"0.65rem 1.25rem",border:"none",background:"none",cursor:"pointer",fontSize:"13px",fontWeight:activeTab===tab?600:400,color:activeTab===tab?(tab==="perdidos"?"#dc2626":D.accent):D.ink3,borderBottom:activeTab===tab?`2px solid ${tab==="perdidos"?"#dc2626":D.accent}`:"2px solid transparent",transition:"all 0.15s"}}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{maxWidth:"1280px",margin:"0 auto",padding:"2rem"}}>
        {activeTab==="dashboard"&&(
          <div style={{display:"flex",flexDirection:"column",gap:"1.5rem"}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"10px"}}>
              {[
                {l:"Pipeline total CRM",v:metrics.mwpTotal.toFixed(2),u:"MWp",accent:true},
                {l:"Pipeline Salesforce",v:metrics.mwpSalesforce.toFixed(2),u:`MWp · ${metrics.countSalesforce} proyectos`,sf:true},
                {l:"MWp Pipeline P1",v:metrics.mwpP1.toFixed(2),u:"MWp activos"},
                {l:"Probable cierre 2026",v:metrics.mwpProb2026.toFixed(2),u:"MWp pond."},
                {l:"MWp firmado",v:metrics.mwpFirmado.toFixed(2),u:metrics.mwpFirmado>=ANNUAL_GOAL_MWP?"🎉 Meta cumplida":"cerrados"},
              ].map((m,i)=>(
                <div key={i} style={{background:D.white,border:`1px solid ${(m as {accent?:boolean;sf?:boolean}).accent?`${D.accent}44`:(m as {sf?:boolean}).sf?"#BFDBFE":D.border}`,borderRadius:"14px",padding:"1.1rem",borderLeft:(m as {accent?:boolean}).accent?`3px solid ${D.accent}`:(m as {sf?:boolean}).sf?"3px solid #1D4ED8":"none"}}>
                  <div style={{fontSize:"10px",color:D.ink3,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"6px"}}>{m.l}</div>
                  <div style={{fontSize:"22px",fontWeight:700,color:(m as {accent?:boolean}).accent?D.accent:(m as {sf?:boolean}).sf?"#1D4ED8":D.ink,fontFamily:"'DM Serif Display',serif"}}>{m.v}</div>
                  <div style={{fontSize:"10px",color:D.ink3,marginTop:"2px"}}>{m.u}</div>
                </div>
              ))}
            </div>
            {metrics.mwpProb2027>0&&(
              <div style={{display:"flex",alignItems:"center",gap:"12px",background:D.white,border:`1px solid ${D.border}`,borderRadius:"10px",padding:"8px 14px"}}>
                <span style={{fontSize:"10px",fontWeight:600,color:"#7C3AED",textTransform:"uppercase",letterSpacing:"0.05em"}}>Probable cierre 2027</span>
                <span style={{fontSize:"14px",fontWeight:700,color:D.ink}}>{metrics.mwpProb2027.toFixed(2)} MWp</span>
                <span style={{fontSize:"11px",color:D.ink3}}>Proyectos fuera del año 2026</span>
              </div>
            )}
            <DashboardPanels clients={activeClients} transcripts={transcripts} onEdit={openEdit} onUpdateMeetings={updateClientMeetings} onUpdateLastContact={updateClientLastContact} onMarkContact={markRecentContact} recentContacts={recentContacts}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
              <ProbChart clients={activeClients}/>
              <MonthlyChart clients={activeClients}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
              <PipelineGeneradoChart clients={clients}/>
              <ConversionRate clients={clients}/>
            </div>
          </div>
        )}
        {activeTab==="semana"&&<SemanaTab clients={activeClients} transcripts={transcripts} onUpdateTasks={updateClientTasks}/>}
        {activeTab==="pipeline1"&&<Pipeline1Tab clients={activeClients} contacts={contacts} transcripts={transcripts} onEdit={openEdit} onDelete={removeClient} onUpdateTasks={updateClientTasks} onUpdateMeetings={updateClientMeetings} onUpdateNote={updateClientNote} onUpdateLastContact={updateClientLastContact}/>}
        {activeTab==="pipeline2"&&<Pipeline2Tab clients={activeClients} contacts={contacts} transcripts={transcripts} onEdit={openEdit} onDelete={removeClient} onUpdateTasks={updateClientTasks} onUpdateMeetings={updateClientMeetings} onUpdateNote={updateClientNote}/>}
        {activeTab==="prospectos"&&<ProspectosTab clients={activeClients} contacts={contacts} transcripts={transcripts} onEdit={openEdit} onDelete={removeClient} onUpdateTasks={updateClientTasks} onUpdateMeetings={updateClientMeetings}/>}
        {activeTab==="perdidos"&&<PerdidosTab clients={clients}/>}
      </div>

      <Modal open={modalOpen} title={editingId?"Editar cliente":"Agregar cliente"} onClose={()=>setModalOpen(false)}>
        <ClientForm draft={draft} setDraft={setDraft} onSave={saveClient} onCancel={()=>setModalOpen(false)} extractTasksLoading={extractTasksLoading} onExtract={extractTasksWithAI}/>
      </Modal>
    </div>
  );
}
