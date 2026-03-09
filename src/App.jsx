import React, { useState, useEffect, useCallback, useRef } from "react";

// ── Palette ─────────────────────────────────────────────────────────────────
const C = {
  coral:"#FC1757", coralLight:"#FC175714", coralMid:"#FC175735",
  bg:"#FFFFFF", bgSoft:"#F7F7F7", bgWarm:"#FFF9F7",
  card:"#FFFFFF", border:"#EBEBEB", borderMid:"#DDDDDD",
  text:"#222222", textMid:"#717171", textLight:"#B0B0B0",
  green:"#008A05", greenLight:"#008A0514",
  amber:"#C47D03", amberLight:"#C47D0314",
  blue:"#0066CC",  blueLight:"#0066CC14",
  purple:"#7C3AED",purpleLight:"#7C3AED14",
  shadow:"0 1px 2px rgba(0,0,0,.08), 0 4px 12px rgba(0,0,0,.05)",
  shadowHov:"0 2px 4px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.10)",
  shadowSm:"0 1px 4px rgba(0,0,0,.06)",
};

const CATEGORIES = ["Moradia","Transporte","Alimentação","Saúde","Educação","Lazer","Vestuário","Assinaturas","Seguros","Outros"];
const CAT_COLORS = {"Moradia":C.blue,"Transporte":C.amber,"Alimentação":C.green,"Saúde":C.coral,"Educação":C.purple,"Lazer":"#E97C00","Vestuário":"#B91C8A","Assinaturas":"#0891B2","Seguros":"#059669","Outros":C.textMid};
const CAT_BG = Object.fromEntries(Object.entries(CAT_COLORS).map(([k,v])=>[k,v+"18"]));
const CAT_EMOJI = {"Moradia":"🏠","Transporte":"🚗","Alimentação":"🍔","Saúde":"💊","Educação":"📚","Lazer":"🎮","Vestuário":"👕","Assinaturas":"📱","Seguros":"🛡","Outros":"📦"};
const formatBRL = v => Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

// ── SheetJS loader (CDN) ──────────────────────────────────────────────────────
let _xlsxLib = null;
const loadXLSX = () => new Promise((res, rej) => {
  if (_xlsxLib) { res(_xlsxLib); return; }
  if (typeof window !== "undefined" && window.XLSX) { _xlsxLib = window.XLSX; res(_xlsxLib); return; }
  const s = document.createElement("script");
  s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  s.onload = () => { _xlsxLib = window.XLSX; res(_xlsxLib); };
  s.onerror = rej;
  document.head.appendChild(s);
});

// ── Storage ──────────────────────────────────────────────────────────────────
const SK = { accounts:"mp:accounts", session:"mp:session", cookies:"mp:cookies" };
const loadCookies = async () => { try{const r=await window.storage.get(SK.cookies);return r?JSON.parse(r.value):null;}catch{return null;} };
const saveCookies = async (prefs) => { try{await window.storage.set(SK.cookies,JSON.stringify(prefs));}catch{} };
const loadAccounts = async () => { try { const r=await window.storage.get(SK.accounts); return r?JSON.parse(r.value):{}; } catch{return{};} };
const saveAccounts = async a => { try{await window.storage.set(SK.accounts,JSON.stringify(a));}catch{} };
const loadSession   = async () => { try { const r=await window.storage.get(SK.session); return r?JSON.parse(r.value):null; } catch{return null;} };
const saveSession   = async u => { try{ if(u) await window.storage.set(SK.session,JSON.stringify(u)); else await window.storage.delete(SK.session); }catch{} };

// ── Plan system ───────────────────────────────────────────────────────────────
const PLANS = {
  free: { id:"free", name:"Gratuito", price:0,
    limits:{ expenses:5, goals:1, aiImports:1, aiAnalysis:1, planMonths:1, uploadExtratos:false, fullReport:false, exportXls:false },
    features:[
      "Até 5 despesas por mês",
      "1 objetivo de vida",
      "1 importação IA por texto/mês",
      "1 análise IA/mês",
      "Planejamento só do mês atual",
      "Dashboard básico com 50/30/20",
    ] },
  pro:  { id:"pro",  name:"PRO",      price:29.90,
    limits:{ expenses:Infinity, goals:Infinity, aiImports:Infinity, aiAnalysis:Infinity, planMonths:Infinity, uploadExtratos:true, fullReport:true, exportXls:true },
    features:[
      "Despesas e objetivos ilimitados",
      "Importação IA ilimitada (texto e arquivo)",
      "Upload de extratos PDF e imagens",
      "Análise IA ilimitada",
      "Relatório completo com pesquisa web",
      "Planejamento anual completo (12 meses)",
      "Exportar XLS por mês ou ano inteiro",
      "Suporte prioritário",
    ] },
};
const PLAN_GOLD = "#F59E0B";
const PLAN_PRO_GRAD = "linear-gradient(135deg,#7C3AED 0%,#4F46E5 100%)";

const curMonth = () => new Date().toISOString().slice(0,7);
const SK_USAGE = email => `mp:usage:${email}`;
const loadUsage  = async email => { try{const r=await window.storage.get(SK_USAGE(email));return r?JSON.parse(r.value):{month:"",aiImports:0,aiAnalysis:0};}catch{return{month:"",aiImports:0,aiAnalysis:0};} };
const saveUsage  = async (email,u) => { try{await window.storage.set(SK_USAGE(email),JSON.stringify(u));}catch{} };
const SK_PLAN = email => `mp:plan:${email}`;
const loadPlan   = async email => { try{const r=await window.storage.get(SK_PLAN(email));return r?r.value:"free";}catch{return"free";} };
const savePlan   = async (email,p) => { try{await window.storage.set(SK_PLAN(email),p);}catch{} };

// ── Responsive hook ───────────────────────────────────────────────────────────
function useIsMobile(bp=768) {
  const [mob, setMob] = useState(() => typeof window!=="undefined" && window.innerWidth < bp);
  useEffect(() => {
    const fn = () => setMob(window.innerWidth < bp);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [bp]);
  return mob;
}

// ── Global CSS ────────────────────────────────────────────────────────────────
const BASE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{font-family:'Plus Jakarta Sans','Segoe UI',sans-serif;-webkit-tap-highlight-color:transparent;}
  input,textarea,select{font-size:16px!important;}
  input::placeholder,textarea::placeholder{color:#B0B0B0;}
  select option{background:#fff;}
  ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:#EBEBEB;border-radius:10px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  @keyframes slideIn{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:translateX(0);}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes pulse{0%,100%{opacity:.5;}50%{opacity:1;}}
  @keyframes stepFade{from{opacity:0;transform:translateX(24px);}to{opacity:1;transform:translateX(0);}}
  .fade-up{animation:fadeUp .35s ease both;}
  .fade-in{animation:fadeIn .25s ease both;}
  .step-content{animation:stepFade .35s ease both;}
  .shimmer{animation:pulse 1.4s ease infinite;background:#F7F7F7;}
  .spinner{animation:spin .9s linear infinite;display:inline-block;}
  .primary-btn:hover:not(:disabled){background:#E01050!important;box-shadow:0 4px 14px rgba(252,23,87,.3);transform:translateY(-1px);}
  .primary-btn:active:not(:disabled){transform:translateY(0);}
  .ghost-btn:hover{background:#F7F7F7!important;border-color:#717171!important;color:#222!important;}
  .tab-item{transition:all .18s;cursor:pointer;border:none;background:transparent;font-family:inherit;}
  .card-hover{transition:box-shadow .18s,transform .18s;}
  .card-hover:hover{box-shadow:0 2px 4px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.10);transform:translateY(-2px);}
  .expense-row:hover{background:#F7F7F7!important;}
  .del-btn:hover{background:#FFE8EC!important;color:#FC1757!important;border-color:#FFCCD5!important;}
  .user-pill{transition:background .15s;}
  .user-btn:hover .user-pill{background:#F7F7F7!important;}
  .menu-item{display:flex;align-items:center;gap:10;width:100%;padding:10px 14px;border:none;background:transparent;font-family:inherit;font-size:14px;color:#222;cursor:pointer;border-radius:8px;transition:background .12s;}
  .menu-item:hover{background:#F7F7F7;}
  .menu-item.danger{color:#FC1757;}
  .menu-item.danger:hover{background:#FFF0F2;}
  .slide-down{animation:fadeUp .2s ease both;}
  .auth-link{color:#FC1757;font-weight:700;cursor:pointer;background:none;border:none;font-family:inherit;font-size:14px;padding:0;}
  .auth-link:hover{text-decoration:underline;}
  .show-pass{background:none;border:none;cursor:pointer;color:#717171;font-family:inherit;font-size:12px;font-weight:600;padding:0;}
  .social-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px;border:1.5px solid #EBEBEB;border-radius:12px;background:#fff;font-family:inherit;font-size:14px;font-weight:600;color:#222;cursor:pointer;transition:all .15s;}
  .social-btn:hover{background:#F7F7F7;border-color:#DDDDDD;}
  .faq-plus{transition:transform .2s;}
  .bnav-btn{display:flex;flex-direction:column;align-items:center;gap:3px;border:none;background:transparent;cursor:pointer;padding:6px 12px;border-radius:12px;transition:all .15s;font-family:inherit;min-width:52px;}
  .bnav-btn:hover{background:#F7F7F7;}
  textarea{font-family:inherit;resize:none;}
  input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
  @media(max-width:768px){
    .card-hover:hover{box-shadow:0 1px 2px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)!important;transform:none!important;}
    .primary-btn:hover:not(:disabled){transform:none!important;}
    button{-webkit-tap-highlight-color:transparent;}
  }
  @media(hover:none){
    .card-hover:hover{box-shadow:0 1px 2px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.05)!important;transform:none!important;}
  }
  @keyframes proGlow{0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,.0);}50%{box-shadow:0 0 0 6px rgba(124,58,237,.12);}}
  .pro-glow{animation:proGlow 2.5s ease infinite;}
`;

// ── Primitives ────────────────────────────────────────────────────────────────
const Card = ({children,style={},className=""}) => (
  <div className={className} style={{background:C.card,borderRadius:16,boxShadow:C.shadow,border:`1px solid ${C.border}`,...style}}>{children}</div>
);
const Pill = ({children,color=C.coral,bg}) => (
  <span style={{background:bg||color+"18",color,borderRadius:100,padding:"3px 10px",fontSize:11,fontWeight:700,letterSpacing:".03em",whiteSpace:"nowrap"}}>{children}</span>
);
const SectionLabel = ({children}) => (
  <div style={{fontSize:11,fontWeight:700,color:C.textLight,letterSpacing:".08em",textTransform:"uppercase",marginBottom:8}}>{children}</div>
);
const PrimaryBtn = ({children,onClick,disabled=false,fullWidth=false,size="md"}) => (
  <button onClick={onClick} disabled={disabled} className="primary-btn"
    style={{background:disabled?"#E8E8E8":C.coral,color:disabled?C.textLight:"#fff",border:"none",borderRadius:10,
      padding:size==="lg"?"14px 28px":size==="sm"?"8px 14px":"12px 20px",
      fontWeight:700,fontSize:size==="lg"?15:14,fontFamily:"inherit",cursor:disabled?"not-allowed":"pointer",
      display:"flex",alignItems:"center",justifyContent:"center",gap:8,
      width:fullWidth?"100%":"auto",transition:"background .15s,transform .1s,box-shadow .15s"}}>
    {children}
  </button>
);
const GhostBtn = ({children,onClick}) => (
  <button onClick={onClick} className="ghost-btn"
    style={{background:"transparent",border:`1.5px solid ${C.border}`,color:C.textMid,borderRadius:10,padding:"12px 18px",fontWeight:600,fontSize:13,fontFamily:"inherit",cursor:"pointer",transition:"all .15s"}}>
    {children}
  </button>
);
const FieldInput = ({label,value,onChange,placeholder,type="text",prefix,hint,error}) => (
  <div style={{marginBottom:16}}>
    {label&&<label style={{display:"block",fontSize:13,fontWeight:600,color:C.text,marginBottom:6}}>{label}</label>}
    <div style={{position:"relative"}}>
      {prefix&&<span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",color:C.textMid,fontSize:14,pointerEvents:"none",fontWeight:500}}>{prefix}</span>}
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:"100%",background:error?"#FFF5F6":C.bgSoft,border:`1.5px solid ${error?C.coral:C.border}`,borderRadius:12,
          padding:prefix?"12px 14px 12px 36px":"12px 14px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}
        onFocus={e=>{e.target.style.borderColor=C.coral;e.target.style.boxShadow=`0 0 0 3px ${C.coralLight}`;}}
        onBlur={e=>{e.target.style.borderColor=error?C.coral:C.border;e.target.style.boxShadow="none";}}
      />
    </div>
    {hint&&<div style={{fontSize:12,color:C.textLight,marginTop:4}}>{hint}</div>}
    {error&&<div style={{fontSize:12,color:C.coral,marginTop:4,fontWeight:500}}>{error}</div>}
  </div>
);
const FieldSelect = ({label,value,onChange,options}) => (
  <div style={{marginBottom:16}}>
    {label&&<label style={{display:"block",fontSize:13,fontWeight:600,color:C.text,marginBottom:6}}>{label}</label>}
    <select value={value} onChange={e=>onChange(e.target.value)}
      style={{width:"100%",background:C.bgSoft,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"12px 14px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit",cursor:"pointer"}}
      onFocus={e=>{e.target.style.borderColor=C.coral;}} onBlur={e=>{e.target.style.borderColor=C.border;}}>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

// ── Charts ────────────────────────────────────────────────────────────────────
const DonutChart = ({data,size=160}) => {
  const total=data.reduce((s,d)=>s+d.value,0);
  if(!total) return null;
  let cur=-Math.PI/2;
  const R=62,r=38,cx=80,cy=80;
  const slices=data.map(d=>{
    const a=(d.value/total)*2*Math.PI,x1=Math.cos(cur)*R+cx,y1=Math.sin(cur)*R+cy;
    cur+=a; const x2=Math.cos(cur)*R+cx,y2=Math.sin(cur)*R+cy;
    return {...d,path:`M${cx},${cy} L${x1},${y1} A${R},${R} 0 ${a>Math.PI?1:0},1 ${x2},${y2} Z`};
  });
  return (
    <svg width={size} height={size} viewBox="0 0 160 160">
      <circle cx={cx} cy={cy} r={R} fill={C.bgSoft}/>
      {slices.map((s,i)=><path key={i} d={s.path} fill={s.color} opacity=".88"/>)}
      <circle cx={cx} cy={cy} r={r} fill={C.card}/>
    </svg>
  );
};
const BarRow = ({label,value,max,color}) => (
  <div style={{marginBottom:12}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
      <span style={{fontSize:13,color:C.text,fontWeight:500}}>{label}</span>
      <span style={{fontSize:13,fontWeight:700}}>{formatBRL(value)}</span>
    </div>
    <div style={{background:C.bgSoft,borderRadius:100,height:5,overflow:"hidden"}}>
      <div style={{width:`${Math.min((value/max)*100,100)}%`,height:"100%",background:color,borderRadius:100,transition:"width .9s cubic-bezier(.4,0,.2,1)"}}/>
    </div>
  </div>
);
const ScoreRing = ({score}) => {
  const color=score>=70?C.green:score>=40?C.amber:C.coral;
  const r=34,circ=2*Math.PI*r,dash=(score/100)*circ;
  return (
    <div style={{position:"relative",width:88,height:88,flexShrink:0}}>
      <svg width={88} height={88} viewBox="0 0 88 88" style={{transform:"rotate(-90deg)"}}>
        <circle cx={44} cy={44} r={r} fill="none" stroke={C.bgSoft} strokeWidth={7}/>
        <circle cx={44} cy={44} r={r} fill="none" stroke={color} strokeWidth={7} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontSize:20,fontWeight:800,color,lineHeight:1}}>{score}</div>
        <div style={{fontSize:8,fontWeight:700,color:C.textLight,letterSpacing:".07em",textTransform:"uppercase"}}>Score</div>
      </div>
    </div>
  );
};
const Avatar = ({name,size=34,emoji,photoUrl}) => {
  if (photoUrl) return (
    <img src={photoUrl} alt={name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0,display:"block"}}/>
  );
  if (emoji) return (
    <div style={{width:size,height:size,borderRadius:"50%",background:"#FC175714",border:"1.5px solid #FC175740",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.52,flexShrink:0}}>{emoji}</div>
  );
  const initials=name.trim().split(" ").filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("");
  const colors=["#FC1757","#E97C00","#0066CC","#008A05","#7C3AED","#0891B2","#B91C8A"];
  const idx=name.split("").reduce((a,c)=>a+c.charCodeAt(0),0)%colors.length;
  return <div style={{width:size,height:size,borderRadius:"50%",background:colors[idx],display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.36,fontWeight:700,color:"#fff",flexShrink:0}}>{initials||"?"}</div>;
};
const Logo = ({height=24, white=false}) => {
  const color = white ? "#FFFFFF" : "#FC1757";
  return (
    <svg height={height} viewBox="0 0 2153 1086" fill="none" xmlns="http://www.w3.org/2000/svg" style={{display:"block"}}>
      <path d="M568.857 383.04H756.057V515.52H424.857V11.52H752.457V142.56H568.857V197.28H734.457V326.88H568.857V383.04Z" fill={color}/>
      <path d="M210.24 527.04C155.52 527.04 109.92 515.76 73.44 493.2C36.96 470.16 12.48 439.2 0 400.32L123.12 329.04C139.92 371.76 170.16 393.12 213.84 393.12C246.48 393.12 262.8 384.48 262.8 367.2C262.8 362.4 261.6 358.08 259.2 354.24C256.8 350.4 252.24 347.04 245.52 344.16C238.8 341.28 232.8 339.12 227.52 337.68C222.72 335.76 214.08 333.12 201.6 329.76C189.12 326.4 179.76 323.76 173.52 321.84C73.2 291.6 23.04 237.6 23.04 159.84C23.04 113.76 39.6 75.6 72.72 45.36C106.32 15.12 150.24 0 204.48 0C247.2 0 285.36 10.08 318.96 30.24C353.04 50.4 378 79.44 393.84 117.36L274.32 187.2C260.4 151.68 237.36 133.92 205.2 133.92C192.72 133.92 183.12 136.56 176.4 141.84C170.16 146.64 167.04 152.88 167.04 160.56C167.04 171.12 172.56 179.28 183.6 185.04C195.12 190.8 216.96 198.24 249.12 207.36C273.12 214.56 292.8 221.52 308.16 228.24C323.52 234.48 339.6 243.6 356.4 255.6C373.2 267.12 385.68 282.24 393.84 300.96C402.48 319.2 406.8 340.8 406.8 365.76C406.8 417.12 389.04 456.96 353.52 485.28C318.48 513.12 270.72 527.04 210.24 527.04Z" fill={color}/>
      <path d="M1964.84 941.87H2152.04V1074.35H1820.84V570.35H2148.44V701.39H1964.84V756.11H2130.44V885.71H1964.84V941.87Z" fill={color}/>
      <path d="M1615.83 570.35C1668.15 570.35 1711.83 586.91 1746.87 620.03C1781.91 652.67 1799.43 696.35 1799.43 751.07C1799.43 805.79 1781.91 849.71 1746.87 882.83C1711.83 915.47 1668.15 931.79 1615.83 931.79H1558.23V1074.35H1414.23V570.35H1615.83ZM1615.83 792.11C1626.87 792.11 1636.23 788.51 1643.91 781.31C1651.59 773.63 1655.43 763.55 1655.43 751.07C1655.43 738.59 1651.59 728.75 1643.91 721.55C1636.23 713.87 1626.87 710.03 1615.83 710.03H1558.23V792.11H1615.83Z" fill={color}/>
      <path d="M1313.87 1036.19C1275.95 1069.31 1226.51 1085.87 1165.55 1085.87C1104.59 1085.87 1055.15 1069.31 1017.23 1036.19C979.314 1003.07 960.354 959.63 960.354 905.87V570.35H1104.35V890.03C1104.35 927.47 1124.75 946.19 1165.55 946.19C1206.35 946.19 1226.75 927.47 1226.75 890.03V570.35H1370.75V905.87C1370.75 959.63 1351.79 1003.07 1313.87 1036.19Z" fill={color}/>
      <path d="M857.4 1010.27C806.04 1060.67 742.92 1085.87 668.04 1085.87C593.16 1085.87 529.8 1060.67 477.96 1010.27C426.6 959.39 400.92 896.75 400.92 822.35C400.92 747.95 426.6 685.55 477.96 635.15C529.8 584.27 593.16 558.83 668.04 558.83C742.92 558.83 806.04 584.27 857.4 635.15C909.24 685.55 935.16 747.95 935.16 822.35C935.16 896.75 909.24 959.39 857.4 1010.27ZM579.48 910.19C603 933.23 632.52 944.75 668.04 944.75C703.56 944.75 732.84 933.23 755.88 910.19C779.4 886.67 791.16 857.39 791.16 822.35C791.16 787.31 779.4 758.27 755.88 735.23C732.84 711.71 703.56 699.95 668.04 699.95C632.52 699.95 603 711.71 579.48 735.23C556.44 758.27 544.92 787.31 544.92 822.35C544.92 857.39 556.44 886.67 579.48 910.19Z" fill={color}/>
      <path d="M210.401 570.35C262.721 570.35 306.401 586.91 341.441 620.03C376.481 652.67 394.001 696.35 394.001 751.07C394.001 805.79 376.481 849.71 341.441 882.83C306.401 915.47 262.721 931.79 210.401 931.79H152.801V1074.35H8.80078V570.35H210.401ZM210.401 792.11C221.441 792.11 230.801 788.51 238.481 781.31C246.161 773.63 250.001 763.55 250.001 751.07C250.001 738.59 246.161 728.75 238.481 721.55C230.801 713.87 221.441 710.03 210.401 710.03H152.801V792.11H210.401Z" fill={color}/>
      <rect x="800.832" y="13.0896" width="1351" height="475" rx="237.5" fill={color}/>
      <rect x="863.832" y="76.0896" width="933" height="349" rx="174.5" fill="white"/>
      <path d="M2039.12 306.817C2039.12 331.118 2031.62 350.636 2016.63 365.372C2001.63 379.849 1981.47 388.509 1956.13 391.353V425.09H1928.99V391.741C1906.24 390.19 1886.85 383.985 1870.82 373.127C1855.05 362.011 1843.94 347.146 1837.47 328.533L1897.58 294.796C1903.27 311.6 1913.74 321.941 1928.99 325.818V279.673L1925.5 278.51C1913.35 274.115 1903.27 269.849 1895.25 265.713C1887.24 261.577 1879.09 256.277 1870.82 249.814C1862.55 243.093 1856.34 235.078 1852.21 225.772C1848.33 216.207 1846.39 205.22 1846.39 192.811C1846.39 168.51 1854.15 149.121 1869.66 134.644C1885.17 119.908 1904.95 111.507 1928.99 109.438V76.0896H1956.13V110.214C1993.36 114.609 2019.73 133.61 2035.24 167.217L1976.3 200.178C1972.42 188.287 1965.7 180.531 1956.13 176.912V222.67H1956.52C1957.81 223.187 1961.43 224.608 1967.38 226.935C1973.58 229.262 1977.59 230.813 1979.4 231.588C1981.47 232.364 1985.22 234.044 1990.64 236.63C1996.07 238.956 1999.82 240.895 2001.89 242.446C2003.96 243.739 2007.19 245.936 2011.58 249.038C2015.98 251.882 2019.08 254.597 2020.89 257.182C2022.7 259.508 2025.03 262.611 2027.87 266.488C2030.97 270.108 2033.04 273.856 2034.08 277.734C2035.37 281.612 2036.53 286.136 2037.57 291.306C2038.6 296.218 2039.12 301.388 2039.12 306.817ZM1913.86 193.198C1913.86 199.661 1918.91 205.478 1928.99 210.648V175.361C1918.91 177.946 1913.86 183.892 1913.86 193.198ZM1956.13 325.431C1966.47 322.587 1971.64 316.77 1971.64 307.981C1971.64 301.001 1966.47 295.184 1956.13 290.531V325.431Z" fill={color}/>
    </svg>
  );
};

// ── CookieBanner ─────────────────────────────────────────────────────────────
function CookieBanner({onAccept}) {
  const mob = useIsMobile();
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics]     = useState(true);
  const [marketing, setMarketing]     = useState(false);

  const accept = (type) => {
    const prefs = type==="all"
      ? {essential:true,analytics:true,marketing:true,saved:true,date:new Date().toISOString()}
      : type==="custom"
      ? {essential:true,analytics,marketing,saved:true,date:new Date().toISOString()}
      : {essential:true,analytics:false,marketing:false,saved:true,date:new Date().toISOString()};
    onAccept(prefs);
  };

  const Toggle = ({checked,onChange,label,desc,locked}) => (
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14,padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:2,display:"flex",alignItems:"center",gap:6}}>
          {label}
          {locked&&<span style={{fontSize:9,fontWeight:700,color:C.green,background:C.greenLight,borderRadius:100,padding:"1px 7px"}}>ESSENCIAL</span>}
        </div>
        <div style={{fontSize:12,color:C.textMid,lineHeight:1.5}}>{desc}</div>
      </div>
      <div onClick={locked?null:()=>onChange(!checked)}
        style={{width:42,height:24,borderRadius:100,background:checked?C.coral:C.border,cursor:locked?"not-allowed":"pointer",flexShrink:0,position:"relative",transition:"background .2s",marginTop:2}}>
        <div style={{position:"absolute",top:3,left:checked?20:3,width:18,height:18,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,.2)",transition:"left .2s"}}/>
      </div>
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,zIndex:3000,display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",padding:mob?0:"24px",pointerEvents:"none"}}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.35)",backdropFilter:"blur(2px)",pointerEvents:"auto"}}/>
      <div style={{
        position:"relative",zIndex:1,
        width:"100%",maxWidth:mob?"100%":520,
        background:"#fff",
        borderRadius:mob?"24px 24px 0 0":22,
        boxShadow:"0 -4px 40px rgba(0,0,0,.18)",
        overflow:"hidden",
        animation:"fadeUp .35s ease both",
        pointerEvents:"auto",
        maxHeight:mob?"92vh":"80vh",
        display:"flex",flexDirection:"column",
      }}>
        {/* Header */}
        <div style={{padding:mob?"22px 22px 0":"26px 28px 0",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <div style={{width:40,height:40,borderRadius:12,background:"#FFF5F7",border:`1.5px solid ${C.coralMid}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🍪</div>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:C.text}}>Usamos cookies</div>
              <div style={{fontSize:12,color:C.textMid,marginTop:1}}>Para melhorar sua experiência no Se Poupe</div>
            </div>
          </div>
          <p style={{fontSize:13,color:C.textMid,lineHeight:1.7,marginBottom:showDetails?16:0}}>
            Utilizamos cookies essenciais para o funcionamento do app e, com sua autorização, cookies analíticos para entender como você usa o Se Poupe e melhorar nossos serviços.{" "}
            <button onClick={()=>setShowDetails(s=>!s)} style={{background:"none",border:"none",color:C.coral,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13,padding:0}}>
              {showDetails?"Ocultar detalhes ↑":"Ver detalhes ↓"}
            </button>
          </p>
        </div>

        {/* Details panel */}
        {showDetails&&(
          <div style={{padding:"0 22px 4px",overflowY:"auto",flex:1}}>
            <div style={{paddingBottom:4}}>
              <Toggle locked checked label="Cookies essenciais" desc="Necessários para login, sessão e funcionamento básico do app. Não podem ser desativados." onChange={()=>{}}/>
              <Toggle checked={analytics} onChange={setAnalytics} label="Cookies analíticos" desc="Nos ajudam a entender quais funcionalidades são mais usadas e onde podemos melhorar."/>
              <Toggle checked={marketing} onChange={setMarketing} label="Cookies de marketing" desc="Usados para personalizar comunicações e ofertas com base no seu perfil de uso."/>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{padding:mob?"16px 22px 28px":"18px 28px 24px",display:"flex",flexDirection:mob?"column":"row",gap:8,flexShrink:0}}>
          <button onClick={()=>accept("essential")}
            style={{flex:1,background:"none",border:`1.5px solid ${C.border}`,color:C.textMid,borderRadius:10,padding:"11px 12px",fontWeight:600,fontSize:13,fontFamily:"inherit",cursor:"pointer",transition:"all .15s"}}
            onMouseOver={e=>{e.currentTarget.style.borderColor="#717171";e.currentTarget.style.color=C.text;}}
            onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textMid;}}>
            Só essenciais
          </button>
          {showDetails&&(
            <button onClick={()=>accept("custom")}
              style={{flex:1,background:C.bgSoft,border:`1.5px solid ${C.border}`,color:C.text,borderRadius:10,padding:"11px 12px",fontWeight:600,fontSize:13,fontFamily:"inherit",cursor:"pointer"}}>
              Salvar preferências
            </button>
          )}
          <button onClick={()=>accept("all")}
            style={{flex:showDetails?1:2,background:C.coral,color:"#fff",border:"none",borderRadius:10,padding:"11px 12px",fontWeight:700,fontSize:13,fontFamily:"inherit",cursor:"pointer",boxShadow:"0 3px 12px rgba(252,23,87,.28)",transition:"background .15s"}}
            onMouseOver={e=>{e.currentTarget.style.background="#E01050";}}
            onMouseOut={e=>{e.currentTarget.style.background=C.coral;}}>
            Aceitar todos ✓
          </button>
        </div>

        {/* Footer note */}
        <div style={{padding:"0 22px 16px",flexShrink:0}}>
          <p style={{fontSize:11,color:C.textLight,textAlign:"center",lineHeight:1.5}}>
            Ao continuar, você concorda com nossa{" "}
            <button style={{background:"none",border:"none",color:C.coral,cursor:"pointer",fontFamily:"inherit",fontSize:11,padding:0,fontWeight:600}}>Política de Privacidade</button>
            {" "}e{" "}
            <button style={{background:"none",border:"none",color:C.coral,cursor:"pointer",fontFamily:"inherit",fontSize:11,padding:0,fontWeight:600}}>Termos de Uso</button>.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── ProBadge ─────────────────────────────────────────────────────────────────
const ProBadge = ({small=false}) => (
  <span style={{background:PLAN_PRO_GRAD,color:"#fff",borderRadius:100,padding:small?"2px 8px":"3px 11px",fontSize:small?9:11,fontWeight:800,letterSpacing:".05em",display:"inline-flex",alignItems:"center",gap:4}}>
    {!small && <span style={{fontSize:9}}>✦</span>}PRO
  </span>
);
const FreeBadge = () => (
  <span style={{background:C.bgSoft,color:C.textMid,border:`1px solid ${C.border}`,borderRadius:100,padding:"2px 9px",fontSize:10,fontWeight:700,letterSpacing:".04em"}}>FREE</span>
);

// ── LimitBar ─────────────────────────────────────────────────────────────────
const LimitBar = ({used,max,label,color=C.coral}) => {
  const pct = max===Infinity ? 0 : Math.min((used/max)*100,100);
  const full = used>=max;
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:12,color:C.textMid,fontWeight:500}}>{label}</span>
        <span style={{fontSize:12,fontWeight:700,color:full?C.coral:C.text}}>{max===Infinity?"∞":`${used}/${max}`}</span>
      </div>
      {max!==Infinity&&<div style={{background:C.bgSoft,borderRadius:100,height:4}}>
        <div style={{width:`${pct}%`,height:"100%",background:full?C.coral:color,borderRadius:100,transition:"width .6s ease"}}/>
      </div>}
    </div>
  );
};

// ── PaywallBanner ─────────────────────────────────────────────────────────────
const PaywallBanner = ({msg,onUpgrade}) => (
  <div style={{background:"linear-gradient(135deg,#F5F0FF,#EDE0FF)",border:"1.5px solid #C4B5FD",borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
    <div style={{width:36,height:36,borderRadius:10,background:PLAN_PRO_GRAD,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>✦</div>
    <div style={{flex:1}}>
      <div style={{fontWeight:700,fontSize:13,color:"#4C1D95",marginBottom:2}}>{msg}</div>
      <div style={{fontSize:12,color:"#6D28D9"}}>Faça upgrade para o PRO e desbloqueie tudo.</div>
    </div>
    <button onClick={onUpgrade} style={{background:PLAN_PRO_GRAD,color:"#fff",border:"none",borderRadius:9,padding:"8px 16px",fontWeight:700,fontSize:12,fontFamily:"inherit",cursor:"pointer",flexShrink:0,whiteSpace:"nowrap"}}>
      Upgrade ✦
    </button>
  </div>
);

// ── PaywallLock ───────────────────────────────────────────────────────────────
const PaywallLock = ({title,desc,onUpgrade}) => (
  <div style={{position:"relative",borderRadius:16,overflow:"hidden"}}>
    <div style={{filter:"blur(4px)",pointerEvents:"none",userSelect:"none",background:C.bgSoft,height:120,borderRadius:16}}/>
    <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,background:"rgba(255,255,255,.7)",backdropFilter:"blur(1px)"}}>
      <div style={{width:40,height:40,borderRadius:12,background:PLAN_PRO_GRAD,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>🔒</div>
      <div style={{fontWeight:800,fontSize:14,color:"#4C1D95"}}>{title}</div>
      {desc&&<div style={{fontSize:12,color:"#6D28D9",textAlign:"center",maxWidth:240}}>{desc}</div>}
      <button onClick={onUpgrade} style={{background:PLAN_PRO_GRAD,color:"#fff",border:"none",borderRadius:9,padding:"9px 20px",fontWeight:700,fontSize:13,fontFamily:"inherit",cursor:"pointer",marginTop:4}}>
        ✦ Fazer Upgrade PRO
      </button>
    </div>
  </div>
);

// ── UpgradeModal ──────────────────────────────────────────────────────────────
function UpgradeModal({user, currentPlan, onClose, onSuccess}) {
  const mob = useIsMobile();
  const [step, setStep]         = useState("plans"); // plans | payment | success
  const [billing, setBilling]   = useState("monthly"); // monthly | annual | lifetime
  const [cardNum, setCardNum]   = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry]     = useState("");
  const [cvv, setCvv]           = useState("");
  const [processing, setProcessing] = useState(false);
  const [cardFocus, setCardFocus] = useState(null);

  const annualTotal   = (29.90*12*0.7).toFixed(2).replace(".",",");
  const annualMonthly = ((29.90*12*0.7)/12).toFixed(2).replace(".",",");
  const annualSaving  = Math.round(29.90*12*0.3);
  const priceM = billing==="annual" ? annualMonthly : billing==="lifetime" ? "199,90" : "29,90";
  const price  = billing==="annual" ? annualTotal   : "199,90";
  const saving = billing==="annual" ? annualSaving  : 0;

  const fmtCard = v => v.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim();
  const fmtExpiry = v => { const d=v.replace(/\D/g,"").slice(0,4); return d.length>2?d.slice(0,2)+"/"+d.slice(2):d; };

  const handlePay = async () => {
    if(!cardNum||!cardName||!expiry||!cvv) return;
    setProcessing(true);
    await new Promise(r=>setTimeout(r,2200));
    setProcessing(false);
    setStep("success");
    setTimeout(()=>onSuccess(), 2000);
  };

  const PRO_FEATS = [
    {icon:"💸",text:"Despesas e objetivos ilimitados"},
    {icon:"✦",text:"Análises e importações IA ilimitadas"},
    {icon:"📊",text:"Relatório mensal automático"},
    {icon:"🔔",text:"Alertas inteligentes de gastos"},
    {icon:"📁",text:"Exportação CSV e PDF"},
    {icon:"📅",text:"Comparativo mês a mês"},
  ];

  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?"0":"24px"}} onClick={step!=="success"?onClose:undefined}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.55)",backdropFilter:"blur(6px)"}}/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:mob?"100%":step==="plans"?860:520,height:mob?"100%":"auto",maxHeight:mob?"100%":"90vh",background:"#fff",borderRadius:mob?0:24,overflow:"hidden",display:"flex",flexDirection:"column",animation:"fadeUp .3s ease both"}} onClick={e=>e.stopPropagation()}>

        {/* ── PLANS STEP ── */}
        {step==="plans"&&(
          <>
            {/* Header */}
            <div style={{background:PLAN_PRO_GRAD,padding:mob?"28px 24px 24px":"36px 40px 32px",position:"relative",overflow:"hidden",flexShrink:0}}>
              <div style={{position:"absolute",top:-60,right:-60,width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,.07)"}}/>
              <div style={{position:"absolute",bottom:-40,left:-30,width:150,height:150,borderRadius:"50%",background:"rgba(255,255,255,.05)"}}/>
              <button onClick={onClose} style={{position:"absolute",top:16,right:16,background:"rgba(255,255,255,.15)",border:"none",color:"#fff",width:32,height:32,borderRadius:"50%",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit",zIndex:1}}>✕</button>
              <div style={{position:"relative",zIndex:1}}>
                <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,.15)",borderRadius:100,padding:"5px 14px",marginBottom:14}}>
                  <span style={{fontSize:13}}>✦</span>
                  <span style={{fontSize:12,fontWeight:700,color:"#fff",letterSpacing:".04em"}}>Se Poupe PRO</span>
                </div>
                <div style={{fontSize:mob?22:28,fontWeight:800,color:"#fff",lineHeight:1.2,marginBottom:8}}>Desbloqueie tudo. Sem limites.</div>
                <div style={{fontSize:14,color:"rgba(255,255,255,.8)"}}>Tudo que você precisa para dominar suas finanças.</div>
              </div>
            </div>

            <div style={{flex:1,overflowY:"auto",padding:mob?"20px 20px 24px":"28px 40px 32px"}}>
              {/* Billing toggle */}
              <div style={{display:"flex",justifyContent:"center",marginBottom:28}}>
                <div style={{display:"inline-flex",background:C.bgSoft,borderRadius:100,padding:3,gap:2}}>
                  {[["monthly","Mensal",null],["annual","Anual","-30%"],["lifetime","Vitalício","🔥"]].map(([k,l,badge])=>(
                    <button key={k} onClick={()=>setBilling(k)}
                      style={{padding:"8px 18px",borderRadius:100,border:"none",background:billing===k?"#fff":"transparent",fontFamily:"inherit",fontSize:13,fontWeight:billing===k?700:500,color:billing===k?C.text:C.textMid,cursor:"pointer",boxShadow:billing===k?C.shadow:"none",transition:"all .2s",position:"relative",whiteSpace:"nowrap"}}>
                      {l}
                      {badge&&<span style={{position:"absolute",top:-8,right:-4,background:k==="annual"?"#008A05":"#FC1757",color:"#fff",fontSize:8,fontWeight:800,borderRadius:100,padding:"1px 6px",letterSpacing:".03em"}}>{badge}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Plans side by side */}
              <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:16,marginBottom:24}}>
                {/* Free */}
                <div style={{border:`1.5px solid ${C.border}`,borderRadius:18,padding:"22px 24px",opacity:.7}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                    <div>
                      <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>Gratuito</div>
                      <div style={{fontSize:28,fontWeight:800,letterSpacing:"-.02em"}}>R$ 0</div>
                    </div>
                    <FreeBadge/>
                  </div>
                  <div style={{fontSize:12,color:C.textMid,marginBottom:16}}>Para começar a organizar suas finanças</div>
                  {PLANS.free.features.map((f,i)=>(
                    <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:9}}>
                      <span style={{color:C.green,fontSize:13,flexShrink:0,marginTop:1}}>✓</span>
                      <span style={{fontSize:12,color:C.textMid}}>{f}</span>
                    </div>
                  ))}
                  <div style={{marginTop:16,padding:"10px 14px",background:C.bgSoft,borderRadius:10,fontSize:12,color:C.textMid,textAlign:"center",fontWeight:600}}>Plano atual</div>
                </div>

                {/* PRO */}
                <div style={{border:"2px solid #7C3AED",borderRadius:18,padding:"22px 24px",background:"linear-gradient(160deg,#FAFAFF,#F5F0FF)",position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:"rgba(124,58,237,.06)"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                    <div>
                      <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>PRO</div>
                      {billing!=="lifetime"
                        ? <div style={{display:"flex",alignItems:"flex-end",gap:6}}>
                            <div style={{fontSize:32,fontWeight:800,letterSpacing:"-.02em",color:"#4C1D95"}}>R$ {priceM}</div>
                            <div style={{fontSize:12,color:C.textMid,marginBottom:6}}>/mês</div>
                          </div>
                        : <div style={{display:"flex",alignItems:"baseline",gap:6,flexWrap:"wrap"}}>
                            <div style={{fontSize:32,fontWeight:800,letterSpacing:"-.02em",color:"#4C1D95"}}>10x R$ 19,99</div>
                          </div>
                      }
                      {billing==="annual"&&<div style={{fontSize:11,color:C.textLight}}>R$ {price} cobrado anualmente</div>}
                      {billing==="lifetime"&&<div style={{fontSize:11,color:"#7C3AED",fontWeight:600}}>sem juros · total R$ 199,90 · acesso para sempre</div>}
                    </div>
                    <ProBadge/>
                  </div>
                  {saving>0&&<div style={{display:"inline-flex",alignItems:"center",gap:5,background:"#D1FAE5",borderRadius:100,padding:"3px 10px",marginBottom:12,marginTop:4}}>
                    <span style={{fontSize:10,fontWeight:800,color:C.green}}>✦ Você economiza R$ {saving}/ano</span>
                  </div>}
                  {billing==="lifetime"&&<div style={{display:"inline-flex",alignItems:"center",gap:5,background:"#FFF0F3",borderRadius:100,padding:"3px 10px",marginBottom:12,marginTop:4}}>
                    <span style={{fontSize:10,fontWeight:800,color:C.coral}}>🔥 10x R$ 19,99 sem juros · use para sempre</span>
                  </div>}
                  <div style={{fontSize:12,color:"#6D28D9",marginBottom:16}}>Tudo do plano gratuito, mais:</div>
                  {PLANS.pro.features.map((f,i)=>(
                    <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:9}}>
                      <span style={{color:"#7C3AED",fontSize:13,flexShrink:0,marginTop:1}}>✦</span>
                      <span style={{fontSize:12,color:"#4C1D95",fontWeight:500}}>{f}</span>
                    </div>
                  ))}
                  <button onClick={()=>setStep("payment")}
                    style={{width:"100%",background:PLAN_PRO_GRAD,color:"#fff",border:"none",borderRadius:12,padding:"14px",fontWeight:800,fontSize:14,fontFamily:"inherit",cursor:"pointer",marginTop:16,boxShadow:"0 4px 16px rgba(124,58,237,.35)",transition:"transform .15s,box-shadow .15s"}}
                    onMouseOver={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 6px 22px rgba(124,58,237,.45)";}}
                    onMouseOut={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 4px 16px rgba(124,58,237,.35)";}}>
                    {billing==="lifetime" ? "✦ Comprar vitalício — 10x R$ 19,99 sem juros" : ("✦ Assinar PRO — R$ " + priceM + "/mês")}
                  </button>
                </div>
              </div>

              {/* Guarantee */}
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 18px",background:C.bgSoft,borderRadius:12}}>
                <span style={{fontSize:22}}>🛡️</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700}}>Garantia de 7 dias</div>
                  <div style={{fontSize:12,color:C.textMid}}>Não gostou? Cancele em até 7 dias e receba 100% de reembolso.</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── PAYMENT STEP ── */}
        {step==="payment"&&(
          <>
            <div style={{padding:mob?"20px 24px 16px":"28px 36px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:14,flexShrink:0}}>
              <button onClick={()=>setStep("plans")} style={{background:C.bgSoft,border:"none",borderRadius:8,width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.textMid,fontSize:16}}>←</button>
              <div>
                <div style={{fontWeight:800,fontSize:16}}>Finalizar assinatura PRO</div>
                <div style={{fontSize:12,color:C.textMid}}>Pagamento 100% seguro e criptografado</div>
              </div>
              <button onClick={onClose} style={{marginLeft:"auto",background:C.bgSoft,border:"none",color:C.textMid,width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>✕</button>
            </div>

            <div style={{flex:1,overflowY:"auto",padding:mob?"20px 24px 28px":"24px 36px 32px",display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:28,alignItems:"start"}}>
              {/* Order summary */}
              <div>
                <div style={{fontWeight:700,fontSize:14,marginBottom:14,color:C.textMid,letterSpacing:".03em",textTransform:"uppercase",fontSize:11}}>RESUMO DO PEDIDO</div>
                <div style={{background:"linear-gradient(135deg,#FAFAFF,#F5F0FF)",border:"1.5px solid #C4B5FD",borderRadius:16,padding:"20px 22px",marginBottom:16}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                    <div>
                      <div style={{fontWeight:800,fontSize:15}}>Se Poupe PRO</div>
                      <div style={{fontSize:12,color:"#6D28D9",marginTop:2}}>{billing==="annual"?"Plano Anual":billing==="lifetime"?"Acesso Vitalício":"Plano Mensal"}</div>
                    </div>
                    <ProBadge/>
                  </div>
                  {PRO_FEATS.map((f,i)=>(
                    <div key={i} style={{display:"flex",gap:9,alignItems:"center",padding:"7px 0",borderTop:i===0?`1px solid #C4B5FD20`:`1px solid #C4B5FD20`}}>
                      <span style={{fontSize:14}}>{f.icon}</span>
                      <span style={{fontSize:12,color:"#4C1D95",fontWeight:500}}>{f.text}</span>
                    </div>
                  ))}
                  <div style={{borderTop:"1.5px solid #C4B5FD",marginTop:14,paddingTop:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontWeight:700,fontSize:13}}>Total {billing==="annual"?"anual":billing==="lifetime"?"único":"mensal"}</span>
                    <span style={{fontWeight:800,fontSize:18,color:"#4C1D95"}}>R$ {billing==="lifetime"?"19,99/mês":billing==="annual"?price:priceM}{billing==="lifetime"?" × 10":""}</span>
                  </div>
                  {saving>0&&<div style={{fontSize:11,color:C.green,fontWeight:700,textAlign:"right",marginTop:4}}>✓ Economia de R$ {saving} no plano anual</div>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:C.bgSoft,borderRadius:10}}>
                  <span style={{fontSize:16}}>🔒</span>
                  <span style={{fontSize:11,color:C.textMid,lineHeight:1.5}}>Seus dados de pagamento são criptografados com SSL. Não armazenamos dados do cartão.</span>
                </div>
              </div>

              {/* Card form */}
              <div>
                <div style={{fontWeight:700,fontSize:11,marginBottom:14,color:C.textMid,letterSpacing:".03em",textTransform:"uppercase"}}>DADOS DO CARTÃO</div>

                {/* Card preview */}
                <div style={{background:PLAN_PRO_GRAD,borderRadius:16,padding:"22px 22px 18px",marginBottom:20,position:"relative",overflow:"hidden",minHeight:140}}>
                  <div style={{position:"absolute",top:-30,right:-30,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,.08)"}}/>
                  <div style={{position:"absolute",bottom:-20,left:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,.06)"}}/>
                  <div style={{position:"relative",zIndex:1}}>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.6)",letterSpacing:".12em",marginBottom:16}}>CARTÃO DE CRÉDITO</div>
                    <div style={{fontSize:18,letterSpacing:".2em",color:"#fff",fontWeight:700,marginBottom:20,fontFamily:"monospace"}}>
                      {cardNum?cardNum.replace(/./g,"•").replace(/•{4}/g,"•••• ").trim():"•••• •••• •••• ••••"}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                      <div>
                        <div style={{fontSize:9,color:"rgba(255,255,255,.5)",letterSpacing:".1em",marginBottom:2}}>TITULAR</div>
                        <div style={{fontSize:13,color:"#fff",fontWeight:600,letterSpacing:".05em"}}>{cardName||"SEU NOME"}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:9,color:"rgba(255,255,255,.5)",letterSpacing:".1em",marginBottom:2}}>VALIDADE</div>
                        <div style={{fontSize:13,color:"#fff",fontWeight:600}}>{expiry||"MM/AA"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inputs */}
                <div style={{marginBottom:12}}>
                  <label style={{display:"block",fontSize:12,fontWeight:600,color:C.text,marginBottom:5}}>Número do cartão</label>
                  <input value={cardNum} onChange={e=>setCardNum(fmtCard(e.target.value))} placeholder="0000 0000 0000 0000" maxLength={19}
                    style={{width:"100%",background:C.bgSoft,border:`1.5px solid ${cardFocus==="num"?"#7C3AED":C.border}`,borderRadius:11,padding:"11px 14px",fontSize:14,fontFamily:"monospace",color:C.text,outline:"none",boxSizing:"border-box"}}
                    onFocus={()=>setCardFocus("num")} onBlur={()=>setCardFocus(null)}/>
                </div>
                <div style={{marginBottom:12}}>
                  <label style={{display:"block",fontSize:12,fontWeight:600,color:C.text,marginBottom:5}}>Nome no cartão</label>
                  <input value={cardName} onChange={e=>setCardName(e.target.value.toUpperCase())} placeholder="COMO APARECE NO CARTÃO"
                    style={{width:"100%",background:C.bgSoft,border:`1.5px solid ${cardFocus==="name"?"#7C3AED":C.border}`,borderRadius:11,padding:"11px 14px",fontSize:14,fontFamily:"inherit",color:C.text,outline:"none",boxSizing:"border-box"}}
                    onFocus={()=>setCardFocus("name")} onBlur={()=>setCardFocus(null)}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                  <div>
                    <label style={{display:"block",fontSize:12,fontWeight:600,color:C.text,marginBottom:5}}>Validade</label>
                    <input value={expiry} onChange={e=>setExpiry(fmtExpiry(e.target.value))} placeholder="MM/AA" maxLength={5}
                      style={{width:"100%",background:C.bgSoft,border:`1.5px solid ${cardFocus==="exp"?"#7C3AED":C.border}`,borderRadius:11,padding:"11px 14px",fontSize:14,fontFamily:"monospace",color:C.text,outline:"none",boxSizing:"border-box"}}
                      onFocus={()=>setCardFocus("exp")} onBlur={()=>setCardFocus(null)}/>
                  </div>
                  <div>
                    <label style={{display:"block",fontSize:12,fontWeight:600,color:C.text,marginBottom:5}}>CVV</label>
                    <input value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="•••"
                      type="password"
                      style={{width:"100%",background:C.bgSoft,border:`1.5px solid ${cardFocus==="cvv"?"#7C3AED":C.border}`,borderRadius:11,padding:"11px 14px",fontSize:14,fontFamily:"monospace",color:C.text,outline:"none",boxSizing:"border-box"}}
                      onFocus={()=>setCardFocus("cvv")} onBlur={()=>setCardFocus(null)}/>
                  </div>
                </div>

                <button onClick={handlePay} disabled={processing||!cardNum||!cardName||!expiry||!cvv}
                  style={{width:"100%",background:processing||!cardNum||!cardName||!expiry||!cvv?"#C4B5FD":PLAN_PRO_GRAD,color:"#fff",border:"none",borderRadius:12,padding:"15px",fontWeight:800,fontSize:15,fontFamily:"inherit",cursor:processing?"not-allowed":"pointer",boxShadow:"0 4px 18px rgba(124,58,237,.35)",transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
                  {processing?<><span className="spinner" style={{fontSize:18}}>↻</span>Processando...</>:billing==="lifetime"?"🔒 Pagar 10x R$ 19,99 — Acesso Vitalício":"🔒 Pagar e Ativar PRO"}
                </button>
                <div style={{display:"flex",justifyContent:"center",gap:14,marginTop:14}}>
                  {["visa","master","amex","pix"].map(b=>(
                    <div key={b} style={{background:C.bgSoft,borderRadius:6,padding:"4px 8px",fontSize:10,fontWeight:700,color:C.textMid,letterSpacing:".04em"}}>{b.toUpperCase()}</div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── SUCCESS STEP ── */}
        {step==="success"&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:mob?"48px 32px":"60px 48px",textAlign:"center",minHeight:360}}>
            <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,#D1FAE5,#A7F3D0)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,marginBottom:20,boxShadow:"0 0 0 16px rgba(0,138,5,.06)"}}>✓</div>
            <div style={{fontSize:24,fontWeight:800,color:C.text,marginBottom:8}}>Seja bem-vindo ao PRO! ✦</div>
            <div style={{fontSize:14,color:C.textMid,lineHeight:1.7,maxWidth:320}}>Sua assinatura foi ativada com sucesso. Todos os recursos PRO já estão disponíveis na sua conta.</div>
            <div style={{marginTop:24,display:"flex",alignItems:"center",gap:8,background:"linear-gradient(135deg,#FAFAFF,#F5F0FF)",border:"1.5px solid #C4B5FD",borderRadius:12,padding:"12px 20px"}}>
              <span style={{fontSize:16}}>✦</span>
              <span style={{fontSize:13,fontWeight:700,color:"#4C1D95"}}>Se Poupe PRO ativado</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── FaqItem ───────────────────────────────────────────────────────────────────
function FaqItem({q,a,isLast}) {
  const [open,setOpen]=useState(false);
  return (
    <div style={{borderBottom:isLast?"none":`1px solid ${C.border}`}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"15px 0",background:"none",border:"none",fontFamily:"inherit",cursor:"pointer",gap:12,textAlign:"left"}}>
        <span style={{fontSize:14,fontWeight:600,color:C.text}}>{q}</span>
        <span className="faq-plus" style={{fontSize:20,color:C.textLight,transform:open?"rotate(45deg)":"none",flexShrink:0,lineHeight:1}}>+</span>
      </button>
      {open&&<div style={{fontSize:13,color:C.textMid,lineHeight:1.7,paddingBottom:14}}>{a}</div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// AUTH GATE
// ════════════════════════════════════════════════════════════════════════════
const DEMO_ACCOUNTS = {
  "demo@sepoupe.app": {
    name:"Ana Lima", password:"demo123",
    createdAt:"2024-10-01T00:00:00Z",
    phone:"(11) 98765-4321", city:"São Paulo, SP", birthdate:"1993-06-14",
    avatarEmoji:"👩",
  },
  "pro@sepoupe.app": {
    name:"Carlos PRO", password:"pro123",
    createdAt:"2024-08-15T00:00:00Z",
    phone:"(21) 91234-5678", city:"Rio de Janeiro, RJ", birthdate:"1988-03-22",
    avatarEmoji:"🧑‍💼",
  },
};
const DEMO_PLAN = { "pro@sepoupe.app": "pro" };

function AuthGate({onAuth}) {
  const mob = useIsMobile();
  const [mode,setMode]         = useState("login");
  const [name,setName]         = useState("");
  const [email,setEmail]       = useState("");
  const [password,setPassword] = useState("");
  const [confirm,setConfirm]   = useState("");
  const [errors,setErrors]     = useState({});
  const [loading,setLoading]   = useState(false);
  const [showPass,setShowPass] = useState(false);

  const validate = () => {
    const e={};
    if(mode==="signup"&&!name.trim()) e.name="Nome é obrigatório";
    if(!email.trim()) e.email="E-mail é obrigatório";
    else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email="E-mail inválido";
    if(!password) e.password="Senha é obrigatória";
    else if(password.length<6) e.password="Mínimo de 6 caracteres";
    if(mode==="signup"&&password!==confirm) e.confirm="As senhas não coincidem";
    return e;
  };
  const handleSubmit = async () => {
    const e=validate(); if(Object.keys(e).length){setErrors(e);return;}
    setErrors({}); setLoading(true);
    let accounts=await loadAccounts();
    // seed demo accounts if missing
    Object.entries(DEMO_ACCOUNTS).forEach(([em,acc])=>{ if(!accounts[em]) accounts[em]=acc; });
    await saveAccounts(accounts);
    // seed demo plans
    for(const [em,p] of Object.entries(DEMO_PLAN)){
      const existing=await loadPlan(em);
      if(!existing||existing==="free") await savePlan(em,p);
    }
    if(mode==="signup"){
      if(accounts[email]){setErrors({email:"E-mail já cadastrado"});setLoading(false);return;}
      accounts[email]={name:name.trim(),password};
      await saveAccounts(accounts);
      onAuth({name:name.trim(),email},true);
    } else {
      const acc=accounts[email];
      if(!acc||acc.password!==password){setErrors({password:"E-mail ou senha incorretos"});setLoading(false);return;}
      onAuth({name:acc.name,email},false);
    }
    setLoading(false);
  };
  const switchMode = () => {setMode(m=>m==="login"?"signup":"login");setErrors({});};

  return (
    <div style={{minHeight:"100vh",background:C.bgSoft,fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{BASE_CSS}</style>

      {/* Nav */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:`0 ${mob?16:32}px`,height:60,display:"flex",alignItems:"center"}}>
        <Logo height={mob?27:35}/>
      </div>

      <div style={{flex:1,display:"flex",alignItems:"stretch",overflow:"hidden"}}>
        {/* Left hero — desktop only */}
        {!mob && (
          <div style={{flex:"0 0 44%",background:"linear-gradient(145deg,#FC1757 0%,#C8003B 60%,#8B0029 100%)",padding:"52px 44px",display:"flex",flexDirection:"column",justifyContent:"space-between",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-80,right:-80,width:260,height:260,borderRadius:"50%",background:"rgba(255,255,255,.07)"}}/>
            <div style={{position:"absolute",bottom:-60,left:-60,width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,.05)"}}/>
            <div style={{position:"relative",zIndex:1}}>
              <h1 style={{fontSize:34,fontWeight:800,color:"#fff",lineHeight:1.2,letterSpacing:"-.02em",marginBottom:14}}>Tome o controle das suas finanças</h1>
              <p style={{fontSize:15,color:"rgba(255,255,255,.78)",lineHeight:1.75,maxWidth:320}}>Gerencie despesas, defina objetivos e receba análises personalizadas com IA.</p>
            </div>
            <div style={{position:"relative",zIndex:1,display:"flex",flexDirection:"column",gap:10}}>
              {[{icon:"✦",text:"Análise de gastos com IA"},{icon:"🎯",text:"Plano para seus objetivos"},{icon:"📊",text:"Dashboard em tempo real"},{icon:"📈",text:"Saiba como investir o que você poupa"}].map((f,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,.12)",borderRadius:12,padding:"11px 16px"}}>
                  <span style={{fontSize:15}}>{f.icon}</span>
                  <span style={{fontSize:13,fontWeight:600,color:"#fff"}}>{f.text}</span>
                </div>
              ))}
              {/* PRO callout */}
              <div style={{marginTop:8,background:"rgba(0,0,0,.18)",borderRadius:14,padding:"14px 18px",border:"1px solid rgba(255,255,255,.15)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:13}}>✦</span>
                  <span style={{fontSize:13,fontWeight:800,color:"#fff",letterSpacing:".01em"}}>Se Poupe PRO</span>
                  <span style={{background:"rgba(255,255,255,.2)",color:"#fff",fontSize:10,fontWeight:700,borderRadius:100,padding:"2px 8px"}}>a partir de R$ 29,90/mês</span>
                </div>
                <div style={{fontSize:12,color:"rgba(255,255,255,.75)",lineHeight:1.5}}>IA ilimitada · despesas ilimitadas</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.55)",marginTop:3}}>Ou acesso vitalício em 10x R$ 19,99 sem juros no cartão</div>
              </div>
            </div>
          </div>
        )}

        {/* Right form */}
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?"24px 20px":"36px 32px",overflowY:"auto"}}>
          <div className="fade-up" key={mode} style={{width:"100%",maxWidth:400}}>
            {/* Mobile logo */}
            {mob && (
              <div style={{textAlign:"center",marginBottom:28}}>
                <Logo height={38}/>
              </div>
            )}
            <div style={{marginBottom:28}}>
              <h2 style={{fontSize:mob?22:24,fontWeight:800,letterSpacing:"-.02em",color:C.text,marginBottom:5}}>
                {mode==="login"?"Bem-vindo!":"Criar sua conta"}
              </h2>
              <div style={{fontSize:14,color:C.textMid}}>
                {mode==="login"
                  ? <>Não tem conta? <button className="auth-link" onClick={switchMode}>Cadastre-se grátis</button></>
                  : <>Já tem conta? <button className="auth-link" onClick={switchMode}>Entrar</button></>}
              </div>
            </div>

            {mode==="signup"&&<FieldInput label="Nome completo" value={name} onChange={setName} placeholder="Seu nome" error={errors.name}/>}
            <FieldInput label="E-mail" value={email} onChange={setEmail} placeholder="seu@email.com" type="email" error={errors.email}/>
            <div style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <label style={{fontSize:13,fontWeight:600,color:C.text}}>Senha</label>
                <button className="show-pass" onClick={()=>setShowPass(s=>!s)}>{showPass?"Ocultar":"Mostrar"}</button>
              </div>
              <input type={showPass?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres"
                style={{width:"100%",background:errors.password?"#FFF5F6":C.bgSoft,border:`1.5px solid ${errors.password?C.coral:C.border}`,borderRadius:12,padding:"12px 14px",color:C.text,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}
                onFocus={e=>{e.target.style.borderColor=C.coral;e.target.style.boxShadow=`0 0 0 3px ${C.coralLight}`;}}
                onBlur={e=>{e.target.style.borderColor=errors.password?C.coral:C.border;e.target.style.boxShadow="none";}}
                onKeyDown={e=>e.key==="Enter"&&handleSubmit()}
              />
              {errors.password&&<div style={{fontSize:12,color:C.coral,marginTop:4,fontWeight:500}}>{errors.password}</div>}
            </div>
            {mode==="signup"&&<FieldInput label="Confirmar senha" value={confirm} onChange={setConfirm} placeholder="Repita a senha" type={showPass?"text":"password"} error={errors.confirm}/>}
            {mode==="login"&&<div style={{textAlign:"right",marginBottom:8}}><button className="auth-link" style={{fontSize:12}}>Esqueci minha senha</button></div>}

            <PrimaryBtn onClick={handleSubmit} disabled={loading} fullWidth size="lg">
              {loading?<><span className="spinner">↻</span>{mode==="login"?"Entrando...":"Criando conta..."}</>:mode==="login"?"Entrar":"Criar conta"}
            </PrimaryBtn>

            <div style={{display:"flex",alignItems:"center",gap:12,margin:"20px 0"}}>
              <div style={{flex:1,height:1,background:C.border}}/><span style={{fontSize:12,color:C.textLight,fontWeight:600,whiteSpace:"nowrap"}}>ou acesse uma demo</span><div style={{flex:1,height:1,background:C.border}}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button onClick={()=>{setEmail("demo@sepoupe.app");setPassword("demo123");}}
                style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3,padding:"12px 14px",background:C.bgSoft,border:`1.5px solid ${email==="demo@sepoupe.app"?C.coral:C.border}`,borderRadius:12,cursor:"pointer",fontFamily:"inherit",transition:"all .15s",textAlign:"left"}}
                onMouseOver={e=>{e.currentTarget.style.borderColor=C.coral;e.currentTarget.style.background=C.coralLight;}}
                onMouseOut={e=>{e.currentTarget.style.borderColor=email==="demo@sepoupe.app"?C.coral:C.border;e.currentTarget.style.background=email==="demo@sepoupe.app"?C.coralLight:C.bgSoft;}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:18}}>👩</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.text}}>Ana Lima</span>
                  <FreeBadge/>
                </div>
                <span style={{fontSize:11,color:C.textMid}}>demo@sepoupe.app</span>
              </button>
              <button onClick={()=>{setEmail("pro@sepoupe.app");setPassword("pro123");}}
                style={{display:"flex",flexDirection:"column",alignItems:"flex-start",gap:3,padding:"12px 14px",background:email==="pro@sepoupe.app"?"linear-gradient(135deg,#FAFAFF,#F0EAFF)":C.bgSoft,border:`1.5px solid ${email==="pro@sepoupe.app"?"#7C3AED":C.border}`,borderRadius:12,cursor:"pointer",fontFamily:"inherit",transition:"all .15s",textAlign:"left"}}
                onMouseOver={e=>{e.currentTarget.style.borderColor="#7C3AED";e.currentTarget.style.background="linear-gradient(135deg,#FAFAFF,#F0EAFF)";}}
                onMouseOut={e=>{e.currentTarget.style.borderColor=email==="pro@sepoupe.app"?"#7C3AED":C.border;e.currentTarget.style.background=email==="pro@sepoupe.app"?"linear-gradient(135deg,#FAFAFF,#F0EAFF)":C.bgSoft;}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:18}}>🧑‍💼</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.text}}>Carlos PRO</span>
                  <ProBadge small/>
                </div>
                <span style={{fontSize:11,color:C.textMid}}>pro@sepoupe.app</span>
              </button>
            </div>
            {mode==="signup"&&<div style={{fontSize:11,color:C.textLight,marginTop:16,textAlign:"center",lineHeight:1.6}}>
              Ao criar conta você concorda com os <button className="auth-link" style={{fontSize:11}}>Termos</button> e <button className="auth-link" style={{fontSize:11}}>Privacidade</button>.
            </div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ════════════════════════════════════════════════════════════════════════════
const ONBOARDING_STEPS = [
  {icon:"🧭",color:"#FC1757",bg:"linear-gradient(135deg,#FFF0F3,#FFE0E8)",badge:"Bem-vindo",title:"Seu copiloto financeiro pessoal",desc:"O Se Poupe é seu assistente inteligente para organizar, entender e crescer com o seu dinheiro. Simples e poderoso.",
    visual:<div style={{display:"flex",flexDirection:"column",gap:10,width:"100%",maxWidth:300}}>{[{icon:"📊",label:"Dashboard completo",sub:"Veja tudo de um relance"},{icon:"🤖",label:"IA integrada",sub:"Análises personalizadas"},{icon:"🎯",label:"Objetivos de vida",sub:"Planos para seus sonhos"}].map((f,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:12,background:"#fff",borderRadius:14,padding:"13px 16px",boxShadow:"0 2px 10px rgba(0,0,0,.06)"}}><span style={{fontSize:22}}>{f.icon}</span><div><div style={{fontWeight:700,fontSize:14}}>{f.label}</div><div style={{fontSize:12,color:"#717171",marginTop:1}}>{f.sub}</div></div></div>)}</div>},
  {icon:"📥",color:"#0066CC",bg:"linear-gradient(135deg,#EEF5FF,#DCEEFF)",badge:"Importação IA",title:"Cole qualquer lista e a IA faz o resto",desc:"Extrato, anotações, WhatsApp — a IA do Se Poupe entende qualquer formato e organiza automaticamente.",
    visual:<div style={{background:"#fff",borderRadius:16,padding:18,boxShadow:"0 2px 14px rgba(0,0,0,.08)",width:"100%",maxWidth:300}}><div style={{background:"#F7F7F7",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#444",lineHeight:1.8,fontFamily:"monospace",marginBottom:12}}>Aluguel 1500<br/>Netflix 55,90<br/>Mercado 287,50<br/>Uber 45,00</div>{[{e:"🏠",n:"Aluguel",c:"Moradia",v:"R$ 1.500"},{e:"📱",n:"Netflix",c:"Assinaturas",v:"R$ 55,90"},{e:"🍔",n:"Mercado",c:"Alimentação",v:"R$ 287,50"}].map((r,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid #F0F0F0"}}><span style={{fontSize:14}}>{r.e}</span><div style={{flex:1,fontSize:13,fontWeight:600}}>{r.n}</div><span style={{fontSize:10,background:"#EEF5FF",color:"#0066CC",borderRadius:5,padding:"2px 7px",fontWeight:600}}>{r.c}</span><span style={{fontSize:12,fontWeight:700}}>{r.v}</span></div>)}</div>},
  {icon:"📊",color:"#008A05",bg:"linear-gradient(135deg,#F0FFF2,#DCFADF)",badge:"Dashboard",title:"Visualize suas finanças em tempo real",desc:"Acompanhe saldo, despesas e taxa de reserva num painel limpo e intuitivo. Sempre atualizado.",
    visual:<div style={{width:"100%",maxWidth:300,display:"flex",flexDirection:"column",gap:8}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[{label:"Saldo livre",value:"R$ 2.340",color:"#008A05"},{label:"Despesas",value:"R$ 3.660",color:"#FC1757"},{label:"Reserva",value:"39%",color:"#0066CC"},{label:"Objetivos",value:"3 ativos",color:"#7C3AED"}].map((k,i)=><div key={i} style={{background:"#fff",borderRadius:12,padding:"12px 14px",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}><div style={{fontSize:10,color:"#B0B0B0",fontWeight:600,marginBottom:3}}>{k.label}</div><div style={{fontSize:18,fontWeight:800,color:k.color}}>{k.value}</div></div>)}</div></div>},
  {icon:"🎯",color:"#7C3AED",bg:"linear-gradient(135deg,#F5F0FF,#EDE0FF)",badge:"Objetivos",title:"Planeje seus sonhos com um plano real",desc:"Adicione seus objetivos — viagem, carro, casa — e a IA calcula quanto guardar por mês e em quanto tempo você chega lá.",
    visual:<div style={{display:"flex",flexDirection:"column",gap:8,width:"100%",maxWidth:300}}>{[{e:"✈️",name:"Viagem para Europa",mensal:"R$ 580/mês",prazo:"14 meses",ok:true},{e:"🏠",name:"Entrada do apê",mensal:"R$ 1.200/mês",prazo:"36 meses",ok:true},{e:"🚗",name:"Carro novo",mensal:"R$ 890/mês",prazo:"24 meses",ok:false}].map((g,i)=><div key={i} style={{background:"#fff",borderRadius:12,padding:"12px 14px",boxShadow:"0 2px 8px rgba(0,0,0,.06)",display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:20,flexShrink:0}}>{g.e}</span><div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,marginBottom:3}}>{g.name}</div><div style={{display:"flex",gap:6}}><span style={{fontSize:10,background:"#EDE0FF",color:"#7C3AED",borderRadius:5,padding:"2px 7px",fontWeight:700}}>{g.mensal}</span></div></div><div style={{width:7,height:7,borderRadius:"50%",background:g.ok?"#008A05":"#C47D03",flexShrink:0}}/></div>)}</div>},
  {icon:"✦",color:"#FC1757",bg:"linear-gradient(135deg,#FFF0F3,#FFE0E8)",badge:"Análise IA",title:"Diagnóstico financeiro personalizado",desc:"Um clique e o Se Poupe gera dicas de economia, sugestões de investimento e um plano completo para a sua realidade.",
    visual:<div style={{background:"#fff",borderRadius:16,padding:18,boxShadow:"0 2px 14px rgba(0,0,0,.08)",width:"100%",maxWidth:300}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}><div><div style={{fontSize:10,color:"#B0B0B0",fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",marginBottom:3}}>Score financeiro</div><div style={{fontSize:12,color:"#444",lineHeight:1.5}}>Saúde <strong style={{color:"#008A05"}}>boa</strong> — com potencial!</div></div><div style={{width:54,height:54,borderRadius:"50%",background:"#F0FFF2",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",border:"3px solid #008A05"}}><span style={{fontSize:18,fontWeight:800,color:"#008A05",lineHeight:1}}>74</span></div></div>{[{icon:"💡",label:"Economize no lazer",val:"–R$180/mês",c:"#008A05"},{icon:"📈",label:"Tesouro Direto",val:"20% do saldo",c:"#0066CC"},{icon:"🛡️",label:"Reserva emergência",val:"6x o salário",c:"#C47D03"}].map((t,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:"1px solid #F0F0F0"}}><span style={{fontSize:16}}>{t.icon}</span><div style={{flex:1,fontSize:12,fontWeight:600}}>{t.label}</div><span style={{fontSize:11,fontWeight:700,color:t.c}}>{t.val}</span></div>)}</div>},
];

function Onboarding({user,onFinish}) {
  const mob = useIsMobile();
  // tablet = viewport between 768-1024px (not mobile, not wide desktop)
  const [winW, setWinW] = useState(typeof window!=="undefined"?window.innerWidth:1200);
  useEffect(()=>{const fn=()=>setWinW(window.innerWidth);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);
  const isNarrow = winW < 1024; // mobile + tablet → centered single-column layout
  const [step,setStep] = useState(0);
  const cur = ONBOARDING_STEPS[step];
  const total = ONBOARDING_STEPS.length;
  const isLast = step===total-1;
  return (
    <div style={{minHeight:"100vh",background:C.bgSoft,fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif",display:"flex",flexDirection:"column"}}>
      <style>{BASE_CSS}</style>
      {/* Top bar */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,height:60,display:"flex",alignItems:"center",justifyContent:"space-between",padding:`0 ${mob?16:32}px`,flexShrink:0}}>
        <Logo height={mob?27:35}/>
        <button onClick={onFinish} style={{background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,color:C.textLight,fontWeight:600,padding:"8px 4px",minHeight:44}}>Pular →</button>
      </div>

      {/* Content */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?"16px 16px 0":"32px 24px",overflowY:"auto"}}>
        <div style={{width:"100%",maxWidth:isNarrow?480:880}}>
          <div key={step} className="step-content" style={{
            display:"grid",
            gridTemplateColumns:isNarrow?"1fr":"1fr 1fr",
            gap:isNarrow?20:48,
            alignItems:"center",
          }}>
            {/* Visual — top on narrow */}
            <div style={{
              order:isNarrow?1:2,
              background:cur.bg,
              borderRadius:20,
              padding:mob?16:24,
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              minHeight:mob?160:isNarrow?200:320,
            }}>
              {cur.visual}
            </div>

            {/* Text — bottom on narrow, centered */}
            <div style={{order:isNarrow?2:1,textAlign:isNarrow?"center":"left"}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:7,background:cur.color+"18",borderRadius:100,padding:"5px 14px",marginBottom:14}}>
                <span style={{fontSize:13}}>{cur.icon}</span>
                <span style={{fontSize:11,fontWeight:700,color:cur.color,letterSpacing:".03em"}}>{cur.badge}</span>
              </div>
              <h2 style={{fontSize:mob?20:isNarrow?24:30,fontWeight:800,color:C.text,lineHeight:1.25,letterSpacing:"-.02em",marginBottom:10}}>{cur.title}</h2>
              <p style={{fontSize:mob?13:14,color:C.textMid,lineHeight:1.75,marginBottom:24}}>{cur.desc}</p>

              {/* Step dots */}
              <div style={{display:"flex",gap:6,marginBottom:24,justifyContent:isNarrow?"center":"flex-start"}}>
                {ONBOARDING_STEPS.map((_,i)=>(
                  <div key={i} style={{height:5,borderRadius:100,background:i===step?cur.color:C.border,width:i===step?24:5,transition:"all .3s ease"}}/>
                ))}
              </div>

              {/* CTA */}
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <button
                  onClick={()=>isLast?onFinish():setStep(s=>s+1)}
                  style={{
                    width:"100%",
                    minHeight:52,          /* WCAG 2.5.5 — min 44px touch target */
                    background:cur.color,
                    color:"#fff",
                    border:"none",
                    borderRadius:14,
                    fontSize:16,
                    fontWeight:800,
                    fontFamily:"inherit",
                    cursor:"pointer",
                    display:"flex",
                    alignItems:"center",
                    justifyContent:"center",
                    gap:8,
                    boxShadow:`0 4px 18px ${cur.color}40`,
                    transition:"transform .15s,box-shadow .15s",
                    letterSpacing:"-.01em",
                  }}
                  onMouseOver={e=>{e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 7px 24px ${cur.color}55`;}}
                  onMouseOut={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow=`0 4px 18px ${cur.color}40`;}}>
                  {isLast?"🚀 Começar agora":"Continuar →"}
                </button>
                {step>0&&(
                  <button onClick={()=>setStep(s=>s-1)}
                    style={{width:"100%",minHeight:44,background:"transparent",border:`1px solid ${C.border}`,borderRadius:12,fontSize:14,fontWeight:600,fontFamily:"inherit",cursor:"pointer",color:C.textMid,transition:"background .15s"}}
                    onMouseOver={e=>e.currentTarget.style.background=C.bgSoft}
                    onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                    ← Voltar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer counter */}
      <div style={{padding:"14px",textAlign:"center",flexShrink:0}}>
        <span style={{fontSize:12,color:C.textLight,fontWeight:600}}>{step+1} de {total}</span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// PROFILE PAGE
// ════════════════════════════════════════════════════════════════════════════
function ProfilePage({user, plan, onClose, onLogout, onUpdateUser}) {
  const mob = useIsMobile();
  const [tab, setTab] = useState("info");

  const [name, setName]               = useState(user.name || "");
  const [phone, setPhone]             = useState(user.phone || "");
  const [city, setCity]               = useState(user.city || "");
  const [birthdate, setBirthdate]     = useState(user.birthdate || "");
  const [bio, setBio]                 = useState(user.bio || "");
  const [instagram, setInstagram]     = useState(user.instagram || "");
  const [linkedin, setLinkedin]       = useState(user.linkedin || "");
  const [profession, setProfession]   = useState(user.profession || "");
  const [avatar, setAvatar]           = useState(user.avatarEmoji || "🧑");
  const [photoUrl, setPhotoUrl]       = useState(user.photoUrl || null);
  const [docs, setDocs]               = useState(user.docs || []);
  const [dragOver, setDragOver]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [curPass, setCurPass]         = useState("");
  const [newPass, setNewPass]         = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passErr, setPassErr]         = useState("");
  const [passSaved, setPassSaved]     = useState(false);
  const [showCur, setShowCur]         = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const AVATAR_OPTS = ["🧑","👩","👨","🧑‍💼","👩‍💼","👨‍💼","🧑‍🎓","🧑‍🎨","🧑‍🔬","🧑‍💻","🦊","🐨","🦁","🐸","⭐","🚀","💎","🌊","🎯","🏆"];

  const PTABS = [
    {id:"info",     label:"Informações", icon:"👤"},
    {id:"photo",    label:"Foto",        icon:"📷"},
    {id:"docs",     label:"Documentos",  icon:"📁"},
    {id:"security", label:"Segurança",   icon:"🔒"},
  ];

  const passStrength = p => {
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };
  const ps = passStrength(newPass);
  const psColor = ["#ccc","#FC1757","#C47D03","#0066CC","#008A05"][ps];
  const psLabel = ["","Fraca","Razoável","Boa","Forte"][ps];

  const DOC_ICONS = {pdf:"📄",doc:"📝",docx:"📝",xls:"📊",xlsx:"📊",jpg:"🖼️",jpeg:"🖼️",png:"🖼️",gif:"🖼️",webp:"🖼️",zip:"🗜️"};
  const docIcon = fname => { const ext = fname.split(".").pop().toLowerCase(); return DOC_ICONS[ext] || "📎"; };
  const fmtSize = b => b < 1024 ? b+"B" : b < 1048576 ? (b/1024).toFixed(1)+"KB" : (b/1048576).toFixed(1)+"MB";

  const handlePhotoUpload = e => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = ev => setPhotoUrl(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleDocUpload = files => {
    const arr = Array.from(files);
    const newDocs = arr.map(f => ({
      id: Date.now() + Math.random(),
      name: f.name, size: f.size, type: f.type,
      uploadedAt: new Date().toLocaleDateString("pt-BR"),
      dataUrl: null,
    }));
    arr.forEach((file, i) => {
      if (file.size < 3 * 1024 * 1024) {
        const r = new FileReader();
        r.onload = ev => setDocs(prev => prev.map(d => d.id === newDocs[i].id ? {...d, dataUrl: ev.target.result} : d));
        r.readAsDataURL(file);
      }
    });
    setDocs(prev => [...prev, ...newDocs]);
  };

  const saveProfile = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const updated = {...user, name:name.trim(), phone, city, birthdate, bio, instagram, linkedin, profession, avatarEmoji:avatar, photoUrl, docs};
    const accounts = await loadAccounts();
    if (accounts[user.email]) accounts[user.email] = {...accounts[user.email], ...updated};
    await saveAccounts(accounts);
    await saveSession(updated);
    onUpdateUser?.(updated);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const savePassword = async () => {
    setPassErr("");
    if (!curPass || !newPass || !confirmPass) { setPassErr("Preencha todos os campos."); return; }
    if (newPass !== confirmPass) { setPassErr("As senhas não coincidem."); return; }
    if (newPass.length < 6) { setPassErr("Mínimo de 6 caracteres."); return; }
    const accounts = await loadAccounts();
    const acc = accounts[user.email];
    if (!acc || acc.password !== curPass) { setPassErr("Senha atual incorreta."); return; }
    accounts[user.email].password = newPass;
    await saveAccounts(accounts);
    setCurPass(""); setNewPass(""); setConfirmPass("");
    setPassSaved(true); setTimeout(() => setPassSaved(false), 2500);
  };

  const Field = ({label, value, onChange, placeholder, type="text", disabled=false, hint}) => (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:12,fontWeight:600,color:C.textMid,marginBottom:5}}>{label}</label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        style={{width:"100%",background:disabled?C.bgSoft:"#fff",border:`1.5px solid ${C.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,color:disabled?C.textMid:C.text,outline:"none",fontFamily:"inherit",boxSizing:"border-box",cursor:disabled?"not-allowed":"text"}}
        onFocus={e=>{if(!disabled)e.target.style.borderColor=C.coral;}} onBlur={e=>e.target.style.borderColor=C.border}/>
      {hint && <div style={{fontSize:11,color:C.textLight,marginTop:3}}>{hint}</div>}
    </div>
  );

  const EyeIcon = ({show}) => show
    ? <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1={1} y1={1} x2={23} y2={23}/></svg>
    : <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx={12} cy={12} r={3}/></svg>;

  return (
    <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",background:"rgba(0,0,0,.45)",backdropFilter:"blur(4px)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{width:"100%",maxWidth:660,maxHeight:mob?"92vh":"88vh",background:C.card,borderRadius:mob?"24px 24px 0 0":"20px",display:"flex",flexDirection:"column",boxShadow:"0 -8px 40px rgba(0,0,0,.2)",overflow:"hidden"}}
        onClick={e=>e.stopPropagation()}>

        {/* ── Header */}
        <div style={{padding:"20px 24px 0",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:48,height:48,borderRadius:"50%",overflow:"hidden",border:`2px solid ${C.coral}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:C.coralLight,fontSize:24}}>
                {photoUrl
                  ? <img src={photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : avatar}
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:C.text}}>{name||user.name}</div>
                <div style={{fontSize:11,color:C.textMid}}>{user.email}</div>
              </div>
            </div>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.textMid}}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/></svg>
            </button>
          </div>
          <div style={{display:"flex",gap:0,overflowX:"auto"}}>
            {PTABS.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{display:"flex",alignItems:"center",gap:5,padding:"9px 14px",background:"transparent",border:"none",borderBottom:`2px solid ${tab===t.id?C.coral:"transparent"}`,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:tab===t.id?700:500,color:tab===t.id?C.coral:C.textMid,whiteSpace:"nowrap",transition:"all .15s"}}>
                <span style={{fontSize:14}}>{t.icon}</span>{!mob&&t.label}
                {mob&&<span style={{fontSize:11}}>{t.label}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body */}
        <div style={{flex:1,overflowY:"auto",padding:"22px 24px"}}>

          {/* INFO */}
          {tab==="info" && <>
            <div style={{marginBottom:18}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:C.textMid,marginBottom:8}}>Avatar</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {AVATAR_OPTS.map(em=>(
                  <button key={em} onClick={()=>setAvatar(em)}
                    style={{width:38,height:38,borderRadius:9,border:`2px solid ${avatar===em?C.coral:C.border}`,background:avatar===em?C.coralLight:"transparent",fontSize:18,cursor:"pointer",transition:"all .12s",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:"0 16px"}}>
              <Field label="Nome completo" value={name} onChange={setName} placeholder="Seu nome"/>
              <Field label="E-mail" value={user.email} onChange={()=>{}} disabled hint="Não pode ser alterado"/>
              <Field label="Profissão" value={profession} onChange={setProfession} placeholder="Ex: Designer, Engenheiro..."/>
              <Field label="Cidade" value={city} onChange={setCity} placeholder="Ex: São Paulo, SP"/>
              <Field label="Telefone" value={phone} onChange={setPhone} placeholder="(11) 99999-9999" type="tel"/>
              <Field label="Data de nascimento" value={birthdate} onChange={setBirthdate} type="date"/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:C.textMid,marginBottom:5}}>Bio</label>
              <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="Conte um pouco sobre você..." rows={3}
                style={{width:"100%",background:"#fff",border:`1.5px solid ${C.border}`,borderRadius:10,padding:"10px 14px",fontSize:13,color:C.text,outline:"none",fontFamily:"inherit",boxSizing:"border-box",resize:"vertical",lineHeight:1.55}}
                onFocus={e=>e.target.style.borderColor=C.coral} onBlur={e=>e.target.style.borderColor=C.border}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:"0 16px"}}>
              <Field label="Instagram" value={instagram} onChange={setInstagram} placeholder="@seu.perfil"/>
              <Field label="LinkedIn" value={linkedin} onChange={setLinkedin} placeholder="linkedin.com/in/..."/>
            </div>
          </>}

          {/* PHOTO */}
          {tab==="photo" && <>
            <div style={{textAlign:"center",marginBottom:24}}>
              <div style={{position:"relative",display:"inline-block",marginBottom:14}}>
                <div style={{width:110,height:110,borderRadius:"50%",overflow:"hidden",border:`3px solid ${C.coral}`,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"center",background:C.coralLight,fontSize:48}}>
                  {photoUrl ? <img src={photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : avatar}
                </div>
                {photoUrl && (
                  <button onClick={()=>setPhotoUrl(null)}
                    style={{position:"absolute",top:2,right:2,width:26,height:26,borderRadius:"50%",background:"#fff",border:`1.5px solid ${C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 6px rgba(0,0,0,.15)"}}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={C.coral} strokeWidth={2.5} strokeLinecap="round"><line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/></svg>
                  </button>
                )}
              </div>
              <div style={{fontSize:14,fontWeight:700}}>{name||user.name}</div>
              <div style={{fontSize:12,color:C.textMid}}>{user.email}</div>
            </div>
            <label htmlFor="photo-up" style={{display:"block",cursor:"pointer"}}>
              <div style={{border:`2px dashed ${C.coral}`,borderRadius:16,padding:"30px 20px",textAlign:"center",background:C.coralLight,transition:"background .15s"}}
                onMouseOver={e=>e.currentTarget.style.background="#FFE0E8"}
                onMouseOut={e=>e.currentTarget.style.background=C.coralLight}>
                <div style={{fontSize:34,marginBottom:8}}>📷</div>
                <div style={{fontSize:14,fontWeight:700,color:C.coral,marginBottom:3}}>Clique para enviar sua foto</div>
                <div style={{fontSize:12,color:C.textMid}}>JPG, PNG ou WEBP · máx. 5 MB</div>
              </div>
              <input id="photo-up" type="file" accept="image/*" style={{display:"none"}} onChange={handlePhotoUpload}/>
            </label>
            {photoUrl && (
              <div style={{marginTop:14,padding:"12px 14px",background:C.bgSoft,borderRadius:12,display:"flex",alignItems:"center",gap:12}}>
                <img src={photoUrl} style={{width:38,height:38,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>Foto carregada ✓</div>
                  <div style={{fontSize:11,color:C.textMid}}>Salve para confirmar</div>
                </div>
                <button onClick={()=>setPhotoUrl(null)}
                  style={{width:26,height:26,borderRadius:6,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.textLight}}>
                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/></svg>
                </button>
              </div>
            )}
          </>}

          {/* DOCS */}
          {tab==="docs" && <>
            <label htmlFor="doc-up"
              onDragOver={e=>{e.preventDefault();setDragOver(true);}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);handleDocUpload(e.dataTransfer.files);}}>
              <div style={{border:`2px dashed ${dragOver?C.blue:C.border}`,borderRadius:16,padding:"26px 20px",textAlign:"center",background:dragOver?"#EEF5FF":C.bgSoft,cursor:"pointer",transition:"all .15s",marginBottom:18}}
                onMouseOver={e=>e.currentTarget.style.borderColor=C.blue}
                onMouseOut={e=>{if(!dragOver)e.currentTarget.style.borderColor=C.border;}}>
                <div style={{fontSize:30,marginBottom:8}}>📂</div>
                <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:3}}>Arraste ou clique para enviar</div>
                <div style={{fontSize:11,color:C.textMid}}>PDF, Word, Excel, imagens — qualquer formato</div>
              </div>
              <input id="doc-up" type="file" multiple style={{display:"none"}} onChange={e=>handleDocUpload(e.target.files)}/>
            </label>
            {docs.length===0
              ? <div style={{textAlign:"center",padding:"20px 0",color:C.textLight}}>
                  <div style={{fontSize:28,marginBottom:6}}>📭</div>
                  <div style={{fontSize:13}}>Nenhum documento ainda</div>
                </div>
              : <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {docs.map(doc=>(
                    <div key={doc.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:C.bgSoft,borderRadius:12,border:`1px solid ${C.border}`}}>
                      <div style={{width:38,height:38,borderRadius:9,background:"#fff",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                        {docIcon(doc.name)}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.name}</div>
                        <div style={{fontSize:11,color:C.textMid,marginTop:1}}>{fmtSize(doc.size)} · {doc.uploadedAt}</div>
                      </div>
                      <button onClick={()=>setDocs(prev=>prev.filter(d=>d.id!==doc.id))}
                        style={{width:28,height:28,borderRadius:7,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.textLight,transition:"all .15s"}}
                        onMouseOver={e=>{e.currentTarget.style.background="#FFF0F2";e.currentTarget.style.borderColor=C.coral;e.currentTarget.style.color=C.coral;}}
                        onMouseOut={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textLight;}}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
            }
          </>}

          {/* SECURITY */}
          {tab==="security" && <>
            <div style={{background:C.bgSoft,borderRadius:14,padding:18,marginBottom:20}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:14}}>Alterar senha</div>
              {[
                {label:"Senha atual",    val:curPass, set:setCurPass, show:showCur, toggle:()=>setShowCur(v=>!v)},
                {label:"Nova senha",     val:newPass,  set:setNewPass,  show:showNew, toggle:()=>setShowNew(v=>!v)},
                {label:"Confirmar nova", val:confirmPass, set:setConfirmPass, show:false, toggle:null},
              ].map((f,i)=>(
                <div key={i} style={{marginBottom:12}}>
                  <label style={{display:"block",fontSize:12,fontWeight:600,color:C.textMid,marginBottom:5}}>{f.label}</label>
                  <div style={{position:"relative"}}>
                    <input type={f.show?"text":"password"} value={f.val} onChange={e=>f.set(e.target.value)} placeholder="••••••••"
                      style={{width:"100%",background:"#fff",border:`1.5px solid ${i===2&&confirmPass&&confirmPass!==newPass?C.coral:C.border}`,borderRadius:10,padding:`10px ${f.toggle?"40px":"14px"} 10px 14px`,fontSize:13,color:C.text,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}
                      onFocus={e=>e.target.style.borderColor=C.coral} onBlur={e=>e.target.style.borderColor=C.border}/>
                    {f.toggle && (
                      <button onClick={f.toggle} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.textLight,padding:2}}>
                        <EyeIcon show={f.show}/>
                      </button>
                    )}
                  </div>
                  {i===1&&newPass&&(
                    <div style={{marginTop:5}}>
                      <div style={{display:"flex",gap:3,marginBottom:2}}>{[1,2,3,4].map(n=><div key={n} style={{flex:1,height:3,borderRadius:2,background:n<=ps?psColor:"#e5e7eb"}}/>)}</div>
                      <span style={{fontSize:11,color:psColor,fontWeight:600}}>{psLabel}</span>
                    </div>
                  )}
                </div>
              ))}
              {passErr && <div style={{fontSize:12,color:C.coral,fontWeight:500,marginBottom:10}}>{passErr}</div>}
              {passSaved && <div style={{fontSize:12,color:C.green,fontWeight:600,marginBottom:10}}>✓ Senha alterada!</div>}
              <button onClick={savePassword}
                style={{background:C.coral,color:"#fff",border:"none",borderRadius:9,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                Alterar senha
              </button>
            </div>

            <div style={{background:"#FFF5F5",border:"1px solid #FFCDD2",borderRadius:14,padding:18}}>
              <div style={{fontSize:13,fontWeight:700,color:"#B71C1C",marginBottom:5}}>Zona de perigo</div>
              <div style={{fontSize:12,color:"#C62828",marginBottom:12}}>Esta ação é irreversível. Todos os seus dados serão apagados permanentemente.</div>
              <input value={deleteConfirm} onChange={e=>setDeleteConfirm(e.target.value)} placeholder='Digite "EXCLUIR" para confirmar'
                style={{width:"100%",background:"#fff",border:"1.5px solid #FFCDD2",borderRadius:9,padding:"9px 12px",fontSize:13,color:C.text,outline:"none",fontFamily:"inherit",boxSizing:"border-box",marginBottom:10}}/>
              <button disabled={deleteConfirm!=="EXCLUIR"} onClick={onLogout}
                style={{background:deleteConfirm==="EXCLUIR"?"#C62828":"#ccc",color:"#fff",border:"none",borderRadius:9,padding:"9px 18px",fontSize:12,fontWeight:700,cursor:deleteConfirm==="EXCLUIR"?"pointer":"not-allowed",fontFamily:"inherit"}}>
                Excluir minha conta
              </button>
            </div>
          </>}

        </div>

        {/* ── Footer */}
        {tab !== "security" && (
          <div style={{padding:"14px 24px",borderTop:`1px solid ${C.border}`,flexShrink:0,background:C.card,display:"flex",alignItems:"center",gap:10}}>
            {saved && <span style={{fontSize:12,color:C.green,fontWeight:600,flex:1}}>✓ Salvo com sucesso!</span>}
            {!saved && <span style={{flex:1}}/>}
            <button onClick={onClose} style={{background:C.bgSoft,color:C.textMid,border:`1px solid ${C.border}`,borderRadius:9,padding:"9px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Cancelar
            </button>
            <button onClick={saveProfile} disabled={saving}
              style={{background:C.coral,color:"#fff",border:"none",borderRadius:9,padding:"9px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,boxShadow:"0 2px 8px rgba(252,23,87,.25)"}}>
              {saving ? <><span className="spinner">↻</span>Salvando...</> : "Salvar alterações"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function Dashboard({user,onLogout,isFirstVisit=false,plan="free",onPlanUpgrade}) {
  const mob = useIsMobile();
  const isPro = plan==="pro";
  const limits = PLANS[plan].limits;
  const [spotlightDone,setSpotlightDone] = useState(!isFirstVisit);
  const [salary,setSalary]               = useState("");
  const [salaryConfirmed,setSalaryConfirmed] = useState(false);
  const [salaryEditing,setSalaryEditing]     = useState(false);
  const [salaryDraft,setSalaryDraft]         = useState("");
  const [expenses,setExpenses]           = useState([]);
  // monthlyExpenses: { "2025-01": [{id,name,value,type,category}], ... }
  const [monthlyExpenses,setMonthlyExpenses] = useState({});
  const [planMonth,setPlanMonth]         = useState(() => new Date().toISOString().slice(0,7));
  const [planAddOpen,setPlanAddOpen]     = useState(false);
  const [planAddMonth,setPlanAddMonth]   = useState(() => new Date().toISOString().slice(0,7));
  const [planName,setPlanName]           = useState("");
  const [planValue,setPlanValue]         = useState("");
  const [planType,setPlanType]           = useState("fixa");
  const [planCategory,setPlanCategory]   = useState("Moradia");
  const [planEditId,setPlanEditId]       = useState(null);
  const [planEditVals,setPlanEditVals]   = useState({name:"",value:"",type:"fixa",category:"Outros"});
  const [newName,setNewName]             = useState("");
  const [newValue,setNewValue]           = useState("");
  const [newType,setNewType]             = useState("fixa");
  const [newCategory,setNewCategory]     = useState("Moradia");
  const [aiTips,setAiTips]               = useState(null);
  const [tipsLoading,setTipsLoading]     = useState(false);
  const [activeTab,setActiveTab]         = useState("overview");
  const [importText,setImportText]       = useState("");
  const [importLoading,setImportLoading] = useState(false);
  const [importPreview,setImportPreview] = useState(null);
  const [importError,setImportError]     = useState("");
  // ── Upload Extratos ──
  const [uploadFiles,setUploadFiles]         = useState([]);
  const [uploadLoading,setUploadLoading]     = useState(false);
  const [uploadResults,setUploadResults]     = useState(null);
  const [uploadSelected,setUploadSelected]   = useState({});
  const [uploadError,setUploadError]         = useState("");
  const [uploadDrag,setUploadDrag]           = useState(false);
  const [showExportMenu,setShowExportMenu]   = useState(false);
  const [exportLoading,setExportLoading]     = useState(false);
  const [fullReport,setFullReport]           = useState(null);
  const [fullReportOpen,setFullReportOpen]   = useState(false);
  // ── Banco / Open Banking state ─────────────────────────────────────────────
  const [bankConnections,setBankConnections] = useState([]);      // [{id,bank,agency,account,lastSync,status}]
  const [bankTxns,setBankTxns]               = useState([]);      // [{id,date,desc,amount,category,account}]
  const [bankConnecting,setBankConnecting]   = useState(false);   // step: null|"select"|"auth"|"syncing"|"done"
  const [bankStep,setBankStep]               = useState(null);
  const [bankSelected,setBankSelected]       = useState(null);
  const [bankDailyDate,setBankDailyDate]     = useState(new Date().toISOString().slice(0,10));
  const [bankImportSel,setBankImportSel]     = useState({});
  const [showUploadModal,setShowUploadModal] = useState(false);
  const [goals,setGoals]                 = useState([]);
  const [newGoalName,setNewGoalName]     = useState("");
  const [newGoalDesc,setNewGoalDesc]     = useState("");
  const [newGoalCost,setNewGoalCost]     = useState("");
  const [newGoalDeadline,setNewGoalDeadline] = useState("");
  const [showUserMenu,setShowUserMenu]   = useState(false);
  const [showUpgrade,setShowUpgrade]     = useState(false);
  const [showProfile,setShowProfile]     = useState(false);
  const [profileUser,setProfileUser]     = useState(user);
  const [usage,setUsage]                 = useState({month:"",aiImports:0,aiAnalysis:0});

  // Load usage on mount
  useEffect(()=>{
    loadUsage(user.email).then(u=>{
      const m=curMonth();
      if(u.month!==m) setUsage({month:m,aiImports:0,aiAnalysis:0});
      else setUsage(u);
    });
  },[user.email]);

  const bumpUsage = async (key) => {
    const u={...usage,[key]:(usage[key]||0)+1};
    setUsage(u); await saveUsage(user.email,u);
  };

  const totalExpenses = expenses.reduce((s,e)=>s+Number(e.value||0),0);
  const totalFixed    = expenses.filter(e=>e.type==="fixa").reduce((s,e)=>s+Number(e.value||0),0);
  const totalVariable = expenses.filter(e=>e.type==="variavel").reduce((s,e)=>s+Number(e.value||0),0);
  const balance       = Number(salary||0)-totalExpenses;
  const savingsRate   = salary?(balance/Number(salary))*100:0;

  // Plan modal helpers (needed at Dashboard level for the modal)
  const MONTHS_FULL_D = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const parsedPlanMonthD = planMonth ? planMonth.split("-") : [new Date().getFullYear().toString(), String(new Date().getMonth()+1).padStart(2,"0")];
  const planYearD = parseInt(parsedPlanMonthD[0]);
  const timelineMonthsD = Array.from({length:12},(_,i)=>{
    const d = new Date(planYearD, i, 1);
    return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
  });
  const addPlanExpenseD = () => {
    if(!planName||!planValue) return;
    const entry = {id:Date.now(),name:planName,value:planValue,type:planType,category:planCategory};
    setMonthlyExpenses(prev=>({...prev,[planAddMonth]:[...(prev[planAddMonth]||[]),entry]}));
    setPlanName(""); setPlanValue(""); setPlanAddOpen(false);
  };

  const addExpense = () => {
    if(!newName||!newValue) return;
    if(!isPro && expenses.length>=limits.expenses){ setShowUpgrade(true); return; }
    setExpenses([...expenses,{id:Date.now(),name:newName,value:newValue,type:newType,category:newCategory}]);
    setNewName(""); setNewValue("");
  };

  const parseExpensesWithAI = useCallback(async()=>{
    if(!importText.trim()) return;
    if(!isPro && usage.aiImports>=limits.aiImports){ setShowUpgrade(true); return; }
    setImportLoading(true); setImportPreview(null); setImportError("");
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,
          messages:[{role:"user",content:`Extraia despesas e retorne APENAS JSON válido sem markdown.
Categorias: Moradia,Transporte,Alimentação,Saúde,Educação,Lazer,Vestuário,Assinaturas,Seguros,Outros. Tipos: "fixa" ou "variavel".
Lista: """${importText}"""
Formato: {"despesas":[{"name":"string","value":123.45,"type":"fixa","category":"Moradia"}],"nao_reconhecidos":["item"]}
Regras: value=número sem R$. Vírgula decimal: 1.500,00→1500.00.`}]})});
      const d=await res.json();
      setImportPreview(JSON.parse((d.content||[]).map(c=>c.text||"").join("").replace(/```json|```/g,"").trim()));
      await bumpUsage("aiImports");
    } catch(err){setImportError("Erro ao conectar com a IA. Verifique sua conexão e tente novamente.");console.error(err);}
    setImportLoading(false);
  },[importText,isPro,usage,limits]);

  const confirmImport = () => {
    if(!importPreview?.despesas) return;
    const available = isPro ? Infinity : Math.max(0, limits.expenses - expenses.length);
    const toAdd = importPreview.despesas.slice(0, available === Infinity ? undefined : available);
    const skipped = importPreview.despesas.length - toAdd.length;
    setExpenses(p=>[...p,...toAdd.map(d=>({id:Date.now()+Math.random(),name:d.name,value:String(d.value),type:d.type,category:d.category}))]);
    setImportText(""); setImportPreview(null); setImportError("");
    if(skipped>0){ setImportError(`${skipped} despesa(s) não adicionada(s): limite de ${limits.expenses} atingido. Faça upgrade para PRO.`); setShowUpgrade(true); }
  };

  // ── Upload + parse files with AI ────────────────────────────────────────
  const readFileAsBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const parseUploadWithAI = useCallback(async () => {
    if (!uploadFiles.length) return;
    if (!isPro && usage.aiImports >= limits.aiImports) { setShowUpgrade(true); return; }
    setUploadLoading(true); setUploadResults(null); setUploadError(""); setUploadSelected({});
    try {
      const contentParts = [];
      for (const f of uploadFiles) {
        const b64 = await readFileAsBase64(f);
        const isPDF = f.type === "application/pdf";
        if (isPDF) {
          contentParts.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } });
        } else {
          contentParts.push({ type: "image", source: { type: "base64", media_type: f.type, data: b64 } });
        }
      }
      contentParts.push({
        type: "text",
        text: `Você é um assistente financeiro brasileiro. Analise este(s) extrato(s)/recibo(s)/nota(s) fiscal(is) e extraia TODOS os gastos. Retorne APENAS JSON válido sem markdown.
Categorias disponíveis: Moradia,Transporte,Alimentação,Saúde,Educação,Lazer,Vestuário,Assinaturas,Seguros,Outros
Tipos: "fixa" (recorrente) ou "variavel" (pontual)
Formato obrigatório: {"despesas":[{"name":"nome do item/estabelecimento","value":123.45,"type":"variavel","category":"Alimentação","data":"dd/mm/aaaa ou null"}],"resumo":"breve resumo do documento em 1 frase","total_identificado":123.45,"nao_reconhecidos":["itens que não conseguiu identificar"]}
Regras: value sempre número sem R$. Virgula decimal: 1.500,00→1500.00. Agrupe itens pequenos do mesmo estabelecimento. Se for extrato bancário, ignore transferências entre contas próprias e PIX recebidos. Inclua apenas saídas/gastos.`
      });
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, messages: [{ role: "user", content: contentParts }] })
      });
      const d = await res.json();
      const raw = (d.content || []).map(c => c.text || "").join("").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(raw);
      setUploadResults(parsed);
      const sel = {};
      (parsed.despesas || []).forEach((_, i) => { sel[i] = true; });
      setUploadSelected(sel);
      await bumpUsage("aiImports");
    } catch (err) {
      setUploadError("Erro ao processar o arquivo com IA. Verifique o formato e tente novamente.");
      console.error(err);
    }
    setUploadLoading(false);
  }, [uploadFiles, isPro, usage, limits]);

  const confirmUploadImport = () => {
    if (!uploadResults?.despesas) return;
    const selected = uploadResults.despesas.filter((_, i) => uploadSelected[i]);
    const available = isPro ? Infinity : Math.max(0, limits.expenses - expenses.length);
    const toAdd = selected.slice(0, available === Infinity ? undefined : available);
    const skipped = selected.length - toAdd.length;
    setExpenses(p => [...p, ...toAdd.map(d => ({ id: Date.now() + Math.random(), name: d.name, value: String(d.value), type: d.type, category: d.category }))]);
    setUploadFiles([]); setUploadResults(null); setUploadSelected({}); setUploadError("");
    if (skipped > 0) { setUploadError(`${skipped} despesa(s) não adicionada(s): limite atingido. Faça upgrade para PRO.`); setShowUpgrade(true); }
  };

  const getAiTips = useCallback(async()=>{
    if(!salary||!expenses.length) return;
    if(!isPro && usage.aiAnalysis>=limits.aiAnalysis){ setShowUpgrade(true); return; }
    setTipsLoading(true); setAiTips(null);
    try {
      const expList=expenses.map(e=>`- ${e.name} (${e.type},${e.category}): ${formatBRL(e.value)}`).join("\n");
      const goalList=goals.length?goals.map(g=>`- ${g.name}${g.desc?": "+g.desc:""}${g.cost?" | Custo: "+formatBRL(g.cost):""}${g.deadline?" | Prazo: "+g.deadline:""}`).join("\n"):"Nenhum objetivo.";
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,
          messages:[{role:"user",content:`Consultor financeiro brasileiro. Responda APENAS JSON válido sem markdown.
Salário: ${formatBRL(salary)} | Despesas: ${formatBRL(totalExpenses)} | Saldo: ${formatBRL(balance)} | Reserva: ${savingsRate.toFixed(1)}%
Despesas:\n${expList}\nObjetivos:\n${goalList}
Formato: {"diagnostico":"string","economias":[{"titulo":"","descricao":"","economia_estimada":""}],"investimentos":[{"tipo":"","descricao":"","percentual_sugerido":"","risco":"baixo"}],"meta_emergencia":"string","score":75,"plano_objetivos":[{"objetivo":"","custo_estimado":"","valor_mensal":"","prazo_meses":12,"estrategia":"","viavel":true}]}
3 economias, 3 investimentos. score 0-100. risco: baixo|medio|alto.`}]})});
      const d=await res.json();
      const parsed = JSON.parse((d.content||[]).map(c=>c.text||"").join("").replace(/```json|```/g,"").trim());
      setAiTips(parsed);
      await bumpUsage("aiAnalysis");
    } catch(err){setAiTips({error:"Não foi possível gerar a análise. Verifique sua conexão e tente novamente."});console.error(err);}
    setTipsLoading(false);
  },[salary,expenses,goals,totalExpenses,balance,savingsRate,isPro,usage,limits]);

  const addExpenseFromTxn = (txn) => {
    const newExp = {id:Date.now()+Math.random(),name:txn.desc,value:Math.abs(txn.amount),category:txn.category,date:txn.date,note:"Importado do banco"};
    setExpenses(prev=>[...prev,newExp]);
    setMonthlyExpenses(prev=>{const k=txn.date.slice(0,7);return{...prev,[k]:[...(prev[k]||[]),newExp]};});
  };

  const getFullReport = async (type) => {
    if(!isPro && usage.aiAnalysis>=limits.aiAnalysis){ setShowUpgrade(true); return; }
    setFullReport({type, content:[], loading:true});
    setFullReportOpen(true);
    try {
      const expList = expenses.map(e=>`- ${e.name} (${e.category}): ${formatBRL(e.value)}`).join("\n");
      const isEcon = type==="economias";
      const prompt = isEcon
        ? `Você é um consultor financeiro pessoal brasileiro especialista em economia doméstica. Faça um relatório COMPLETO e DETALHADO de como esta pessoa pode economizar mais dinheiro.

Perfil financeiro:
- Salário líquido: ${formatBRL(salary)}
- Total de despesas: ${formatBRL(totalExpenses)}
- Saldo mensal: ${formatBRL(balance)}
- Taxa de reserva: ${savingsRate.toFixed(1)}%
- Despesas:
${expList}

Pesquise e sugira alternativas reais e atuais disponíveis no Brasil. Inclua:
1. Análise crítica de cada categoria de gasto
2. Alternativas mais baratas (apps, serviços, produtos) com valores aproximados
3. Hábitos e estratégias práticas para cortar gastos
4. Potencial de economia mensal estimado por ação
5. Dicas de negociação com fornecedores e operadoras
6. Programas de cashback, descontos e benefícios gratuitos no Brasil

Responda APENAS com JSON válido sem markdown:
{"titulo":"Relatório Completo de Economia","resumo":"frase de impacto com potencial total de economia","potencial_total":"R$ X.XXX/mês","secoes":[{"titulo":"string","icone":"emoji","itens":[{"acao":"string","detalhe":"string detalhado com alternativas reais","economia_estimada":"R$ XX/mês","dificuldade":"fácil|médio|difícil","prioridade":"alta|média|baixa"}]}]}`
        : `Você é um consultor de investimentos brasileiro especialista em finanças pessoais. Faça um relatório COMPLETO e DETALHADO de como esta pessoa pode investir melhor seu dinheiro disponível.

Perfil financeiro:
- Salário líquido: ${formatBRL(salary)}
- Total de despesas: ${formatBRL(totalExpenses)}
- Saldo mensal disponível para investir: ${formatBRL(balance)}
- Taxa de reserva: ${savingsRate.toFixed(1)}%

Pesquise e recomende investimentos reais disponíveis no Brasil atualmente. Inclua:
1. Estratégia de reserva de emergência (quanto, onde guardar)
2. Opções de renda fixa (Tesouro Direto, CDB, LCI, LCA) com rentabilidades atuais
3. Opções de renda variável para o perfil identificado
4. Fundos de investimento recomendados
5. Corretoras recomendadas no Brasil (gratuitas ou de baixo custo)
6. Plano de aportes mensais sugerido com percentuais
7. Como diversificar conforme o patrimônio cresce

Responda APENAS com JSON válido sem markdown:
{"titulo":"Relatório Completo de Investimentos","resumo":"frase com estratégia geral sugerida","valor_para_investir":"${formatBRL(balance)}/mês","secoes":[{"titulo":"string","icone":"emoji","itens":[{"produto":"string","descricao":"string detalhado com informações reais e atuais","rentabilidade_estimada":"string","risco":"baixo|médio|alto","como_comecar":"string com passo a passo","aporte_sugerido":"R$ XX/mês"}]}]}`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json","anthropic-dangerous-direct-browser-access":"true"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:4000,
          tools:[{"type":"web_search_20250305","name":"web_search"}],
          messages:[{role:"user",content:prompt}]
        })
      });
      const d = await res.json();
      const text = (d.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("").replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(text);
      setFullReport({type, loading:false, ...parsed});
      await bumpUsage("aiAnalysis");
    } catch(err) {
      setFullReport({type, loading:false, error:"Não foi possível gerar o relatório. Tente novamente."});
      console.error(err);
    }
  };

  const pieData=[{label:"Saldo livre",value:Math.max(balance,0),color:C.green},{label:"Fixas",value:totalFixed,color:C.blue},{label:"Variáveis",value:totalVariable,color:C.amber}];
  const catTotals=CATEGORIES.map(cat=>({label:cat,value:expenses.filter(e=>e.category===cat).reduce((s,e)=>s+Number(e.value||0),0),color:CAT_COLORS[cat]})).filter(c=>c.value>0);
  const riskColor={baixo:C.green,medio:C.amber,alto:C.coral};
  const riskBg={baixo:C.greenLight,medio:C.amberLight,alto:C.coralLight};

  const TABS=[
    {id:"overview",icon:<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x={3} y={3} width={7} height={7}/><rect x={14} y={3} width={7} height={7}/><rect x={3} y={14} width={7} height={7}/><rect x={14} y={14} width={7} height={7}/></svg>,label:"Início"},
    {id:"expenses",icon:<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,label:"Despesas"},
    {id:"goals",icon:<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx={12} cy={12} r={10}/><circle cx={12} cy={12} r={6}/><circle cx={12} cy={12} r={2}/></svg>,label:"Objetivos"},
    {id:"planning",icon:<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x={3} y={4} width={18} height={18} rx={2}/><line x1={16} y1={2} x2={16} y2={6}/><line x1={8} y1={2} x2={8} y2={6}/><line x1={3} y1={10} x2={21} y2={10}/><line x1={8} y1={14} x2={8} y2={14}/><line x1={12} y1={14} x2={12} y2={14}/><line x1={16} y1={14} x2={16} y2={14}/><line x1={8} y1={18} x2={8} y2={18}/><line x1={12} y1={18} x2={12} y2={18}/></svg>,label:"Planejamento"},
    {id:"ai",icon:<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 2a7 7 0 0 1 7 7c0 3-1.5 5-4 6.5V17a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.5C6.5 14 5 12 5 9a7 7 0 0 1 7-7z"/><path d="M9 21h6"/></svg>,label:"Análise"},
    {id:"banco",icon:<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x={2} y={5} width={20} height={14} rx={2}/><line x1={2} y1={10} x2={22} y2={10}/></svg>,label:"Banco"},
    {id:"help",icon:<svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx={12} cy={12} r={10}/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1={12} y1={17} x2={12.01} y2={17}/></svg>,label:"Dúvidas",hideNav:true},
  ];

  const pad = mob ? "16px" : "24px";
  const mainPad = mob ? "16px 16px 90px" : "28px 24px 56px";

  return (
    <div style={{minHeight:"100vh",background:C.bgSoft,fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif",color:C.text}} onClick={()=>{showUserMenu&&setShowUserMenu(false);showExportMenu&&setShowExportMenu(false);}}>
      <style>{BASE_CSS}</style>

      {/* ── Top Nav ───────────────────────────────────────────────── */}
      <nav style={{background:C.card,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 0 rgba(0,0,0,.05)"}}>
        <div style={{maxWidth:1160,margin:"0 auto",padding:`0 ${pad}`,display:"flex",alignItems:"center",height:60}}>
          <div style={{marginRight:mob?0:44,flex:mob?1:"none",display:"flex",alignItems:"center"}}>
            <Logo height={mob?27:35}/>
          </div>

          {/* Desktop tabs */}
          {!mob && (
            <div style={{display:"flex",gap:2,flex:1}}>
              {TABS.filter(t=>!t.hideNav).map(t=>(
                <button key={t.id} className="tab-item" onClick={()=>setActiveTab(t.id)}
                  style={{padding:"8px 14px",borderRadius:8,fontWeight:activeTab===t.id?700:500,fontSize:13,color:activeTab===t.id?C.coral:C.textMid,position:"relative",display:"flex",alignItems:"center",gap:6}}>
                  {t.label}
                  {activeTab===t.id&&<div style={{position:"absolute",bottom:-18,left:0,right:0,height:2,background:C.coral,borderRadius:2}}/>}
                </button>
              ))}
            </div>
          )}

          {/* Upgrade button */}
          {!isPro&&(
            <button onClick={()=>setShowUpgrade(true)}
              style={{background:PLAN_PRO_GRAD,color:"#fff",border:"none",borderRadius:100,padding:mob?"6px 12px":"7px 16px",fontWeight:700,fontSize:mob?11:12,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",gap:5,marginRight:mob?8:12,flexShrink:0,boxShadow:"0 2px 10px rgba(124,58,237,.3)"}}>
              <span style={{fontSize:mob?10:11}}>✦</span>
              {mob?"PRO":"Upgrade PRO"}
            </button>
          )}
          {isPro&&!mob&&<ProBadge/>}
          {isPro&&!mob&&<div style={{width:1,height:20,background:C.border,margin:"0 8px"}}/>}

          {/* AI Analysis button — mobile only, shown next to avatar */}
          {mob&&(
            <button onClick={()=>setActiveTab("ai")}
              style={{display:"flex",alignItems:"center",gap:5,padding:"0 12px",height:36,borderRadius:100,border:`1.5px solid ${activeTab==="ai"?C.coral:C.border}`,background:activeTab==="ai"?C.coralLight:C.card,cursor:"pointer",marginRight:8,flexShrink:0,transition:"all .15s"}}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={activeTab==="ai"?C.coral:C.textMid} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/>
              </svg>
              <span style={{fontSize:11,fontWeight:700,color:activeTab==="ai"?C.coral:C.textMid,whiteSpace:"nowrap"}}>Análise IA</span>
            </button>
          )}

          {/* User menu */}
          <div style={{position:"relative",marginLeft:mob?0:8}} onClick={e=>e.stopPropagation()}>
            <button className="user-btn" onClick={()=>setShowUserMenu(s=>!s)} style={{background:"transparent",border:"none",cursor:"pointer",padding:0}}>
              <div className="user-pill" style={{display:"flex",alignItems:"center",gap:mob?6:10,padding:mob?"4px 8px 4px 4px":"5px 12px 5px 5px",borderRadius:100,border:`1px solid ${C.border}`,background:C.card}}>
                <Avatar name={profileUser.name} size={mob?28:32} emoji={profileUser.avatarEmoji} photoUrl={profileUser.photoUrl}/>
                {!mob&&<div style={{textAlign:"left"}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.text,lineHeight:1.2}}>{profileUser.name.split(" ")[0]}</div>
                  <div style={{fontSize:10,color:C.textLight,lineHeight:1.2}}>{user.email}</div>
                </div>}
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={C.textLight} strokeWidth={2.5} strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </button>
            {showUserMenu&&(
              <div className="slide-down" style={{position:"absolute",top:"calc(100% + 8px)",right:0,background:C.card,borderRadius:14,boxShadow:"0 4px 24px rgba(0,0,0,.12)",border:`1px solid ${C.border}`,padding:8,minWidth:200,zIndex:200}}>
                <div style={{padding:"10px 12px 12px",borderBottom:`1px solid ${C.border}`,marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <Avatar name={profileUser.name} size={36} emoji={profileUser.avatarEmoji} photoUrl={profileUser.photoUrl}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700}}>{profileUser.name}</div>
                      <div style={{fontSize:11,color:C.textMid,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div>
                    </div>
                  </div>
                  {isPro
                    ? <div style={{display:"flex",alignItems:"center",gap:6,background:"linear-gradient(135deg,#F5F0FF,#EDE0FF)",borderRadius:8,padding:"6px 10px"}}>
                        <span style={{fontSize:11}}>✦</span>
                        <span style={{fontSize:11,fontWeight:700,color:"#4C1D95"}}>Plano PRO ativo</span>
                      </div>
                    : <button onClick={()=>{setShowUserMenu(false);setShowUpgrade(true);}}
                        style={{width:"100%",background:PLAN_PRO_GRAD,color:"#fff",border:"none",borderRadius:8,padding:"7px 10px",fontWeight:700,fontSize:11,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                        <span>✦</span> Fazer Upgrade PRO
                      </button>
                  }
                </div>
                <button className="menu-item" onClick={()=>{setShowUserMenu(false);setShowProfile(true);}}><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx={12} cy={8} r={4}/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>Meu perfil</button>
                <button className="menu-item" onClick={()=>{setShowUserMenu(false);setActiveTab("help");}}><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx={12} cy={12} r={10}/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1={12} y1={17} x2={12.01} y2={17}/></svg>Dúvidas</button>

                <div style={{height:1,background:C.border,margin:"6px 0"}}/>
                <button className="menu-item danger" onClick={onLogout}><svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1={21} y1={12} x2={9} y2={12}/></svg>Sair da conta</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Main ─────────────────────────────────────────────────── */}
      <main style={{maxWidth:1160,margin:"0 auto",padding:mainPad}}>

        {/* KPIs */}
        <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:mob?10:14,marginBottom:mob?16:24}}>
          {[
            {label:"Salário",value:formatBRL(salary),sub:"mensal",icon:"💼",accent:C.text},
            {label:"Despesas",value:formatBRL(totalExpenses),sub:`${expenses.length} itens`,icon:"📤",accent:C.coral},
            {label:"Saldo",value:formatBRL(balance),sub:balance>=0?"positivo":"negativo",icon:"💰",accent:balance>=0?C.green:C.coral},
            {label:"Reserva",value:`${Math.max(0,savingsRate).toFixed(1)}%`,sub:savingsRate>=20?"excelente":savingsRate>=10?"razoável":"baixa",icon:"📈",accent:savingsRate>=20?C.green:savingsRate>=10?C.amber:C.coral},
          ].map((k,i)=>(
            <Card key={i} className="card-hover" style={{padding:mob?"14px":"18px 20px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:mob?6:10}}>
                <SectionLabel>{k.label}</SectionLabel>
                <span style={{fontSize:mob?16:18}}>{k.icon}</span>
              </div>
              <div style={{fontSize:mob?18:22,fontWeight:800,color:k.accent,letterSpacing:"-.02em",lineHeight:1}}>{k.value}</div>
              <div style={{fontSize:11,color:C.textLight,marginTop:4,fontWeight:500}}>{k.sub}</div>
            </Card>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab==="overview"&&(
          <div className="fade-up">
            {/* Free plan usage card */}
            {!isPro&&(
              <div style={{background:"linear-gradient(135deg,#FAFAFF,#F5F0FF)",border:"1.5px solid #C4B5FD",borderRadius:16,padding:mob?"14px 16px":"16px 22px",marginBottom:mob?12:18,display:"flex",alignItems:mob?"flex-start":"center",gap:16,flexDirection:mob?"column":"row"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#4C1D95"}}>Uso do plano</span>
                    <FreeBadge/>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:mob?"8px 16px":16}}>
                    <LimitBar used={expenses.length} max={limits.expenses} label="Despesas" color={C.blue}/>
                    <LimitBar used={goals.length} max={limits.goals} label="Objetivos" color={C.purple}/>
                    <LimitBar used={usage.aiImports||0} max={limits.aiImports} label="Import IA" color={C.green}/>
                    <LimitBar used={usage.aiAnalysis||0} max={limits.aiAnalysis} label="Análise IA" color={C.coral}/>
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                    {[
                      {label:"Upload de extrato",ok:limits.uploadExtratos},
                      {label:"Relatório completo IA",ok:limits.fullReport},
                      {label:"Exportar XLS",ok:limits.exportXls},
                      {label:"Planejamento anual",ok:limits.planMonths===Infinity},
                    ].map(f=>(
                      <span key={f.label} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,fontWeight:600,color:f.ok?C.green:C.textLight,background:f.ok?C.greenLight:C.bgSoft,borderRadius:100,padding:"3px 9px",border:`1px solid ${f.ok?C.green+"30":C.border}`}}>
                        {f.ok?"✓":"✗"} {f.label}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={()=>setShowUpgrade(true)}
                  style={{background:PLAN_PRO_GRAD,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,fontSize:13,fontFamily:"inherit",cursor:"pointer",flexShrink:0,boxShadow:"0 2px 10px rgba(124,58,237,.25)",whiteSpace:"nowrap"}}>
                  ✦ Ver plano PRO
                </button>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:mob?12:18,marginBottom:mob?12:18}}>
              <Card style={{padding:mob?16:24}}>
                {/* ── Salary card header */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                  <div style={{fontSize:15,fontWeight:800}}>{salaryConfirmed&&!salaryEditing?"Seu salário":"Configure seu salário"}</div>
                  {salaryConfirmed&&!salaryEditing&&(
                    <button onClick={()=>{setSalaryDraft(salary);setSalaryEditing(true);}}
                      title="Editar salário"
                      style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:C.bgSoft,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.textMid,transition:"all .15s"}}
                      onMouseOver={e=>{e.currentTarget.style.borderColor=C.coral;e.currentTarget.style.color=C.coral;e.currentTarget.style.background=C.coralLight;}}
                      onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textMid;e.currentTarget.style.background=C.bgSoft;}}>
                      <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                  )}
                </div>

                {/* ── Confirmed display */}
                {salaryConfirmed&&!salaryEditing?(
                  <div style={{background:C.bgSoft,borderRadius:12,padding:"14px 16px",marginBottom:16,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:36,height:36,borderRadius:10,background:C.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>💼</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,color:C.textMid,fontWeight:600,marginBottom:2}}>Salário líquido mensal</div>
                      <div style={{fontSize:22,fontWeight:800,color:C.green,letterSpacing:"-.02em"}}>{formatBRL(salary)}</div>
                    </div>
                  </div>
                ):(
                  /* ── Input (first time or editing) */
                  <div style={{marginBottom:16}}>
                    <FieldInput label="Salário líquido mensal" prefix="R$"
                      value={salaryConfirmed?salaryDraft:salary}
                      onChange={salaryConfirmed?setSalaryDraft:setSalary}
                      placeholder="0,00" type="number" hint="Valor após INSS e IR"/>
                    <div style={{display:"flex",gap:8,marginTop:10}}>
                      {salaryEditing&&(
                        <button onClick={()=>setSalaryEditing(false)}
                          style={{flex:1,background:C.bgSoft,color:C.textMid,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                          Cancelar
                        </button>
                      )}
                      <button
                        disabled={!(salaryConfirmed?salaryDraft:salary)}
                        onClick={()=>{
                          if(salaryConfirmed){setSalary(salaryDraft);setSalaryEditing(false);}
                          else setSalaryConfirmed(true);
                        }}
                        className="primary-btn"
                        style={{flex:2,background:C.coral,color:"#fff",border:"none",borderRadius:9,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6,boxShadow:"0 2px 8px rgba(252,23,87,.2)",opacity:!(salaryConfirmed?salaryDraft:salary)?0.4:1,transition:"all .18s"}}>
                        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        {salaryEditing?"Salvar alteração":"Confirmar salário"}
                      </button>
                    </div>
                  </div>
                )}

                <div style={{background:C.bgWarm,borderRadius:12,padding:14,border:"1px solid #FFD9D9"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:C.coral}}/>
                    <div style={{fontSize:12,fontWeight:700,color:C.coral}}>Regra 50/30/20</div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                    {[["Necessidades","50%",0.5,C.blue],["Desejos","30%",0.3,C.amber],["Reserva","20%",0.2,C.green]].map(([l,pct,p,color])=>(
                      <div key={l} style={{background:C.card,borderRadius:10,padding:"10px 8px",textAlign:"center",boxShadow:C.shadowSm}}>
                        <div style={{fontSize:mob?14:17,fontWeight:800,color,letterSpacing:"-.01em"}}>{formatBRL(Number(salary||0)*p)}</div>
                        <div style={{fontSize:10,color:C.text,fontWeight:600,marginTop:2}}>{l}</div>
                        <div style={{fontSize:10,color:C.textLight}}>{pct}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              <Card style={{padding:mob?16:24}}>
                <div style={{fontSize:15,fontWeight:800,marginBottom:16}}>Distribuição</div>
                {Number(salary)>0?(
                  <div style={{display:"flex",alignItems:"center",gap:mob?16:24,flexWrap:mob?"wrap":"nowrap"}}>
                    <DonutChart data={pieData} size={mob?130:160}/>
                    <div style={{flex:1,minWidth:0}}>
                      {pieData.map(d=>(
                        <div key={d.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:8,height:8,borderRadius:2,background:d.color}}/>
                            <span style={{fontSize:12,color:C.textMid,fontWeight:500}}>{d.label}</span>
                          </div>
                          <span style={{fontSize:12,fontWeight:700}}>{formatBRL(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 0",gap:8}}>
                    <div style={{fontSize:32}}>📊</div>
                    <div style={{fontSize:13,color:C.textMid}}>Informe seu salário para ver</div>
                  </div>
                )}
              </Card>
            </div>
            {catTotals.length>0&&(
              <Card style={{padding:mob?16:24}}>
                <div style={{fontSize:15,fontWeight:800,marginBottom:16}}>Por categoria</div>
                <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:"0 36px"}}>
                  {catTotals.map(c=><BarRow key={c.label} label={c.label} value={c.value} max={Math.max(...catTotals.map(x=>x.value))} color={c.color}/>)}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* EXPENSES */}
        {activeTab==="expenses"&&(
          <div className="fade-up" style={{display:"flex",flexDirection:"column",gap:mob?12:18}}>
            {/* Row: section title + upload button */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div style={{fontSize:mob?14:16,fontWeight:800,color:C.text}}>Minhas Despesas</div>
              <button onClick={()=>setShowUploadModal(true)}
                style={{display:"flex",alignItems:"center",gap:7,background:C.bgSoft,border:`1.5px solid ${C.border}`,borderRadius:10,padding:mob?"8px 12px":"9px 16px",fontSize:mob?12:13,fontWeight:700,color:C.text,cursor:"pointer",fontFamily:"inherit",flexShrink:0,transition:"all .15s"}}
                onMouseOver={e=>{e.currentTarget.style.borderColor=C.coral;e.currentTarget.style.color=C.coral;}}
                onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.text;}}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1={12} y1={3} x2={12} y2={15}/>
                </svg>
                Importar extrato
              </button>
            </div>
            {/* AI Import */}
            <Card style={{padding:mob?16:24}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <div style={{width:36,height:36,borderRadius:10,background:C.coralLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>✦</div>
                <div>
                  <div style={{fontWeight:800,fontSize:14}}>Importar com IA</div>
                  <div style={{fontSize:12,color:C.textMid,marginTop:1}}>Cole qualquer lista — a IA organiza tudo</div>
                </div>
              </div>
              {!importPreview?(
                <>
                  <textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder={"Cole sua lista aqui:\n\nAluguel 1500\nNetflix 55,90\nMercado 287,50"}
                    style={{width:"100%",minHeight:100,background:C.bgSoft,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"12px 14px",color:C.text,fontSize:13,outline:"none",lineHeight:1.65,boxSizing:"border-box"}}
                    onFocus={e=>{e.target.style.borderColor=C.coral;}} onBlur={e=>{e.target.style.borderColor=C.border;}}/>
                  {importError&&<div style={{color:C.coral,fontSize:12,marginTop:8,padding:"8px 12px",background:C.coralLight,borderRadius:8,fontWeight:500}}>⚠️ {importError}</div>}
                  {!isPro&&usage.aiImports>=limits.aiImports&&(
                    <div style={{marginTop:10}}>
                      <PaywallBanner msg={`Você usou ${usage.aiImports}/${limits.aiImports} importação IA este mês.`} onUpgrade={()=>setShowUpgrade(true)}/>
                    </div>
                  )}
                  <div style={{display:"flex",gap:8,marginTop:12}}>
                    <PrimaryBtn onClick={parseExpensesWithAI} disabled={importLoading||!importText.trim()||(!isPro&&usage.aiImports>=limits.aiImports)} size="sm">
                      {importLoading?<><span className="spinner">↻</span>Interpretando...</>:(!isPro&&usage.aiImports>=limits.aiImports)?"🔒 Limite atingido":"✦ Interpretar"}
                    </PrimaryBtn>
                    {importText&&<GhostBtn onClick={()=>{setImportText("");setImportError("");}}>Limpar</GhostBtn>}
                  </div>
                </>
              ):(
                <div className="fade-up">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:20,height:20,borderRadius:"50%",background:C.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:C.green,fontWeight:700}}>✓</div>
                      <span style={{fontWeight:700,fontSize:13}}>{importPreview.despesas?.length||0} despesas encontradas</span>
                    </div>
                    <button onClick={()=>setImportPreview(null)} style={{background:"none",border:"none",color:C.textMid,cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>← Editar</button>
                  </div>
                  <div style={{border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",marginBottom:12}}>
                    {importPreview.despesas?.map((d,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",padding:"11px 14px",borderBottom:i<importPreview.despesas.length-1?`1px solid ${C.border}`:"none",gap:10}}>
                        <div style={{width:30,height:30,borderRadius:8,background:CAT_BG[d.category]||C.bgSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{CAT_EMOJI[d.category]||"📦"}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</div>
                          <div style={{display:"flex",gap:5,marginTop:3}}><Pill color={d.type==="fixa"?C.blue:C.amber}>{d.type==="fixa"?"Fixa":"Variável"}</Pill><Pill color={CAT_COLORS[d.category]||C.textMid}>{d.category}</Pill></div>
                        </div>
                        <div style={{fontWeight:700,fontSize:13,flexShrink:0}}>{formatBRL(d.value)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <PrimaryBtn onClick={confirmImport} size="sm" disabled={!isPro&&expenses.length>=limits.expenses}>
                      {!isPro&&expenses.length>=limits.expenses?"🔒 Limite de despesas atingido":`✓ Adicionar ${importPreview.despesas?.length}`}
                    </PrimaryBtn>
                    <GhostBtn onClick={()=>{setImportPreview(null);setImportText("");}}>Cancelar</GhostBtn>
                  </div>
                </div>
              )}
            </Card>

            {/* Manual form + list */}
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"340px 1fr",gap:mob?12:18}}>
              <Card style={{padding:mob?16:22}}>
                <div style={{fontSize:14,fontWeight:800,marginBottom:16}}>Adicionar manualmente</div>
                <FieldInput label="Nome" value={newName} onChange={setNewName} placeholder="Ex: Aluguel, Spotify..."/>
                <FieldInput label="Valor" prefix="R$" value={newValue} onChange={setNewValue} placeholder="0,00" type="number"/>
                <FieldSelect label="Tipo" value={newType} onChange={setNewType} options={[{value:"fixa",label:"Conta Fixa"},{value:"variavel",label:"Conta Variável"}]}/>
                <FieldSelect label="Categoria" value={newCategory} onChange={setNewCategory} options={CATEGORIES.map(c=>({value:c,label:c}))}/>
                <PrimaryBtn onClick={addExpense} fullWidth disabled={!isPro&&expenses.length>=limits.expenses}>
                  {!isPro&&expenses.length>=limits.expenses?"🔒 Limite atingido":"Adicionar"}
                </PrimaryBtn>
                {!isPro&&expenses.length>=limits.expenses&&(
                  <button onClick={()=>setShowUpgrade(true)} style={{width:"100%",background:"none",border:"none",color:"#7C3AED",fontWeight:700,fontSize:12,fontFamily:"inherit",cursor:"pointer",marginTop:6,textAlign:"center"}}>
                    ✦ Fazer upgrade para ilimitado
                  </button>
                )}
              </Card>
              <Card style={{padding:0,overflow:"hidden"}}>
                <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontWeight:800,fontSize:14}}>Minhas despesas</div>
                  <div style={{display:"flex",gap:6}}><Pill color={C.blue}>F {formatBRL(totalFixed)}</Pill><Pill color={C.amber}>V {formatBRL(totalVariable)}</Pill></div>
                </div>
                {expenses.length===0?(
                  <div style={{padding:"36px 24px",textAlign:"center"}}>
                    <div style={{fontSize:32,marginBottom:10}}>📭</div>
                    <div style={{fontWeight:700,fontSize:14,marginBottom:5}}>Nenhuma despesa ainda</div>
                    <div style={{fontSize:12,color:C.textMid}}>Use o importador com IA ou adicione manualmente</div>
                  </div>
                ):(
                  <div style={{maxHeight:mob?300:420,overflowY:"auto"}}>
                    {expenses.map(exp=>(
                      <div key={exp.id} className="expense-row" style={{display:"flex",alignItems:"center",padding:"12px 18px",borderBottom:`1px solid ${C.border}`,gap:10}}>
                        <div style={{width:32,height:32,borderRadius:9,background:CAT_BG[exp.category]||C.bgSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{CAT_EMOJI[exp.category]||"📦"}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{exp.name}</div>
                          <div style={{display:"flex",gap:5,marginTop:3}}><Pill color={exp.type==="fixa"?C.blue:C.amber}>{exp.type==="fixa"?"Fixa":"Variável"}</Pill><Pill color={CAT_COLORS[exp.category]||C.textMid}>{exp.category}</Pill></div>
                        </div>
                        <div style={{fontWeight:700,fontSize:13,marginRight:8,flexShrink:0}}>{formatBRL(exp.value)}</div>
                        <button className="del-btn" onClick={()=>setExpenses(expenses.filter(e=>e.id!==exp.id))} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textLight,borderRadius:7,padding:"4px 8px",fontSize:11,fontFamily:"inherit",cursor:"pointer"}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* GOALS */}
        {activeTab==="goals"&&(
          <div className="fade-up" style={{display:"grid",gridTemplateColumns:mob?"1fr":"360px 1fr",gap:mob?12:18}}>
            <Card style={{padding:mob?16:22}}>
              <div style={{fontSize:14,fontWeight:800,marginBottom:16}}>🎯 Novo objetivo</div>
              <FieldInput label="Nome" value={newGoalName} onChange={setNewGoalName} placeholder="Ex: Viajar para Europa..."/>
              <div style={{marginBottom:16}}>
                <label style={{display:"block",fontSize:13,fontWeight:600,color:C.text,marginBottom:6}}>Descrição <span style={{color:C.textLight,fontWeight:400}}>(opcional)</span></label>
                <textarea value={newGoalDesc} onChange={e=>setNewGoalDesc(e.target.value)} placeholder="Detalhes..."
                  style={{width:"100%",minHeight:70,background:C.bgSoft,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"11px 14px",color:C.text,fontSize:13,outline:"none",lineHeight:1.5,boxSizing:"border-box"}}
                  onFocus={e=>{e.target.style.borderColor=C.coral;}} onBlur={e=>{e.target.style.borderColor=C.border;}}/>
              </div>
              <FieldInput label="Custo estimado" prefix="R$" value={newGoalCost} onChange={setNewGoalCost} placeholder="IA estimará se vazio" type="number"/>
              <FieldInput label="Prazo desejado" value={newGoalDeadline} onChange={setNewGoalDeadline} placeholder="Ex: 2 anos, Dez/2026..."/>
              <PrimaryBtn fullWidth onClick={()=>{
                if(!newGoalName) return;
                if(!isPro && goals.length>=limits.goals){ setShowUpgrade(true); return; }
                setGoals([...goals,{id:Date.now(),name:newGoalName,desc:newGoalDesc,cost:newGoalCost,deadline:newGoalDeadline}]);
                setNewGoalName(""); setNewGoalDesc(""); setNewGoalCost(""); setNewGoalDeadline("");
              }}>{!isPro&&goals.length>=limits.goals?"🔒 Upgrade para mais objetivos":"Adicionar objetivo"}</PrimaryBtn>
            </Card>
            <Card style={{padding:0,overflow:"hidden"}}>
              <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{fontWeight:800,fontSize:14}}>Meus objetivos</div>
                <Pill color={C.coral}>{goals.length} objetivo{goals.length!==1?"s":""}</Pill>
              </div>
              {goals.length===0?(
                <div style={{padding:"44px 24px",textAlign:"center"}}>
                  <div style={{fontSize:38,marginBottom:12}}>🌟</div>
                  <div style={{fontWeight:800,fontSize:15,marginBottom:6}}>Sonhe grande!</div>
                  <div style={{fontSize:13,color:C.textMid,maxWidth:260,margin:"0 auto",lineHeight:1.6}}>Adicione objetivos e a IA criará um plano financeiro para realizá-los</div>
                </div>
              ):(
                <div style={{maxHeight:mob?280:480,overflowY:"auto"}}>
                  {goals.map((g,i)=>{
                    const emojis=["🌴","✈️","🏠","🚗","📚","💍","🏖️","🌎","🎯","⭐"];
                    return (
                      <div key={g.id} style={{padding:"16px 18px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"flex-start",gap:12}}>
                        <div style={{width:38,height:38,borderRadius:10,background:C.bgWarm,border:"1px solid #FFD9D9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{emojis[i%emojis.length]}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:700,marginBottom:3}}>{g.name}</div>
                          {g.desc&&<div style={{fontSize:12,color:C.textMid,marginBottom:6,lineHeight:1.5}}>{g.desc}</div>}
                          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                            {g.cost?<Pill color={C.blue}>💰 {formatBRL(g.cost)}</Pill>:<Pill color={C.textLight}>Custo: IA estimará</Pill>}
                            {g.deadline&&<Pill color={C.amber}>📅 {g.deadline}</Pill>}
                          </div>
                        </div>
                        <button className="del-btn" onClick={()=>setGoals(goals.filter(x=>x.id!==g.id))} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textLight,borderRadius:7,padding:"4px 8px",fontSize:11,fontFamily:"inherit",cursor:"pointer"}}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
              {goals.length>0&&<div style={{padding:"12px 18px",background:C.bgWarm,borderTop:"1px solid #FFD9D9",fontSize:12,color:C.coral,fontWeight:600}}>✦ Vá para <strong>Análise</strong> para receber o plano de cada objetivo</div>}
            </Card>
          </div>
        )}

        {/* AI ANALYSIS */}
        {activeTab==="ai"&&(
          <div className="fade-up">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:mob?"flex-start":"center",flexDirection:mob?"column":"row",gap:mob?12:0,marginBottom:mob?16:24}}>
              <div>
                <div style={{fontSize:mob?18:20,fontWeight:800,letterSpacing:"-.02em"}}>Análise de Gastos</div>
                <div style={{fontSize:13,color:C.textMid,marginTop:3}}>Insights personalizados com IA</div>
              </div>
  <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:mob?"stretch":"flex-end"}}>
                <PrimaryBtn onClick={getAiTips} disabled={tipsLoading||!salary||!expenses.length||(!isPro&&usage.aiAnalysis>=limits.aiAnalysis)} size={mob?"md":"lg"} fullWidth={mob}>
                  {tipsLoading?<><span className="spinner">↻</span>Analisando...</>:(!isPro&&usage.aiAnalysis>=limits.aiAnalysis)?"🔒 Limite atingido":"✦ Gerar Análise"}
                </PrimaryBtn>
                {!isPro&&<div style={{fontSize:11,color:C.textMid,textAlign:"right",fontWeight:500}}>{usage.aiAnalysis||0}/{limits.aiAnalysis} análises este mês</div>}
              </div>
            </div>
            {!isPro&&usage.aiAnalysis>=limits.aiAnalysis&&(
              <PaywallBanner msg={`Você usou ${usage.aiAnalysis}/${limits.aiAnalysis} análise IA este mês.`} onUpgrade={()=>setShowUpgrade(true)}/>
            )}
            {(!salary||!expenses.length)?(
              <Card style={{padding:"40px 24px",textAlign:"center"}}>
                <div style={{fontSize:36,marginBottom:12}}>📊</div>
                <div style={{fontWeight:800,fontSize:16,marginBottom:6}}>Dados insuficientes</div>
                <div style={{fontSize:13,color:C.textMid}}>Adicione salário e ao menos uma despesa</div>
              </Card>
            ):!aiTips&&!tipsLoading?(
              <Card style={{padding:"44px 24px",textAlign:"center"}}>
                <div style={{width:60,height:60,borderRadius:"50%",background:C.coralLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 14px"}}>✦</div>
                <div style={{fontWeight:800,fontSize:16,marginBottom:6}}>Pronto para analisar!</div>
                <div style={{fontSize:13,color:C.textMid,maxWidth:300,margin:"0 auto"}}>Clique em Gerar Análise para receber dicas de economia, investimentos e plano para seus objetivos</div>
              </Card>
            ):tipsLoading?(
              <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:12}}>
                {[180,140,140,160].map((h,i)=><div key={i} className="shimmer" style={{height:h,borderRadius:16}}/>)}
              </div>
            ):aiTips?.error?(
              <Card style={{padding:24,borderColor:"#FFD0D7",background:C.coralLight}}><div style={{color:C.coral,fontWeight:600}}>⚠️ {aiTips.error}</div></Card>
            ):aiTips?(
              <div className="fade-up" style={{display:"flex",flexDirection:"column",gap:mob?12:18}}>
                <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr auto",gap:14,alignItems:"stretch"}}>
                  <Card style={{padding:mob?16:24,background:"linear-gradient(135deg,#FFF9F7,#FFF3F0)",border:"1px solid #FFD9D9"}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:C.coral}}/>
                      <SectionLabel>Diagnóstico</SectionLabel>
                    </div>
                    <div style={{fontSize:14,lineHeight:1.75}}>{aiTips.diagnostico}</div>
                  </Card>
                  {aiTips.score!==undefined&&(
                    <Card style={{padding:mob?16:22,display:"flex",flexDirection:mob?"row":"column",alignItems:"center",justifyContent:mob?"flex-start":"center",gap:10,minWidth:mob?0:110}}>
                      <ScoreRing score={aiTips.score}/>
                      <div style={{fontSize:11,color:C.textLight,fontWeight:600,textAlign:"center"}}>Saúde{!mob&&<br/>}Financeira</div>
                    </Card>
                  )}
                </div>
                {aiTips.meta_emergencia&&(
                  <Card style={{padding:mob?14:20,background:C.amberLight,border:`1px solid ${C.amber}30`}}>
                    <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                      <div style={{width:36,height:36,borderRadius:10,background:"#FEF3C7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🛡️</div>
                      <div><div style={{fontWeight:700,fontSize:13,color:C.amber,marginBottom:4}}>Reserva de Emergência</div><div style={{fontSize:13,lineHeight:1.6}}>{aiTips.meta_emergencia}</div></div>
                    </div>
                  </Card>
                )}
                <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:mob?12:18}}>
                  <Card style={{padding:mob?16:22}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:14}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:28,height:28,borderRadius:8,background:C.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>💡</div>
                        <div style={{fontWeight:800,fontSize:14}}>Como economizar</div>
                      </div>
                      <button onClick={()=>{ if(!limits.fullReport){setShowUpgrade(true);return;} getFullReport("economias"); }}
                        style={{display:"flex",alignItems:"center",gap:5,background:"linear-gradient(135deg,#F0FFF4,#DCFCE7)",border:`1px solid ${C.green}40`,borderRadius:100,padding:"5px 11px",fontSize:11,fontWeight:700,color:C.green,cursor:"pointer",fontFamily:"inherit",flexShrink:0,transition:"all .15s"}}
                        onMouseOver={e=>{e.currentTarget.style.background=C.greenLight;}}
                        onMouseOut={e=>{e.currentTarget.style.background="linear-gradient(135deg,#F0FFF4,#DCFCE7)";}}>
                        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1={16} y1={13} x2={8} y2={13}/><line x1={16} y1={17} x2={8} y2={17}/></svg>
                        Relatório completo
                      </button>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {aiTips.economias?.map((tip,i)=>(
                        <div key={i} style={{padding:"12px 14px",background:C.bgSoft,borderRadius:10,border:`1px solid ${C.border}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:5}}>
                            <div style={{fontWeight:700,fontSize:13}}>{tip.titulo}</div>
                            {tip.economia_estimada&&<Pill color={C.green}>{tip.economia_estimada}</Pill>}
                          </div>
                          <div style={{fontSize:12,color:C.textMid,lineHeight:1.6}}>{tip.descricao}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card style={{padding:mob?16:22}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:14}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:28,height:28,borderRadius:8,background:C.blueLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>📈</div>
                        <div style={{fontWeight:800,fontSize:14}}>Como investir</div>
                      </div>
                      <button onClick={()=>{ if(!limits.fullReport){setShowUpgrade(true);return;} getFullReport("investimentos"); }}
                        style={{display:"flex",alignItems:"center",gap:5,background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)",border:`1px solid ${C.blue}40`,borderRadius:100,padding:"5px 11px",fontSize:11,fontWeight:700,color:C.blue,cursor:"pointer",fontFamily:"inherit",flexShrink:0,transition:"all .15s"}}
                        onMouseOver={e=>{e.currentTarget.style.background=C.blueLight;}}
                        onMouseOut={e=>{e.currentTarget.style.background="linear-gradient(135deg,#EFF6FF,#DBEAFE)";}}>
                        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1={16} y1={13} x2={8} y2={13}/><line x1={16} y1={17} x2={8} y2={17}/></svg>
                        Relatório completo
                      </button>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {aiTips.investimentos?.map((inv,i)=>(
                        <div key={i} style={{padding:"12px 14px",background:C.bgSoft,borderRadius:10,border:`1px solid ${C.border}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:5}}>
                            <div style={{fontWeight:700,fontSize:13}}>{inv.tipo}</div>
                            <div style={{display:"flex",gap:5}}>{inv.percentual_sugerido&&<Pill color={C.blue}>{inv.percentual_sugerido}</Pill>}{inv.risco&&<Pill color={riskColor[inv.risco]||C.textMid} bg={riskBg[inv.risco]}>{inv.risco}</Pill>}</div>
                          </div>
                          <div style={{fontSize:12,color:C.textMid,lineHeight:1.6}}>{inv.descricao}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
                {aiTips.plano_objetivos?.length>0&&(
                  <Card style={{padding:mob?16:24}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
                      <div style={{width:28,height:28,borderRadius:8,background:C.coralLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🎯</div>
                      <div style={{fontWeight:800,fontSize:14}}>Plano para seus objetivos</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:12}}>
                      {aiTips.plano_objetivos.map((p,i)=>(
                        <div key={i} style={{padding:mob?14:18,background:p.viavel?C.bgSoft:C.bgWarm,borderRadius:12,border:`1.5px solid ${p.viavel?C.border:"#FFD9D9"}`}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                            <div style={{fontWeight:800,fontSize:14}}>{p.objetivo}</div>
                            <Pill color={p.viavel?C.green:C.amber}>{p.viavel?"✓ Viável":"⚠ Desafiador"}</Pill>
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(3,1fr)",gap:8,marginBottom:12}}>
                            {(mob?[{label:"Por mês",val:p.valor_mensal,color:C.green,bg:C.greenLight},{label:"Prazo",val:p.prazo_meses?`${p.prazo_meses}m`:"—",color:C.amber,bg:C.amberLight}]:[{label:"Custo",val:p.custo_estimado,color:C.blue,bg:C.blueLight},{label:"Por mês",val:p.valor_mensal,color:C.green,bg:C.greenLight},{label:"Prazo",val:p.prazo_meses?`${p.prazo_meses}m`:"—",color:C.amber,bg:C.amberLight}]).map(s=>(
                              <div key={s.label} style={{background:s.bg,borderRadius:9,padding:"10px 10px",textAlign:"center"}}>
                                <div style={{fontSize:mob?12:14,fontWeight:800,color:s.color}}>{s.val}</div>
                                <div style={{fontSize:10,color:C.textMid,marginTop:2,fontWeight:600}}>{s.label}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{fontSize:12,color:C.textMid,lineHeight:1.7,padding:"10px 12px",background:C.card,borderRadius:8,border:`1px solid ${C.border}`}}>{p.estrategia}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            ):null}
          </div>
        )}

        {/* PLANNING */}
        {activeTab==="planning"&&(()=>{
          // helpers scoped to this tab
          const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
          const MONTHS_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

          const parsedPlanMonth = planMonth ? planMonth.split("-") : [new Date().getFullYear().toString(), String(new Date().getMonth()+1).padStart(2,"0")];
          const planYear  = parseInt(parsedPlanMonth[0]);
          const planMoIdx = parseInt(parsedPlanMonth[1]) - 1;

          const prevMonth = () => {
            const d = new Date(planYear, planMoIdx - 1, 1);
            setPlanMonth(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"));
          };
          const nextMonth = () => {
            const d = new Date(planYear, planMoIdx + 1, 1);
            setPlanMonth(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"));
          };

          // Build 12-month timeline for summary row
          const timelineMonths = Array.from({length:12},(_,i)=>{
            const d = new Date(planYear, i, 1);
            return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
          });

          const monthRows = monthlyExpenses[planMonth] || [];
          const monthTotal = monthRows.reduce((s,e)=>s+Number(e.value||0),0);
          const monthFixed = monthRows.filter(e=>e.type==="fixa").reduce((s,e)=>s+Number(e.value||0),0);
          const monthVar   = monthRows.filter(e=>e.type==="variavel").reduce((s,e)=>s+Number(e.value||0),0);
          const monthBalance = Number(salary||0) - monthTotal;

          const addPlanExpense = () => {
            if(!planName||!planValue) return;
            const entry = {id:Date.now(),name:planName,value:planValue,type:planType,category:planCategory};
            setMonthlyExpenses(prev=>({...prev,[planAddMonth]:[...(prev[planAddMonth]||[]),entry]}));
            setPlanName(""); setPlanValue(""); setPlanAddOpen(false);
          };
          const deletePlanExpense = (month,id) => {
            setMonthlyExpenses(prev=>({...prev,[month]:(prev[month]||[]).filter(e=>e.id!==id)}));
          };
          const copyFromPrev = () => {
            const prev = new Date(planYear, planMoIdx-1, 1);
            const pk = prev.getFullYear()+"-"+String(prev.getMonth()+1).padStart(2,"0");
            const prevRows = monthlyExpenses[pk] || [];
            if(!prevRows.length) return;
            setMonthlyExpenses(p=>({...p,[planMonth]:[...(p[planMonth]||[]),...prevRows.map(e=>({...e,id:Date.now()+Math.random()}))]}));
          };

          const catTotals = CATEGORIES.map(cat=>({
            cat,
            value:monthRows.filter(e=>e.category===cat).reduce((s,e)=>s+Number(e.value||0),0)
          })).filter(c=>c.value>0);

          // ── XLS export helpers ──────────────────────────────────────────
          const fmtVal = v => Number(v||0);
          const buildMonthSheet = (XLSX, month) => {
            const rows = monthlyExpenses[month] || [];
            const [y,m] = month.split("-");
            const monthName = MONTHS_FULL[parseInt(m)-1] + " " + y;
            const total = rows.reduce((s,e)=>s+fmtVal(e.value),0);
            const fixed = rows.filter(e=>e.type==="fixa").reduce((s,e)=>s+fmtVal(e.value),0);
            const vari  = rows.filter(e=>e.type==="variavel").reduce((s,e)=>s+fmtVal(e.value),0);
            const sal   = fmtVal(salary);
            const bal   = sal - total;

            const sheetData = [
              ["Se Poupe — Planejamento: " + monthName],
              [],
              ["Salário líquido", sal],
              ["Total de despesas", total],
              ["Despesas fixas", fixed],
              ["Despesas variáveis", vari],
              ["Saldo", bal],
              [],
              ["Descrição","Categoria","Tipo","Valor (R$)"],
              ...rows.map(e=>[e.name, e.category, e.type==="fixa"?"Fixa":"Variável", fmtVal(e.value)]),
              [],
              ["TOTAL","","",total],
            ];
            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            ws["!cols"] = [{wch:34},{wch:16},{wch:12},{wch:14}];
            // Bold header rows
            ["A1","A3","A4","A5","A6","A7","A9","D"+String(sheetData.length)].forEach(ref=>{
              if(ws[ref]) ws[ref].s = {font:{bold:true}};
            });
            return ws;
          };

          const exportMonth = async () => {
            setExportLoading(true);
            try {
              const XLSX = await loadXLSX();
              const wb = XLSX.utils.book_new();
              const [y,m] = planMonth.split("-");
              const sheetName = MONTHS_FULL[parseInt(m)-1].slice(0,15);
              XLSX.utils.book_append_sheet(wb, buildMonthSheet(XLSX, planMonth), sheetName);
              XLSX.writeFile(wb, `sepoupe_Planejamento_${MONTHS_FULL[parseInt(m)-1]}_${y}.xlsx`);
            } catch(e){ console.error(e); }
            setExportLoading(false); setShowExportMenu(false);
          };

          const exportYear = async () => {
            setExportLoading(true);
            try {
              const XLSX = await loadXLSX();
              const wb = XLSX.utils.book_new();
              // Summary sheet
              const summaryData = [
                ["Se Poupe — Resumo Anual " + planYear],
                [],
                ["Mês","Salário","Total Despesas","Fixas","Variáveis","Saldo","Itens"],
                ...timelineMonths.map((m,i)=>{
                  const rows = monthlyExpenses[m]||[];
                  const tot = rows.reduce((s,e)=>s+fmtVal(e.value),0);
                  const fix = rows.filter(e=>e.type==="fixa").reduce((s,e)=>s+fmtVal(e.value),0);
                  const vari = rows.filter(e=>e.type==="variavel").reduce((s,e)=>s+fmtVal(e.value),0);
                  const sal = fmtVal(salary);
                  return [MONTHS_FULL[i], sal, tot, fix, vari, sal-tot, rows.length];
                }),
                [],
                ["TOTAL ANUAL","",
                  timelineMonths.reduce((s,m)=>{const rows=monthlyExpenses[m]||[];return s+rows.reduce((ss,e)=>ss+fmtVal(e.value),0);},0),
                  timelineMonths.reduce((s,m)=>{const rows=(monthlyExpenses[m]||[]).filter(e=>e.type==="fixa");return s+rows.reduce((ss,e)=>ss+fmtVal(e.value),0);},0),
                  timelineMonths.reduce((s,m)=>{const rows=(monthlyExpenses[m]||[]).filter(e=>e.type==="variavel");return s+rows.reduce((ss,e)=>ss+fmtVal(e.value),0);},0),
                  "",""],
              ];
              const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
              wsSummary["!cols"] = [{wch:14},{wch:14},{wch:16},{wch:14},{wch:14},{wch:14},{wch:6}];
              XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo Anual");
              // One sheet per month
              timelineMonths.forEach((m,i)=>{
                const sheetName = MONTHS_FULL[i].slice(0,15);
                XLSX.utils.book_append_sheet(wb, buildMonthSheet(XLSX, m), sheetName);
              });
              XLSX.writeFile(wb, `sepoupe_Planejamento_${planYear}.xlsx`);
            } catch(e){ console.error(e); }
            setExportLoading(false); setShowExportMenu(false);
          };

          return (
          <div className="fade-up">
            {/* Header */}
            <div style={{display:"flex",alignItems:mob?"flex-start":"center",justifyContent:"space-between",flexDirection:mob?"column":"row",gap:mob?12:0,marginBottom:mob?16:24}}>
              <div>
                <div style={{fontSize:mob?18:20,fontWeight:800,letterSpacing:"-.02em",marginBottom:4}}>Planejamento Mensal</div>
                <div style={{fontSize:13,color:C.textMid}}>Organize suas despesas mês a mês</div>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <button onClick={copyFromPrev} style={{background:C.bgSoft,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:600,color:C.textMid,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x={8} y={2} width={8} height={4} rx={1}/></svg>
                  Copiar mês anterior
                </button>

                {/* Export XLS dropdown */}
                <div style={{position:"relative"}} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>setShowExportMenu(s=>!s)}
                    style={{background:C.bgSoft,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 14px",fontSize:12,fontWeight:600,color:C.textMid,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,transition:"all .15s"}}
                    onMouseOver={e=>{e.currentTarget.style.borderColor=C.green;e.currentTarget.style.color=C.green;}}
                    onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textMid;}}>
                    {exportLoading
                      ? <span className="spinner" style={{fontSize:12}}>↻</span>
                      : <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1={12} y1={15} x2={12} y2={3}/></svg>}
                    Exportar XLS
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                  {showExportMenu&&(
                    <div className="slide-down" style={{position:"absolute",top:"calc(100% + 6px)",right:0,background:C.card,borderRadius:12,boxShadow:"0 4px 20px rgba(0,0,0,.12)",border:`1px solid ${C.border}`,padding:6,minWidth:210,zIndex:300}}>
                      <button onClick={exportMonth}
                        style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"transparent",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:C.text,textAlign:"left",transition:"background .12s"}}
                        onMouseOver={e=>e.currentTarget.style.background=C.bgSoft}
                        onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                        <span style={{width:30,height:30,borderRadius:8,background:C.greenLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>📄</span>
                        <div>
                          <div style={{fontWeight:700,fontSize:12}}>Este mês</div>
                          <div style={{fontSize:11,color:C.textMid}}>{MONTHS_FULL[planMoIdx]} {planYear}</div>
                        </div>
                      </button>
                      <button onClick={exportYear}
                        style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"transparent",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,color:C.text,textAlign:"left",transition:"background .12s"}}
                        onMouseOver={e=>e.currentTarget.style.background=C.bgSoft}
                        onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                        <span style={{width:30,height:30,borderRadius:8,background:C.blueLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>📊</span>
                        <div>
                          <div style={{fontWeight:700,fontSize:12}}>Ano completo</div>
                          <div style={{fontSize:11,color:C.textMid}}>Todos os meses de {planYear}</div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                <button onClick={()=>{setPlanAddMonth(planMonth);setPlanAddOpen(true);}} style={{background:C.coral,color:"#fff",border:"none",borderRadius:9,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6,boxShadow:"0 2px 8px rgba(252,23,87,.25)"}}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>
                  Adicionar despesa
                </button>
              </div>
            </div>

            {/* Month navigator */}
            <Card style={{padding:mob?"12px 14px":"14px 20px",marginBottom:mob?12:16}}>
              <div style={{display:"flex",alignItems:"center",gap:mob?8:16}}>
                <button onClick={()=>{ if(!isPro){setShowUpgrade(true);return;} prevMonth(); }} style={{background:C.bgSoft,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:C.textMid,flexShrink:0,opacity:isPro?1:0.45}}>
                  {isPro
                    ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                    : <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x={3} y={11} width={18} height={11} rx={2}/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                </button>

                {/* Mini month chips */}
                <div style={{flex:1,display:"flex",gap:4,overflowX:"auto",scrollbarWidth:"none",msOverflowStyle:"none"}}>
                  {timelineMonths.map(m=>{
                    const mi = parseInt(m.split("-")[1])-1;
                    const mRows = monthlyExpenses[m]||[];
                    const mTotal = mRows.reduce((s,e)=>s+Number(e.value||0),0);
                    const isActive = m===planMonth;
                    return (
                      <button key={m} onClick={()=>setPlanMonth(m)}
                        style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:mob?"6px 8px":"8px 12px",borderRadius:10,border:`1.5px solid ${isActive?C.coral:C.border}`,background:isActive?C.coralLight:"transparent",cursor:"pointer",fontFamily:"inherit",flexShrink:0,minWidth:mob?44:52,transition:"all .15s"}}>
                        <span style={{fontSize:mob?10:11,fontWeight:isActive?800:500,color:isActive?C.coral:C.textMid}}>{MONTH_NAMES[mi]}</span>
                        {mTotal>0&&<span style={{fontSize:9,fontWeight:600,color:isActive?C.coral:C.textLight}}>{(mTotal/1000).toFixed(0)}k</span>}
                        {mTotal===0&&<span style={{width:4,height:4,borderRadius:"50%",background:C.border,display:"block"}}/>}
                      </button>
                    );
                  })}
                </div>

                <button onClick={()=>{ if(!isPro){setShowUpgrade(true);return;} nextMonth(); }} style={{background:C.bgSoft,border:`1px solid ${C.border}`,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:C.textMid,flexShrink:0,opacity:isPro?1:0.45}}>
                  {isPro
                    ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                    : <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><rect x={3} y={11} width={18} height={11} rx={2}/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                </button>
              </div>
            </Card>

            {/* KPI summary for selected month */}
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:mob?8:12,marginBottom:mob?12:16}}>
              {[
                {label:"Total do mês",value:formatBRL(monthTotal),color:C.text,icon:"💸"},
                {label:"Fixas",value:formatBRL(monthFixed),color:C.blue,icon:"📌"},
                {label:"Variáveis",value:formatBRL(monthVar),color:C.amber,icon:"🔄"},
                {label:"Saldo previsto",value:formatBRL(monthBalance),color:monthBalance>=0?C.green:C.coral,icon:monthBalance>=0?"✅":"⚠️"},
              ].map((k,i)=>(
                <Card key={i} style={{padding:mob?"12px 14px":"14px 18px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                    <span style={{fontSize:14}}>{k.icon}</span>
                    <span style={{fontSize:11,color:C.textMid,fontWeight:500}}>{k.label}</span>
                  </div>
                  <div style={{fontSize:mob?15:18,fontWeight:800,color:k.color,letterSpacing:"-.01em"}}>{k.value}</div>
                </Card>
              ))}
            </div>

            {/* Main table */}
            <Card style={{padding:0,overflow:"hidden",marginBottom:mob?12:16}}>
              {/* Table header */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:mob?"14px 16px":"16px 22px",borderBottom:`1px solid ${C.border}`}}>
                <div style={{fontWeight:800,fontSize:14}}>{MONTHS_FULL[planMoIdx]} {planYear}</div>
                <span style={{fontSize:12,color:C.textMid,fontWeight:500}}>{monthRows.length} despesa{monthRows.length!==1?"s":""}</span>
              </div>

              {monthRows.length===0?(
                <div style={{padding:"48px 24px",textAlign:"center"}}>
                  <div style={{fontSize:36,marginBottom:10}}>📅</div>
                  <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>Nenhuma despesa neste mês</div>
                  <div style={{fontSize:13,color:C.textMid,marginBottom:18}}>Adicione despesas manualmente ou copie do mês anterior</div>
                  <button onClick={()=>{setPlanAddMonth(planMonth);setPlanAddOpen(true);}} style={{background:C.coral,color:"#fff",border:"none",borderRadius:9,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                    + Adicionar primeira despesa
                  </button>
                </div>
              ):(
                <>
                  {/* Column headers */}
                  {!mob&&(
                    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 100px",gap:12,padding:"9px 22px",background:C.bgSoft,borderBottom:`1px solid ${C.border}`}}>
                      {["Descrição","Categoria","Tipo","Valor",""].map((h,i)=>(
                        <div key={i} style={{fontSize:11,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:".04em",textAlign:i>=3?"right":"left"}}>{h}</div>
                      ))}
                    </div>
                  )}

                  {/* Rows */}
                  <div>
                    {monthRows.map((e,i)=>{
                      const isEditing = planEditId===e.id;
                      if(isEditing) return (
                        <div key={e.id} style={{padding:mob?"12px 16px":"14px 22px",borderBottom:i<monthRows.length-1?`1px solid ${C.border}`:"none",background:"#F5FAFF",borderLeft:`3px solid ${C.blue}`}}>
                          <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"2fr 1fr 1fr",gap:10,marginBottom:10}}>
                            <div>
                              <div style={{fontSize:11,fontWeight:600,color:C.textMid,marginBottom:4}}>Descrição</div>
                              <input value={planEditVals.name}
                                onChange={ev=>setPlanEditVals(v=>({...v,name:ev.target.value}))}
                                style={{width:"100%",background:"#fff",border:`1.5px solid ${C.blue}`,borderRadius:9,padding:"8px 12px",fontSize:13,color:C.text,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
                            </div>
                            <div>
                              <div style={{fontSize:11,fontWeight:600,color:C.textMid,marginBottom:4}}>Valor (R$)</div>
                              <input type="number" value={planEditVals.value}
                                onChange={ev=>setPlanEditVals(v=>({...v,value:ev.target.value}))}
                                style={{width:"100%",background:"#fff",border:`1.5px solid ${C.blue}`,borderRadius:9,padding:"8px 12px",fontSize:13,color:C.text,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
                            </div>
                            <div>
                              <div style={{fontSize:11,fontWeight:600,color:C.textMid,marginBottom:4}}>Tipo</div>
                              <select value={planEditVals.type}
                                onChange={ev=>setPlanEditVals(v=>({...v,type:ev.target.value}))}
                                style={{width:"100%",background:"#fff",border:`1.5px solid ${C.blue}`,borderRadius:9,padding:"8px 12px",fontSize:13,color:C.text,outline:"none",fontFamily:"inherit",boxSizing:"border-box",cursor:"pointer"}}>
                                <option value="fixa">Fixa</option>
                                <option value="variavel">Variável</option>
                              </select>
                            </div>
                          </div>
                          <div style={{marginBottom:10}}>
                            <div style={{fontSize:11,fontWeight:600,color:C.textMid,marginBottom:6}}>Categoria</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                              {CATEGORIES.map(cat=>(
                                <button key={cat} type="button"
                                  onClick={()=>setPlanEditVals(v=>({...v,category:cat}))}
                                  style={{padding:"4px 9px",borderRadius:100,border:`1.5px solid ${planEditVals.category===cat?CAT_COLORS[cat]:C.border}`,background:planEditVals.category===cat?CAT_BG[cat]:"transparent",fontSize:11,fontWeight:planEditVals.category===cat?700:500,color:planEditVals.category===cat?CAT_COLORS[cat]:C.textMid,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:3,transition:"all .1s"}}>
                                  <span>{CAT_EMOJI[cat]}</span>{cat}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div style={{display:"flex",gap:8}}>
                            <button onClick={()=>{
                              setMonthlyExpenses(prev=>({...prev,[planMonth]:(prev[planMonth]||[]).map(r=>r.id===e.id?{...r,name:planEditVals.name,value:planEditVals.value,type:planEditVals.type,category:planEditVals.category}:r)}));
                              setPlanEditId(null);
                            }}
                              style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"8px 18px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                              ✓ Salvar
                            </button>
                            <button onClick={()=>setPlanEditId(null)}
                              style={{background:C.bgSoft,color:C.textMid,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      );
                      return (
                        <div key={e.id} style={{display:"grid",gridTemplateColumns:mob?"1fr auto":"2fr 1fr 1fr 1fr 100px",gap:mob?8:12,padding:mob?"12px 16px":"13px 22px",borderBottom:i<monthRows.length-1?`1px solid ${C.border}`:"none",alignItems:"center",transition:"background .12s"}}
                          onMouseOver={ev=>ev.currentTarget.style.background=C.bgSoft}
                          onMouseOut={ev=>ev.currentTarget.style.background="transparent"}>
                          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                            <div style={{width:32,height:32,borderRadius:9,background:CAT_BG[e.category],display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{CAT_EMOJI[e.category]}</div>
                            <div style={{minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</div>
                              {mob&&<div style={{fontSize:11,color:C.textMid,marginTop:1}}>{e.category} · <span style={{color:e.type==="fixa"?C.blue:C.amber,fontWeight:600}}>{e.type==="fixa"?"Fixa":"Variável"}</span></div>}
                            </div>
                          </div>
                          {!mob&&<div style={{fontSize:12,color:CAT_COLORS[e.category],fontWeight:600,background:CAT_BG[e.category],borderRadius:100,padding:"3px 10px",display:"inline-flex",alignItems:"center",gap:4,width:"fit-content"}}><span>{CAT_EMOJI[e.category]}</span>{e.category}</div>}
                          {!mob&&<div><span style={{fontSize:12,fontWeight:600,color:e.type==="fixa"?C.blue:C.amber,background:e.type==="fixa"?C.blueLight:C.amberLight,borderRadius:100,padding:"3px 10px"}}>{e.type==="fixa"?"Fixa":"Variável"}</span></div>}
                          <div style={{fontSize:mob?14:15,fontWeight:700,color:C.text,textAlign:"right"}}>{formatBRL(e.value)}</div>
                          <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                            <button onClick={()=>{setPlanEditId(e.id);setPlanEditVals({name:e.name,value:e.value,type:e.type,category:e.category});}}
                              style={{width:28,height:28,borderRadius:7,background:"transparent",border:`1px solid ${C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.textLight,transition:"all .15s"}}
                              onMouseOver={ev=>{ev.currentTarget.style.background=C.blueLight;ev.currentTarget.style.borderColor=C.blue;ev.currentTarget.style.color=C.blue;}}
                              onMouseOut={ev=>{ev.currentTarget.style.background="transparent";ev.currentTarget.style.borderColor=C.border;ev.currentTarget.style.color=C.textLight;}}>
                              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={()=>deletePlanExpense(planMonth,e.id)}
                              style={{width:28,height:28,borderRadius:7,background:"transparent",border:`1px solid ${C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.textLight,transition:"all .15s"}}
                              onMouseOver={ev=>{ev.currentTarget.style.background="#FFF0F2";ev.currentTarget.style.borderColor=C.coral;ev.currentTarget.style.color=C.coral;}}
                              onMouseOut={ev=>{ev.currentTarget.style.background="transparent";ev.currentTarget.style.borderColor=C.border;ev.currentTarget.style.color=C.textLight;}}>
                              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer totals */}
                  <div style={{padding:mob?"12px 16px":"14px 22px",borderTop:`2px solid ${C.border}`,background:C.bgSoft,display:"grid",gridTemplateColumns:mob?"1fr auto":"2fr 1fr 1fr 1fr 100px",gap:12,alignItems:"center"}}>
                    <div style={{fontWeight:700,fontSize:13}}>Total</div>
                    {!mob&&<div/>}{!mob&&<div/>}
                    <div style={{fontSize:mob?15:16,fontWeight:800,color:C.coral,textAlign:"right"}}>{formatBRL(monthTotal)}</div>
                    <div/>
                  </div>
                </>
              )}
            </Card>

            {/* Category breakdown */}
            {catTotals.length>0&&(
              <Card style={{padding:mob?"14px 16px":"18px 22px",marginBottom:mob?12:16}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Por categoria</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {catTotals.sort((a,b)=>b.value-a.value).map(c=>(
                    <div key={c.cat} style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:28,height:28,borderRadius:8,background:CAT_BG[c.cat],display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{CAT_EMOJI[c.cat]}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:12,fontWeight:600,color:C.text}}>{c.cat}</span>
                          <span style={{fontSize:12,fontWeight:700,color:C.text}}>{formatBRL(c.value)}</span>
                        </div>
                        <div style={{background:C.border,borderRadius:100,height:4}}>
                          <div style={{width:`${Math.min((c.value/monthTotal)*100,100)}%`,height:"100%",background:CAT_COLORS[c.cat],borderRadius:100,transition:"width .6s ease"}}/>
                        </div>
                      </div>
                      <span style={{fontSize:11,color:C.textMid,fontWeight:600,flexShrink:0,minWidth:36,textAlign:"right"}}>{monthTotal>0?((c.value/monthTotal)*100).toFixed(0):0}%</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Annual summary table */}
            <Card style={{padding:0,overflow:"hidden"}}>
              <div style={{padding:mob?"14px 16px":"16px 22px",borderBottom:`1px solid ${C.border}`,fontWeight:800,fontSize:14}}>Resumo anual — {planYear}</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:mob?560:0}}>
                  <thead>
                    <tr style={{background:C.bgSoft}}>
                      <th style={{padding:"9px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:C.textLight,letterSpacing:".04em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Mês</th>
                      <th style={{padding:"9px 12px",textAlign:"right",fontSize:11,fontWeight:700,color:C.textLight,letterSpacing:".04em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Despesas</th>
                      <th style={{padding:"9px 12px",textAlign:"right",fontSize:11,fontWeight:700,color:C.textLight,letterSpacing:".04em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Fixas</th>
                      <th style={{padding:"9px 12px",textAlign:"right",fontSize:11,fontWeight:700,color:C.textLight,letterSpacing:".04em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Variáveis</th>
                      <th style={{padding:"9px 12px",textAlign:"right",fontSize:11,fontWeight:700,color:C.textLight,letterSpacing:".04em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Saldo</th>
                      <th style={{padding:"9px 16px",textAlign:"center",fontSize:11,fontWeight:700,color:C.textLight,letterSpacing:".04em",textTransform:"uppercase",whiteSpace:"nowrap"}}>Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineMonths.map((m,i)=>{
                      const rows = monthlyExpenses[m]||[];
                      const tot  = rows.reduce((s,e)=>s+Number(e.value||0),0);
                      const fix  = rows.filter(e=>e.type==="fixa").reduce((s,e)=>s+Number(e.value||0),0);
                      const vari = rows.filter(e=>e.type==="variavel").reduce((s,e)=>s+Number(e.value||0),0);
                      const bal  = Number(salary||0) - tot;
                      const isActive = m===planMonth;
                      const isNow    = m===new Date().toISOString().slice(0,7);
                      return (
                        <tr key={m} onClick={()=>setPlanMonth(m)}
                          style={{cursor:"pointer",background:isActive?"#FFF0F3":"transparent",borderBottom:`1px solid ${C.border}`,transition:"background .12s"}}
                          onMouseOver={ev=>{if(!isActive)ev.currentTarget.style.background=C.bgSoft;}}
                          onMouseOut={ev=>{if(!isActive)ev.currentTarget.style.background="transparent";}}>
                          <td style={{padding:"12px 16px",whiteSpace:"nowrap"}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              {isActive&&<div style={{width:4,height:4,borderRadius:"50%",background:C.coral,flexShrink:0}}/>}
                              <span style={{fontSize:13,fontWeight:isActive?700:500,color:isActive?C.coral:C.text}}>{MONTHS_FULL[i]}</span>
                              {isNow&&<span style={{fontSize:9,fontWeight:700,color:C.green,background:C.greenLight,borderRadius:100,padding:"1px 7px"}}>ATUAL</span>}
                            </div>
                          </td>
                          <td style={{padding:"12px",textAlign:"right",fontSize:13,fontWeight:700,color:tot>0?C.text:C.textLight}}>{tot>0?formatBRL(tot):"—"}</td>
                          <td style={{padding:"12px",textAlign:"right",fontSize:12,color:fix>0?C.blue:C.textLight}}>{fix>0?formatBRL(fix):"—"}</td>
                          <td style={{padding:"12px",textAlign:"right",fontSize:12,color:vari>0?C.amber:C.textLight}}>{vari>0?formatBRL(vari):"—"}</td>
                          <td style={{padding:"12px",textAlign:"right",fontSize:13,fontWeight:700,color:tot===0?C.textLight:bal>=0?C.green:C.coral}}>{tot>0?formatBRL(bal):"—"}</td>
                          <td style={{padding:"12px 16px",textAlign:"center"}}>
                            {rows.length>0
                              ?<span style={{fontSize:12,fontWeight:700,color:isActive?C.coral:C.textMid,background:isActive?C.coralLight:C.bgSoft,borderRadius:100,padding:"2px 9px"}}>{rows.length}</span>
                              :<span style={{fontSize:12,color:C.textLight}}>0</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Annual total row */}
                  <tfoot>
                    <tr style={{background:C.bgSoft,borderTop:`2px solid ${C.border}`}}>
                      <td style={{padding:"12px 16px",fontSize:13,fontWeight:800}}>Total anual</td>
                      <td style={{padding:"12px",textAlign:"right",fontSize:14,fontWeight:800,color:C.coral}}>
                        {formatBRL(timelineMonths.reduce((s,m)=>{const rows=monthlyExpenses[m]||[];return s+rows.reduce((ss,e)=>ss+Number(e.value||0),0);},0))}
                      </td>
                      <td style={{padding:"12px",textAlign:"right",fontSize:12,fontWeight:700,color:C.blue}}>
                        {formatBRL(timelineMonths.reduce((s,m)=>{const rows=(monthlyExpenses[m]||[]).filter(e=>e.type==="fixa");return s+rows.reduce((ss,e)=>ss+Number(e.value||0),0);},0))}
                      </td>
                      <td style={{padding:"12px",textAlign:"right",fontSize:12,fontWeight:700,color:C.amber}}>
                        {formatBRL(timelineMonths.reduce((s,m)=>{const rows=(monthlyExpenses[m]||[]).filter(e=>e.type==="variavel");return s+rows.reduce((ss,e)=>ss+Number(e.value||0),0);},0))}
                      </td>
                      <td colSpan={2}/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            {/* Add expense modal */}
          </div>
          );
        })()}

        {/* UPLOAD EXTRATOS — Modal (triggered from expenses tab) */}
        {showUploadModal&&(
          <div style={{position:"fixed",inset:0,zIndex:600,display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",background:"rgba(0,0,0,.5)",backdropFilter:"blur(6px)"}}
            onClick={()=>{setShowUploadModal(false);setUploadFiles([]);setUploadResults(null);setUploadSelected({});setUploadError("");}}>
            <div style={{position:"relative",width:"100%",maxWidth:mob?"100%":600,maxHeight:mob?"92vh":"88vh",background:"#fff",borderRadius:mob?"24px 24px 0 0":20,display:"flex",flexDirection:"column",overflow:"hidden",animation:"fadeUp .25s ease both"}}
              onClick={e=>e.stopPropagation()}>

              {/* Modal Header */}
              <div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${C.border}`,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:38,height:38,borderRadius:11,background:C.coralLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📂</div>
                  <div>
                    <div style={{fontSize:15,fontWeight:800}}>Importar Extratos e Recibos</div>
                    <div style={{fontSize:12,color:C.textMid,marginTop:1}}>A IA lê e organiza seus gastos automaticamente</div>
                  </div>
                </div>
                <button onClick={()=>{setShowUploadModal(false);setUploadFiles([]);setUploadResults(null);setUploadSelected({});setUploadError("");}}
                  style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.textMid,flexShrink:0}}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/></svg>
                </button>
              </div>

              {/* Modal Body */}
              <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"flex",flexDirection:"column",gap:16}}>

              {!uploadResults ? (<>
                {/* Drop zone */}
                <div
                  style={{border:`2px dashed ${uploadDrag?C.coral:C.border}`,background:uploadDrag?C.coralLight:"#fff",borderRadius:14,transition:"all .18s",cursor:"pointer"}}
                  onDragOver={e=>{e.preventDefault();setUploadDrag(true);}}
                  onDragLeave={()=>setUploadDrag(false)}
                  onDrop={e=>{e.preventDefault();setUploadDrag(false);const nf=Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith("image/")||f.type==="application/pdf");setUploadFiles(p=>[...p,...nf].slice(0,5));}}
                  onClick={()=>document.getElementById("upload-file-input-modal").click()}>
                  <div style={{padding:"32px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:10,textAlign:"center"}}>
                    <div style={{width:52,height:52,borderRadius:14,background:uploadDrag?C.coralMid:C.bgSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,transition:"all .18s"}}>{uploadDrag?"📥":"📄"}</div>
                    <div style={{fontSize:14,fontWeight:700,color:uploadDrag?C.coral:C.text}}>{uploadDrag?"Solte os arquivos aqui":"Arraste ou clique para selecionar"}</div>
                    <div style={{fontSize:12,color:C.textMid}}>PDF, JPG, PNG · até 5 arquivos</div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
                      {[{icon:"🏦",label:"Extrato bancário"},{icon:"🧾",label:"Nota fiscal"},{icon:"📃",label:"Recibo"},{icon:"💳",label:"Fatura cartão"}].map(t=>(
                        <span key={t.label} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,fontWeight:600,color:C.textMid,background:C.bgSoft,borderRadius:100,padding:"3px 9px",border:`1px solid ${C.border}`}}>{t.icon} {t.label}</span>
                      ))}
                    </div>
                  </div>
                  <input id="upload-file-input-modal" type="file" accept="image/*,.pdf" multiple style={{display:"none"}}
                    onChange={e=>{const nf=Array.from(e.target.files).filter(f=>f.type.startsWith("image/")||f.type==="application/pdf");setUploadFiles(p=>[...p,...nf].slice(0,5));e.target.value="";}}/>
                </div>

                {/* File list */}
                {uploadFiles.length>0&&(
                  <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                    <div style={{padding:"10px 14px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",background:C.bgSoft}}>
                      <span style={{fontSize:12,fontWeight:700,color:C.text}}>{uploadFiles.length} arquivo{uploadFiles.length>1?"s":""} selecionado{uploadFiles.length>1?"s":""}</span>
                      <button onClick={()=>setUploadFiles([])} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:C.coral,fontWeight:600,fontFamily:"inherit",padding:0}}>Remover todos</button>
                    </div>
                    {uploadFiles.map((f,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:i<uploadFiles.length-1?`1px solid ${C.border}`:"none"}}>
                        <span style={{fontSize:18,flexShrink:0}}>{f.type==="application/pdf"?"📄":"🖼️"}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                          <div style={{fontSize:11,color:C.textMid}}>{(f.size/1024).toFixed(0)} KB</div>
                        </div>
                        <button onClick={()=>setUploadFiles(p=>p.filter((_,j)=>j!==i))}
                          style={{width:22,height:22,borderRadius:6,background:"transparent",border:`1px solid ${C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.textMid}}>
                          <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {uploadError&&<div style={{background:"#FFF0F2",border:`1px solid ${C.coralMid}`,borderRadius:10,padding:"10px 14px",fontSize:13,color:C.coral,fontWeight:500}}>⚠️ {uploadError}</div>}
              </>) : (<>
                {/* Results header */}
                <div style={{background:"linear-gradient(135deg,#FFF5F7,#fff)",border:`1px solid ${C.coralMid}`,borderRadius:12,padding:"14px 16px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:800,marginBottom:2}}>✦ Análise concluída</div>
                      {uploadResults.resumo&&<div style={{fontSize:12,color:C.textMid}}>{uploadResults.resumo}</div>}
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <div style={{textAlign:"center",background:"#fff",borderRadius:9,padding:"6px 12px",border:`1px solid ${C.border}`}}>
                        <div style={{fontSize:10,color:C.textMid,fontWeight:600}}>Total</div>
                        <div style={{fontSize:14,fontWeight:800,color:C.coral}}>{formatBRL(uploadResults.total_identificado||0)}</div>
                      </div>
                      <div style={{textAlign:"center",background:"#fff",borderRadius:9,padding:"6px 12px",border:`1px solid ${C.border}`}}>
                        <div style={{fontSize:10,color:C.textMid,fontWeight:600}}>Selecionados</div>
                        <div style={{fontSize:14,fontWeight:800,color:C.green}}>{Object.values(uploadSelected).filter(Boolean).length}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Select all */}
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:C.bgSoft,borderRadius:9,border:`1px solid ${C.border}`}}>
                  <input type="checkbox"
                    checked={Object.values(uploadSelected).every(Boolean)&&Object.keys(uploadSelected).length>0}
                    onChange={e=>{const sel={};(uploadResults.despesas||[]).forEach((_,i)=>{sel[i]=e.target.checked;});setUploadSelected(sel);}}
                    style={{width:15,height:15,accentColor:C.coral,cursor:"pointer"}}/>
                  <span style={{fontSize:12,fontWeight:600,color:C.textMid,flex:1}}>Selecionar todos · {uploadResults.despesas?.length||0} itens encontrados</span>
                </div>

                {/* Items */}
                <div style={{border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
                  {(uploadResults.despesas||[]).map((d,i)=>(
                    <div key={i}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderBottom:i<(uploadResults.despesas.length-1)?`1px solid ${C.border}`:"none",background:uploadSelected[i]?"#FFF5F7":"#fff",cursor:"pointer",transition:"background .12s"}}
                      onClick={()=>setUploadSelected(p=>({...p,[i]:!p[i]}))}>
                      <input type="checkbox" checked={!!uploadSelected[i]}
                        onChange={e=>{e.stopPropagation();setUploadSelected(p=>({...p,[i]:e.target.checked}));}}
                        onClick={e=>e.stopPropagation()}
                        style={{width:14,height:14,accentColor:C.coral,cursor:"pointer",flexShrink:0}}/>
                      <div style={{width:30,height:30,borderRadius:8,background:CAT_BG[d.category]||C.bgSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{CAT_EMOJI[d.category]||"📦"}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</div>
                        <div style={{display:"flex",gap:5,marginTop:2,flexWrap:"wrap"}}>
                          <span style={{fontSize:9,fontWeight:600,color:CAT_COLORS[d.category]||C.textMid,background:CAT_BG[d.category]||C.bgSoft,borderRadius:100,padding:"1px 6px"}}>{d.category}</span>
                          <span style={{fontSize:9,fontWeight:600,color:d.type==="fixa"?C.blue:C.amber,background:d.type==="fixa"?C.blueLight:C.amberLight,borderRadius:100,padding:"1px 6px"}}>{d.type==="fixa"?"Fixa":"Variável"}</span>
                          {d.data&&<span style={{fontSize:9,color:C.textLight,padding:"1px 3px"}}>{d.data}</span>}
                        </div>
                      </div>
                      <div style={{fontSize:13,fontWeight:800,color:uploadSelected[i]?C.coral:C.textMid,flexShrink:0}}>{formatBRL(d.value)}</div>
                    </div>
                  ))}
                </div>
                {uploadResults.nao_reconhecidos?.length>0&&(
                  <div style={{background:"#FFFBEB",border:`1px solid #FDE68A`,borderRadius:10,padding:"10px 14px"}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.amber,marginBottom:3}}>⚠️ Itens não reconhecidos</div>
                    <div style={{fontSize:11,color:C.textMid,lineHeight:1.6}}>{uploadResults.nao_reconhecidos.join(" · ")}</div>
                  </div>
                )}
                {uploadError&&<div style={{background:"#FFF0F2",border:`1px solid ${C.coralMid}`,borderRadius:10,padding:"10px 14px",fontSize:13,color:C.coral,fontWeight:500}}>⚠️ {uploadError}</div>}
              </>)}

              </div>

              {/* Modal Footer */}
              <div style={{padding:"14px 24px",borderTop:`1px solid ${C.border}`,flexShrink:0,background:"#fff",display:"flex",gap:10}}>
                {!uploadResults ? (<>
                  <button onClick={()=>{setShowUploadModal(false);setUploadFiles([]);setUploadError("");}}
                    style={{flex:1,background:C.bgSoft,color:C.textMid,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    Cancelar
                  </button>
                  <button onClick={parseUploadWithAI} disabled={!uploadFiles.length||uploadLoading||(!isPro&&usage.aiImports>=limits.aiImports)}
                    className="primary-btn"
                    style={{flex:2,background:C.coral,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,cursor:uploadLoading?"wait":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 2px 8px rgba(252,23,87,.25)",opacity:(!uploadFiles.length||(!isPro&&usage.aiImports>=limits.aiImports))?0.4:1,transition:"all .18s"}}>
                    {uploadLoading?<><span className="spinner">↻</span>Analisando...</>:(!isPro&&usage.aiImports>=limits.aiImports)?"✦ Limite atingido — PRO":"✦ Analisar com IA"}
                  </button>
                </>) : (<>
                  <button onClick={()=>{setUploadResults(null);setUploadSelected({});setUploadError("");}}
                    style={{flex:1,background:C.bgSoft,color:C.textMid,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                    ↺ Novo arquivo
                  </button>
                  <button onClick={()=>{confirmUploadImport();setShowUploadModal(false);}} disabled={!Object.values(uploadSelected).some(Boolean)}
                    className="primary-btn"
                    style={{flex:2,background:C.coral,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 2px 8px rgba(252,23,87,.25)",opacity:!Object.values(uploadSelected).some(Boolean)?0.35:1,transition:"all .18s"}}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Adicionar {Object.values(uploadSelected).filter(Boolean).length} despesa{Object.values(uploadSelected).filter(Boolean).length!==1?"s":""}
                  </button>
                </>)}
              </div>
            </div>
          </div>
        )}

        {/* HELP */}

        {activeTab==="banco"&&(()=>{
          const BankLogo = ({id,size=32}) => {
            const s = size;
            const logos = {
              nubank: (
                <svg width={s} height={s} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="22" fill="#820AD1"/>
                  <path d="M28 30h14l30 40H58L28 30z" fill="white"/>
                  <path d="M58 30h14v40H58V30z" fill="white"/>
                  <path d="M28 30h14v40H28V30z" fill="white"/>
                </svg>
              ),
              itau: (
                <svg width={s} height={s} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="22" fill="#EC7000"/>
                  <text x="50" y="68" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="38" fill="white">itaú</text>
                </svg>
              ),
              bradesco: (
                <svg width={s} height={s} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="22" fill="#CC092F"/>
                  <circle cx="50" cy="38" r="16" fill="none" stroke="white" strokeWidth="5"/>
                  <line x1="50" y1="22" x2="50" y2="14" stroke="white" strokeWidth="5" strokeLinecap="round"/>
                  <line x1="50" y1="54" x2="50" y2="80" stroke="white" strokeWidth="5" strokeLinecap="round"/>
                  <line x1="34" y1="38" x2="16" y2="38" stroke="white" strokeWidth="5" strokeLinecap="round"/>
                  <line x1="66" y1="38" x2="84" y2="38" stroke="white" strokeWidth="5" strokeLinecap="round"/>
                  <circle cx="50" cy="38" r="6" fill="white"/>
                </svg>
              ),
              bb: (
                <svg width={s} height={s} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="22" fill="#F9CC00"/>
                  <path d="M50 18L82 68H18L50 18Z" fill="#003882"/>
                  <path d="M50 82L18 32h64L50 82Z" fill="#003882" opacity="0.5"/>
                  <circle cx="50" cy="50" r="12" fill="#F9CC00"/>
                </svg>
              ),
              caixa: (
                <svg width={s} height={s} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="22" fill="#005CA9"/>
                  <rect x="14" y="28" width="72" height="44" rx="6" fill="none" stroke="white" strokeWidth="5"/>
                  <text x="50" y="57" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="18" fill="white">CAIXA</text>
                </svg>
              ),
              santander: (
                <svg width={s} height={s} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="22" fill="#EC0000"/>
                  <path d="M50 20C50 20 30 35 30 52C30 63.05 39.0 72 50 72C61.0 72 70 63.05 70 52C70 35 50 20 50 20Z" fill="white" opacity="0.95"/>
                  <path d="M50 32C50 32 36 43 36 54C36 61.7 42.3 68 50 68C57.7 68 64 61.7 64 54C64 43 50 32 50 32Z" fill="#EC0000"/>
                  <circle cx="50" cy="54" r="8" fill="white"/>
                </svg>
              ),
              inter: (
                <svg width={s} height={s} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="22" fill="#FF7A00"/>
                  <circle cx="50" cy="50" r="26" fill="none" stroke="white" strokeWidth="6"/>
                  <circle cx="50" cy="50" r="10" fill="white"/>
                  <line x1="50" y1="14" x2="50" y2="24" stroke="white" strokeWidth="6" strokeLinecap="round"/>
                  <line x1="50" y1="76" x2="50" y2="86" stroke="white" strokeWidth="6" strokeLinecap="round"/>
                  <line x1="14" y1="50" x2="24" y2="50" stroke="white" strokeWidth="6" strokeLinecap="round"/>
                  <line x1="76" y1="50" x2="86" y2="50" stroke="white" strokeWidth="6" strokeLinecap="round"/>
                </svg>
              ),
              c6: (
                <svg width={s} height={s} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="100" height="100" rx="22" fill="#1A1A1A"/>
                  <text x="50" y="62" textAnchor="middle" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="36" fill="white">C6</text>
                </svg>
              ),
            };
            return logos[id] || <svg width={s} height={s} viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#E5E7EB"/><text x="50" y="62" textAnchor="middle" fontFamily="Arial" fontSize="36" fill="#9CA3AF">🏦</text></svg>;
          };
          const BANKS = [
            {id:"nubank",   name:"Nubank",        color:"#820AD1", bg:"#F5EEFF"},
            {id:"itau",     name:"Itaú",           color:"#EC7000", bg:"#FFF3E8"},
            {id:"bradesco", name:"Bradesco",       color:"#CC092F", bg:"#FFF0F2"},
            {id:"bb",       name:"Banco do Brasil",color:"#F9CC00", bg:"#FEFCE8"},
            {id:"caixa",    name:"Caixa",          color:"#005CA9", bg:"#EEF5FF"},
            {id:"santander",name:"Santander",      color:"#EC0000", bg:"#FFF0F0"},
            {id:"inter",    name:"Inter",          color:"#FF7A00", bg:"#FFF4EB"},
            {id:"c6",       name:"C6 Bank",        color:"#1A1A1A", bg:"#F5F5F5"},
          ];
          const DEMO_TXNS = [
            {id:"t1",date:bankDailyDate,desc:"iFood",          amount:-45.90, category:"Alimentação",   account:"Nubank"},
            {id:"t2",date:bankDailyDate,desc:"Posto Ipiranga", amount:-180.00,category:"Transporte",    account:"Nubank"},
            {id:"t3",date:bankDailyDate,desc:"Farmácia São João",amount:-62.40,category:"Saúde",        account:"Itaú"},
            {id:"t4",date:bankDailyDate,desc:"Pix recebido",   amount:+500.00, category:"Receita",      account:"Nubank"},
            {id:"t5",date:bankDailyDate,desc:"Netflix",        amount:-55.90, category:"Lazer",         account:"Nubank"},
            {id:"t6",date:bankDailyDate,desc:"Supermercado Extra",amount:-234.70,category:"Alimentação",account:"Itaú"},
            {id:"t7",date:bankDailyDate,desc:"Uber",           amount:-23.50, category:"Transporte",    account:"Nubank"},
            {id:"t8",date:bankDailyDate,desc:"Academia Smart Fit",amount:-109.90,category:"Saúde",      account:"Nubank"},
          ];
          const allTxns = bankTxns.length ? bankTxns : (bankConnections.length ? DEMO_TXNS : []);
          const dayTxns = allTxns.filter(t=>t.date===bankDailyDate);
          const catMap = {};
          dayTxns.filter(t=>t.amount<0).forEach(t=>{
            if(!catMap[t.category]) catMap[t.category]={total:0,count:0,txns:[]};
            catMap[t.category].total += Math.abs(t.amount);
            catMap[t.category].count++;
            catMap[t.category].txns.push(t);
          });
          const dayTotal = dayTxns.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
          const dayIncome = dayTxns.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
          const CAT_COLOR = {"Alimentação":C.coral,"Transporte":C.blue,"Saúde":C.green,"Lazer":C.purple,"Moradia":C.amber,"Educação":"#0891B2","Receita":C.green,"Outros":C.textMid};
          const CAT_BG    = {"Alimentação":C.coralLight,"Transporte":C.blueLight,"Saúde":C.greenLight,"Lazer":"#F5F0FF","Moradia":C.amberLight,"Educação":"#ECFEFF","Receita":C.greenLight,"Outros":C.bgSoft};
          const CAT_ICON  = {"Alimentação":"🍽️","Transporte":"🚗","Saúde":"💊","Lazer":"🎬","Moradia":"🏠","Educação":"📚","Receita":"💰","Outros":"📦"};
          const prevDay=()=>{const d=new Date(bankDailyDate);d.setDate(d.getDate()-1);setBankDailyDate(d.toISOString().slice(0,10));};
          const nextDay=()=>{const d=new Date(bankDailyDate);d.setDate(d.getDate()+1);const t=new Date();t.setHours(0,0,0,0);if(d<=t)setBankDailyDate(d.toISOString().slice(0,10));};
          const fmtDate=(s)=>{const d=new Date(s+"T12:00:00");return d.toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long"});};
          const isToday = bankDailyDate===new Date().toISOString().slice(0,10);

          const simulateSync=()=>{
            setBankStep("syncing");
            setTimeout(()=>{
              setBankConnections(prev=>[...prev,{id:Date.now(),bank:bankSelected,lastSync:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),status:"active"}]);
              setBankTxns(DEMO_TXNS);
              setBankStep("done");
            },2800);
          };

          return (
            <div className="fade-up">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:mob?16:24,flexWrap:"wrap",gap:10}}>
                <div>
                  <div style={{fontSize:mob?18:20,fontWeight:800,letterSpacing:"-.02em",marginBottom:3}}>Conexões Bancárias</div>
                  <div style={{fontSize:13,color:C.textMid}}>Sincronize sua conta e veja seus gastos automaticamente</div>
                </div>
                {bankConnections.length>0&&(
                  <button onClick={()=>{setBankStep("select");setBankConnecting(true);}}
                    style={{display:"flex",alignItems:"center",gap:7,background:C.coral,color:"#fff",border:"none",borderRadius:10,padding:"10px 16px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 10px rgba(252,23,87,.25)"}}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>
                    Conectar banco
                  </button>
                )}
              </div>

              {/* ── No connections yet ──────────────────────────────────────── */}
              {bankConnections.length===0&&bankStep===null&&(
                <Card style={{padding:mob?24:48,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
                  <div style={{width:72,height:72,borderRadius:20,background:"linear-gradient(135deg,#EFF6FF,#DBEAFE)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32}}>🏦</div>
                  <div>
                    <div style={{fontSize:18,fontWeight:800,marginBottom:8}}>Conecte seu banco</div>
                    <div style={{fontSize:14,color:C.textMid,lineHeight:1.7,maxWidth:420,margin:"0 auto"}}>
                      Autorize o acesso de leitura às suas transações via Open Banking.<br/>
                      <strong>Nunca solicitamos senha</strong> — usamos autenticação segura do banco.
                    </div>
                  </div>
                  <div style={{display:"flex",gap:16,flexWrap:"wrap",justifyContent:"center",margin:"8px 0"}}>
                    {["🔒 Conexão segura (OAuth)","👁️ Somente leitura","✦ Atualização automática"].map(f=>(
                      <div key={f} style={{fontSize:12,fontWeight:600,color:C.textMid,background:C.bgSoft,borderRadius:100,padding:"5px 12px",border:`1px solid ${C.border}`}}>{f}</div>
                    ))}
                  </div>
                  <button onClick={()=>{setBankStep("select");setBankConnecting(true);}}
                    style={{background:C.coral,color:"#fff",border:"none",borderRadius:12,padding:"14px 32px",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 16px rgba(252,23,87,.3)",marginTop:8}}>
                    🏦 Conectar meu banco
                  </button>
                  <div style={{fontSize:11,color:C.textLight}}>Compatível com Open Banking Brasil · regulamentado pelo Banco Central</div>
                </Card>
              )}

              {/* ── Connection wizard ───────────────────────────────────────── */}
              {bankConnecting&&bankStep!=="done"&&(
                <Card style={{padding:mob?20:32,marginBottom:18}}>
                  {/* Step: select bank */}
                  {bankStep==="select"&&(<>
                    <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>Selecione seu banco</div>
                    <div style={{fontSize:12,color:C.textMid,marginBottom:18}}>Você será redirecionado para o app do banco para autorizar</div>
                    <div style={{display:"grid",gridTemplateColumns:mob?"repeat(2,1fr)":"repeat(4,1fr)",gap:10}}>
                      {BANKS.map(b=>(
                        <button key={b.id} onClick={()=>{setBankSelected(b);setBankStep("auth");}}
                          style={{background:bankSelected?.id===b.id?b.bg:"#fff",border:`2px solid ${bankSelected?.id===b.id?b.color:C.border}`,borderRadius:12,padding:"14px 10px",cursor:"pointer",fontFamily:"inherit",display:"flex",flexDirection:"column",alignItems:"center",gap:6,transition:"all .15s"}}
                          onMouseOver={e=>{e.currentTarget.style.borderColor=b.color;e.currentTarget.style.background=b.bg;}}
                          onMouseOut={e=>{if(bankSelected?.id!==b.id){e.currentTarget.style.borderColor=C.border;e.currentTarget.style.background="#fff";}}}>
                          <BankLogo id={b.id} size={36}/>
                          <span style={{fontSize:11,fontWeight:700,color:C.text}}>{b.name}</span>
                        </button>
                      ))}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginTop:20,gap:10}}>
                      <button onClick={()=>{setBankStep(null);setBankConnecting(false);setBankSelected(null);}}
                        style={{background:C.bgSoft,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 20px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:C.textMid}}>Cancelar</button>
                      {bankSelected&&(
                        <button onClick={()=>setBankStep("auth")}
                          style={{background:bankSelected.color,color:"#fff",border:"none",borderRadius:9,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                          Continuar com {bankSelected.name} →
                        </button>
                      )}
                    </div>
                  </>)}

                  {/* Step: auth */}
                  {bankStep==="auth"&&bankSelected&&(<>
                    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
                      <div style={{width:44,height:44,borderRadius:12,background:bankSelected.bg,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}><BankLogo id={bankSelected.id} size={44}/></div>
                      <div>
                        <div style={{fontWeight:800,fontSize:15}}>{bankSelected.name}</div>
                        <div style={{fontSize:12,color:C.textMid}}>Autorização via Open Banking</div>
                      </div>
                    </div>
                    <div style={{background:C.bgSoft,borderRadius:12,padding:"16px 20px",marginBottom:20,border:`1px solid ${C.border}`}}>
                      <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>O Se Poupe solicita permissão para:</div>
                      {["✅ Ler extrato e transações (somente leitura)","✅ Verificar saldo disponível","❌ Nunca movimenta dinheiro","❌ Nunca acessa sua senha"].map(p=>(
                        <div key={p} style={{fontSize:12,color:p.startsWith("❌")?C.textMid:C.text,marginBottom:6,fontWeight:p.startsWith("✅")?600:400}}>{p}</div>
                      ))}
                    </div>
                    <div style={{fontSize:11,color:C.textLight,marginBottom:16,lineHeight:1.6,padding:"10px 14px",background:"#FFFBEB",borderRadius:9,border:"1px solid #FDE68A"}}>
                      ⚠️ Em produção, você será redirecionado para o app do {bankSelected.name} para autenticar com sua biometria ou senha. Esta é uma demonstração do fluxo.
                    </div>
                    <div style={{display:"flex",gap:10}}>
                      <button onClick={()=>setBankStep("select")}
                        style={{flex:1,background:C.bgSoft,border:`1px solid ${C.border}`,borderRadius:9,padding:"11px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:C.textMid}}>Voltar</button>
                      <button onClick={simulateSync}
                        style={{flex:2,background:bankSelected.color,color:"#fff",border:"none",borderRadius:9,padding:"11px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 2px 10px ${bankSelected.color}44`}}>
                        🔒 Autorizar no {bankSelected.name}
                      </button>
                    </div>
                  </>)}

                  {/* Step: syncing */}
                  {bankStep==="syncing"&&(<>
                    <div style={{textAlign:"center",padding:"32px 0"}}>
                      <div style={{fontSize:36,marginBottom:16}}>⟳</div>
                      <div style={{fontWeight:800,fontSize:16,marginBottom:8}}>Sincronizando transações...</div>
                      <div style={{fontSize:13,color:C.textMid,marginBottom:24}}>Buscando seus lançamentos dos últimos 90 dias</div>
                      {["Autenticando com {bankSelected?.name}...","Lendo transações...","Classificando por categoria...","Concluindo..."].map((s,i)=>(
                        <div key={i} style={{fontSize:12,color:C.textMid,marginBottom:6,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                          <div style={{width:6,height:6,borderRadius:"50%",background:C.coral,animation:`pulse ${1+i*0.4}s ease infinite`,flexShrink:0}}/>{s.replace("{bankSelected?.name}",bankSelected?.name||"")}
                        </div>
                      ))}
                    </div>
                  </>)}
                </Card>
              )}

              {/* ── Done / connected banks ──────────────────────────────────── */}
              {bankStep==="done"&&(
                <div style={{background:"linear-gradient(135deg,#F0FFF4,#DCFCE7)",border:`1.5px solid ${C.green}50`,borderRadius:14,padding:"16px 20px",marginBottom:16,display:"flex",alignItems:"center",gap:12}}>
                  <div style={{fontSize:22}}>✅</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:14,color:C.green}}>Banco conectado com sucesso!</div>
                    <div style={{fontSize:12,color:C.textMid}}>Suas transações já estão disponíveis abaixo</div>
                  </div>
                  <button onClick={()=>{setBankStep(null);setBankConnecting(false);}} style={{marginLeft:"auto",background:"transparent",border:"none",cursor:"pointer",color:C.textMid,fontSize:18}}>×</button>
                </div>
              )}

              {/* ── Connected banks list ────────────────────────────────────── */}
              {bankConnections.length>0&&(
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:18}}>
                  {bankConnections.map(c=>{
                    const b=BANKS.find(x=>x.id===c.bank?.id)||c.bank||BANKS[0];
                    const [confirmDisc,setConfirmDisc] = [c._confirm,v=>setBankConnections(prev=>prev.map(x=>x.id===c.id?{...x,_confirm:v}:x))];
                    return (
                      <div key={c.id} style={{background:"#fff",border:`1.5px solid ${confirmDisc?C.coral+"60":C.green+"40"}`,borderRadius:14,padding:"12px 16px",boxShadow:"0 1px 6px rgba(0,0,0,.07)",minWidth:220,transition:"border-color .2s"}}>
                        {!confirmDisc ? (
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:36,height:36,borderRadius:10,overflow:"hidden",flexShrink:0}}><BankLogo id={b.id} size={36}/></div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontWeight:700,fontSize:13}}>{b.name||"Banco"}</div>
                              <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
                                <div style={{width:6,height:6,borderRadius:"50%",background:C.green,flexShrink:0}}/>
                                <div style={{fontSize:11,color:C.textMid}}>Sync: {c.lastSync}</div>
                              </div>
                            </div>
                            <button onClick={()=>setConfirmDisc(true)}
                              style={{width:28,height:28,borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.textLight,flexShrink:0,transition:"all .15s"}}
                              title="Desconectar banco"
                              onMouseOver={e=>{e.currentTarget.style.borderColor=C.coral;e.currentTarget.style.color=C.coral;e.currentTarget.style.background=C.coralLight;}}
                              onMouseOut={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textLight;e.currentTarget.style.background="transparent";}}>
                              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1={21} y1={12} x2={9} y2={12}/></svg>
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                              <span style={{fontSize:16}}>⚠️</span>
                              <div style={{fontSize:12,fontWeight:700,color:C.coral}}>Desconectar {b.name}?</div>
                            </div>
                            <div style={{fontSize:11,color:C.textMid,marginBottom:12,lineHeight:1.5}}>Suas transações importadas não serão apagadas, mas a sincronização automática será encerrada.</div>
                            <div style={{display:"flex",gap:8}}>
                              <button onClick={()=>setConfirmDisc(false)}
                                style={{flex:1,background:C.bgSoft,border:`1px solid ${C.border}`,borderRadius:8,padding:"7px 0",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:C.textMid}}>
                                Cancelar
                              </button>
                              <button onClick={()=>{setBankConnections(prev=>prev.filter(x=>x.id!==c.id));if(bankConnections.length===1)setBankTxns([]);}}
                                style={{flex:1,background:C.coral,border:"none",borderRadius:8,padding:"7px 0",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",color:"#fff"}}>
                                Desconectar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Daily view ──────────────────────────────────────────────── */}
              {bankConnections.length>0&&(
                <div style={{display:"flex",flexDirection:"column",gap:mob?12:16}}>
                  {/* Date navigator */}
                  <Card style={{padding:mob?"12px 16px":"14px 20px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                      <button onClick={prevDay}
                        style={{width:34,height:34,borderRadius:9,border:`1px solid ${C.border}`,background:C.bgSoft,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.textMid}}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
                      </button>
                      <div style={{textAlign:"center"}}>
                        <div style={{fontWeight:800,fontSize:14,textTransform:"capitalize"}}>{fmtDate(bankDailyDate)}</div>
                        {isToday&&<div style={{fontSize:10,fontWeight:700,color:C.coral,background:C.coralLight,borderRadius:100,padding:"1px 8px",display:"inline-block",marginTop:2}}>HOJE</div>}
                      </div>
                      <button onClick={nextDay}
                        style={{width:34,height:34,borderRadius:9,border:`1px solid ${C.border}`,background:isToday?C.bgSoft:"#fff",cursor:isToday?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:isToday?C.border:C.textMid,opacity:isToday?.4:1}}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                      </button>
                    </div>
                  </Card>

                  {/* Day KPIs */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:mob?8:12}}>
                    {[
                      {label:"Gastos do dia",   val:formatBRL(dayTotal),   color:C.coral,  bg:C.coralLight,  icon:"💸"},
                      {label:"Receitas do dia",  val:formatBRL(dayIncome),  color:C.green,  bg:C.greenLight,  icon:"💰"},
                      {label:"Saldo do dia",     val:formatBRL(dayIncome-dayTotal), color:(dayIncome-dayTotal)>=0?C.green:C.coral, bg:(dayIncome-dayTotal)>=0?C.greenLight:C.coralLight, icon:(dayIncome-dayTotal)>=0?"📈":"📉"},
                    ].map(k=>(
                      <Card key={k.label} style={{padding:mob?"12px":"16px 18px",background:k.bg,border:"none"}}>
                        <div style={{fontSize:mob?16:18,marginBottom:4}}>{k.icon}</div>
                        <div style={{fontSize:mob?13:15,fontWeight:800,color:k.color}}>{k.val}</div>
                        <div style={{fontSize:10,color:C.textMid,fontWeight:600,marginTop:2}}>{k.label}</div>
                      </Card>
                    ))}
                  </div>

                  {/* Category cards */}
                  {Object.keys(catMap).length>0&&(
                    <div>
                      <div style={{fontWeight:700,fontSize:13,color:C.textMid,marginBottom:10}}>Gastos por categoria</div>
                      <div style={{display:"grid",gridTemplateColumns:mob?"1fr 1fr":"repeat(4,1fr)",gap:mob?8:10}}>
                        {Object.entries(catMap).sort((a,b)=>b[1].total-a[1].total).map(([cat,data])=>{
                          const pct = dayTotal>0 ? (data.total/dayTotal*100).toFixed(0) : 0;
                          const col = CAT_COLOR[cat]||C.textMid;
                          const bg  = CAT_BG[cat]||C.bgSoft;
                          const ico = CAT_ICON[cat]||"📦";
                          return (
                            <Card key={cat} style={{padding:mob?"12px":"14px 16px",background:bg,border:`1.5px solid ${col}20`,cursor:"default"}}>
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                                <span style={{fontSize:18}}>{ico}</span>
                                <span style={{fontSize:10,fontWeight:800,color:col,background:"#fff",borderRadius:100,padding:"2px 7px"}}>{pct}%</span>
                              </div>
                              <div style={{fontWeight:800,fontSize:13,color:col}}>{formatBRL(data.total)}</div>
                              <div style={{fontSize:11,color:C.textMid,marginTop:2}}>{cat}</div>
                              <div style={{fontSize:10,color:C.textLight,marginTop:1}}>{data.count} transação{data.count!==1?"s":""}</div>
                              <div style={{marginTop:8,height:3,borderRadius:100,background:"#fff",overflow:"hidden"}}>
                                <div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:100,transition:"width .5s"}}/>
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Transaction timeline */}
                  <Card style={{padding:mob?16:20}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,gap:10}}>
                      <div style={{fontWeight:800,fontSize:14}}>Todas as transações</div>
                      {dayTxns.length>0&&(
                        <button onClick={()=>{
                          const toAdd=dayTxns.filter(t=>t.amount<0&&bankImportSel[t.id]!==false);
                          toAdd.forEach(t=>{ if(expenses.length<limits.expenses) addExpenseFromTxn(t); });
                          setBankImportSel({});
                        }} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:700,color:C.blue,background:C.blueLight,border:`1px solid ${C.blue}30`,borderRadius:100,padding:"4px 11px",cursor:"pointer",fontFamily:"inherit"}}>
                          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="16 16 12 12 8 16"/><line x1={12} y1={12} x2={12} y2={21}/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                          Importar selecionados
                        </button>
                      )}
                    </div>
                    {dayTxns.length===0?(
                      <div style={{textAlign:"center",padding:"32px 0",color:C.textLight,fontSize:13}}>
                        <div style={{fontSize:28,marginBottom:8}}>📭</div>
                        Nenhuma transação neste dia
                      </div>
                    ):(
                      <div style={{display:"flex",flexDirection:"column",gap:2}}>
                        {dayTxns.map((t,i)=>{
                          const col = t.amount>0 ? C.green : (CAT_COLOR[t.category]||C.textMid);
                          const ico = t.amount>0 ? "💰" : (CAT_ICON[t.category]||"📦");
                          const sel = bankImportSel[t.id]!==false && t.amount<0;
                          return (
                            <div key={t.id} onClick={()=>t.amount<0&&setBankImportSel(s=>({...s,[t.id]:!sel}))}
                              style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,background:sel&&t.amount<0?"#F0F7FF":"transparent",border:`1px solid ${sel&&t.amount<0?C.blue+"30":"transparent"}`,cursor:t.amount<0?"pointer":"default",transition:"all .12s"}}>
                              {t.amount<0&&(
                                <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${sel?C.blue:C.border}`,background:sel?C.blue:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .12s"}}>
                                  {sel&&<svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                                </div>
                              )}
                              {t.amount>0&&<div style={{width:16,flexShrink:0}}/>}
                              <div style={{width:34,height:34,borderRadius:10,background:t.amount>0?C.greenLight:(CAT_BG[t.category]||C.bgSoft),display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{ico}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.desc}</div>
                                <div style={{fontSize:11,color:C.textMid}}>{t.category} · {t.account}</div>
                              </div>
                              <div style={{fontWeight:800,fontSize:14,color:col,flexShrink:0}}>
                                {t.amount>0?"+":""}{formatBRL(Math.abs(t.amount))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </div>
          );
        })()}

        {activeTab==="help"&&(
          <div className="fade-up">
            <div style={{marginBottom:mob?16:24}}>
              <div style={{fontSize:mob?18:20,fontWeight:800,letterSpacing:"-.02em",marginBottom:4}}>Central de Dúvidas</div>
              <div style={{fontSize:13,color:C.textMid}}>Tudo que você precisa para começar bem</div>
            </div>
            <Card style={{padding:mob?16:28,marginBottom:mob?12:18}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
                <div style={{width:32,height:32,borderRadius:9,background:C.coralLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🚀</div>
                <div style={{fontWeight:800,fontSize:15}}>Como começar — passo a passo</div>
              </div>
              {[
                {n:1,icon:"💼",color:C.coral,title:"Configure seu salário",desc:"Vá até Início e informe seu salário líquido (após INSS e IR). É a base de todos os cálculos.",tab:"overview",cta:"Ir para Início"},
                {n:2,icon:"📥",color:C.blue,title:"Adicione suas despesas",desc:"Na aba Despesas, cole sua lista ou adicione manualmente. A IA reconhece qualquer formato.",tab:"expenses",cta:"Ir para Despesas"},
                {n:3,icon:"🎯",color:C.purple,title:"Defina seus objetivos",desc:"Em Objetivos, cadastre seus sonhos com custo e prazo — ou deixe em branco para a IA estimar.",tab:"goals",cta:"Ir para Objetivos"},
                {n:4,icon:"✦",color:C.coral,title:"Gere sua análise com IA",desc:"Em Análise, clique em Gerar. Você recebe dicas de economia, investimentos e plano para cada objetivo.",tab:"ai",cta:"Ir para Análise"},
              ].map((s,i,arr)=>(
                <div key={s.n} style={{display:"flex",gap:mob?14:18}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
                    <div style={{width:38,height:38,borderRadius:"50%",background:s.color+"15",border:`2px solid ${s.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{s.icon}</div>
                    {i<arr.length-1&&<div style={{width:2,flex:1,background:C.border,minHeight:16,margin:"4px 0"}}/>}
                  </div>
                  <div style={{flex:1,paddingBottom:i<arr.length-1?22:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:5}}>
                      <span style={{fontSize:10,fontWeight:700,color:s.color,background:s.color+"15",borderRadius:100,padding:"2px 9px"}}>Passo {s.n}</span>
                      <span style={{fontSize:14,fontWeight:700}}>{s.title}</span>
                    </div>
                    <p style={{fontSize:12,color:C.textMid,lineHeight:1.65,marginBottom:8}}>{s.desc}</p>
                    <button onClick={()=>setActiveTab(s.tab)}
                      style={{background:"none",border:`1.5px solid ${s.color}`,color:s.color,borderRadius:7,padding:"5px 13px",fontSize:11,fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}
                      onMouseOver={e=>{e.currentTarget.style.background=s.color;e.currentTarget.style.color="#fff";}}
                      onMouseOut={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=s.color;}}>
                      {s.cta} →
                    </button>
                  </div>
                </div>
              ))}
            </Card>
            <Card style={{padding:mob?16:24}}>
              <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>Perguntas frequentes</div>
              <div style={{fontSize:12,color:C.textMid,marginBottom:16}}>Toque numa pergunta para ver a resposta</div>
              {[
                {q:"Meus dados ficam salvos entre sessões?",a:"Os dados de login ficam salvos no storage do app. O histórico financeiro (despesas, objetivos) fica na sessão atual. Em breve: sincronização em nuvem."},
                {q:"A IA usa meus dados de forma segura?",a:"Seus dados são enviados apenas para gerar análises dentro do app. Nada é armazenado externamente."},
                {q:"Posso importar extrato em PDF?",a:"Por enquanto aceitamos texto. Cole o conteúdo do extrato e a IA identifica os gastos automaticamente."},
                {q:"O que é o Score Financeiro?",a:"Pontuação de 0 a 100 com base na taxa de reserva, distribuição de gastos e objetivos. Acima de 70 é excelente!"},
                {q:"Como a IA calcula meus objetivos?",a:"Divide o custo estimado pelo prazo em meses e sugere uma estratégia compatível com seu saldo livre."},
                {q:"Funciona no celular?",a:"Sim! O Se Poupe é totalmente responsivo. App nativo está em desenvolvimento."},
              ].map((f,i,arr)=><FaqItem key={i} q={f.q} a={f.a} isLast={i===arr.length-1}/>)}
            </Card>
          </div>
        )}
      </main>

      {/* ── Mobile Bottom Nav — 4 tabs only ─────────────────────── */}
      {mob&&(
        <nav style={{position:"fixed",bottom:0,left:0,right:0,background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-around",alignItems:"center",padding:"6px 0 env(safe-area-inset-bottom,6px)",zIndex:100,boxShadow:"0 -2px 12px rgba(0,0,0,.06)"}}>
          {TABS.filter(t=>["overview","expenses","goals","planning","banco"].includes(t.id)).map(t=>(
            <button key={t.id} className="bnav-btn" onClick={()=>setActiveTab(t.id)}
              style={{color:activeTab===t.id?C.coral:C.textLight}}>
              <div style={{transition:"transform .15s",transform:activeTab===t.id?"scale(1.15)":"scale(1)"}}>
                {t.icon}
              </div>
              <span style={{fontSize:9,fontWeight:activeTab===t.id?700:500,letterSpacing:".02em"}}>{t.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* ── Full Report Modal ──────────────────────────────────────── */}
      {fullReportOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:700,display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",background:"rgba(0,0,0,.55)",backdropFilter:"blur(6px)"}}
          onClick={()=>setFullReportOpen(false)}>
          <div style={{position:"relative",width:"100%",maxWidth:mob?"100%":680,maxHeight:mob?"92vh":"88vh",background:"#fff",borderRadius:mob?"24px 24px 0 0":20,display:"flex",flexDirection:"column",overflow:"hidden",animation:"fadeUp .25s ease both"}}
            onClick={e=>e.stopPropagation()}>

            {/* Header */}
            <div style={{padding:"20px 24px 16px",borderBottom:`1px solid ${C.border}`,flexShrink:0,background:fullReport?.type==="economias"?"linear-gradient(135deg,#F0FFF4,#fff)":"linear-gradient(135deg,#EFF6FF,#fff)"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:20}}>{fullReport?.type==="economias"?"💡":"📈"}</span>
                    <div style={{fontSize:16,fontWeight:800}}>{fullReport?.titulo||"Gerando relatório..."}</div>
                    {!fullReport?.loading&&<span style={{fontSize:10,fontWeight:700,color:fullReport?.type==="economias"?C.green:C.blue,background:fullReport?.type==="economias"?C.greenLight:C.blueLight,borderRadius:100,padding:"2px 8px"}}>IA + Web</span>}
                  </div>
                  {fullReport?.resumo&&<div style={{fontSize:13,color:C.textMid,lineHeight:1.5}}>{fullReport.resumo}</div>}
                  {(fullReport?.potencial_total||fullReport?.valor_para_investir)&&(
                    <div style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:8,background:fullReport?.type==="economias"?C.greenLight:C.blueLight,borderRadius:9,padding:"6px 12px"}}>
                      <span style={{fontSize:13,fontWeight:800,color:fullReport?.type==="economias"?C.green:C.blue}}>
                        {fullReport?.potencial_total||fullReport?.valor_para_investir}
                      </span>
                      <span style={{fontSize:11,color:C.textMid}}>{fullReport?.type==="economias"?"potencial de economia":"disponível para investir"}</span>
                    </div>
                  )}
                </div>
                <button onClick={()=>setFullReportOpen(false)}
                  style={{width:32,height:32,borderRadius:8,border:`1px solid ${C.border}`,background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.textMid,flexShrink:0}}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/></svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"flex",flexDirection:"column",gap:16}}>
              {fullReport?.loading ? (
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 0",gap:16}}>
                  <div style={{width:52,height:52,borderRadius:16,background:fullReport?.type==="economias"?C.greenLight:C.blueLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>
                    {fullReport?.type==="economias"?"💡":"📈"}
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:14,fontWeight:700,marginBottom:6}}>
                      <span className="spinner" style={{display:"inline-block",marginRight:8}}>↻</span>
                      Pesquisando e analisando...
                    </div>
                    <div style={{fontSize:12,color:C.textMid,lineHeight:1.6,maxWidth:300}}>
                      A IA está buscando as melhores {fullReport?.type==="economias"?"alternativas e estratégias de economia":"opções de investimento"} disponíveis no Brasil agora
                    </div>
                  </div>
                  {["Analisando seu perfil financeiro","Buscando alternativas online","Calculando potencial de retorno","Montando recomendações personalizadas"].map((s,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.textMid,animation:`pulse ${1+i*0.3}s ease infinite`}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:fullReport?.type==="economias"?C.green:C.blue,flexShrink:0}}/>
                      {s}
                    </div>
                  ))}
                </div>
              ) : fullReport?.error ? (
                <div style={{background:"#FFF0F2",border:`1px solid ${C.coralMid}`,borderRadius:12,padding:"16px 20px",fontSize:13,color:C.coral}}>⚠️ {fullReport.error}</div>
              ) : (
                (fullReport?.secoes||[]).map((sec,si)=>(
                  <div key={si}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <span style={{fontSize:18}}>{sec.icone}</span>
                      <div style={{fontSize:14,fontWeight:800}}>{sec.titulo}</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {(sec.itens||[]).map((item,ii)=>{
                        const isEcon = fullReport?.type==="economias";
                        const accent = isEcon ? C.green : C.blue;
                        const accentLight = isEcon ? C.greenLight : C.blueLight;
                        const val = isEcon ? item.economia_estimada : item.rentabilidade_estimada;
                        const badge2 = isEcon ? item.dificuldade : item.risco;
                        const badge2Color = isEcon
                          ? (item.dificuldade==="fácil"?C.green:item.dificuldade==="médio"?C.amber:C.coral)
                          : (item.risco==="baixo"?C.green:item.risco==="médio"?C.amber:C.coral);
                        const prioColor = item.prioridade==="alta"?C.coral:item.prioridade==="média"?C.amber:C.textMid;
                        return (
                          <div key={ii} style={{background:C.bgSoft,borderRadius:12,border:`1px solid ${C.border}`,overflow:"hidden"}}>
                            <div style={{padding:"12px 14px 0"}}>
                              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:6}}>
                                <div style={{fontWeight:700,fontSize:13,flex:1}}>{isEcon?item.acao:item.produto}</div>
                                <div style={{display:"flex",gap:5,flexShrink:0,flexWrap:"wrap",justifyContent:"flex-end"}}>
                                  {val&&<span style={{fontSize:10,fontWeight:700,color:accent,background:accentLight,borderRadius:100,padding:"2px 8px"}}>{val}</span>}
                                  {badge2&&<span style={{fontSize:10,fontWeight:700,color:badge2Color,background:badge2Color+"18",borderRadius:100,padding:"2px 8px",textTransform:"capitalize"}}>{badge2}</span>}
                                  {item.prioridade&&<span style={{fontSize:10,fontWeight:700,color:prioColor,background:prioColor+"18",borderRadius:100,padding:"2px 8px"}}>prioridade {item.prioridade}</span>}
                                </div>
                              </div>
                              <div style={{fontSize:12,color:C.textMid,lineHeight:1.65,marginBottom:item.aporte_sugerido||item.como_comecar?0:12}}>{isEcon?item.detalhe:item.descricao}</div>
                            </div>
                            {(item.aporte_sugerido||item.como_comecar)&&(
                              <div style={{margin:"10px 14px 12px",padding:"10px 12px",background:"#fff",borderRadius:9,border:`1px solid ${C.border}`}}>
                                {item.aporte_sugerido&&<div style={{fontSize:11,fontWeight:700,color:C.blue,marginBottom:3}}>💰 Aporte sugerido: {item.aporte_sugerido}</div>}
                                {item.como_comecar&&<div style={{fontSize:11,color:C.textMid,lineHeight:1.55}}>▶ {item.como_comecar}</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {!fullReport?.loading&&(
              <div style={{padding:"12px 24px",borderTop:`1px solid ${C.border}`,flexShrink:0,background:"#fff",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                <div style={{fontSize:11,color:C.textLight}}>Gerado com IA + pesquisa web · {new Date().toLocaleDateString("pt-BR")}</div>
                <button onClick={()=>setFullReportOpen(false)}
                  style={{background:C.bgSoft,color:C.textMid,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 20px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Upgrade Modal ─────────────────────────────────────────── */}
      {showUpgrade&&(
        <UpgradeModal
          user={user}
          currentPlan={plan}
          onClose={()=>setShowUpgrade(false)}
          onSuccess={()=>{
            setShowUpgrade(false);
            onPlanUpgrade && onPlanUpgrade();
          }}
        />
      )}
      {/* ── Plan Add Expense Modal ─────────────────────────────── */}
      {planAddOpen&&(
        <div style={{position:"fixed",inset:0,zIndex:600,display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center"}} onClick={()=>setPlanAddOpen(false)}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.5)",backdropFilter:"blur(5px)"}}/>
          <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:mob?"100%":480,height:mob?"auto":"auto",maxHeight:mob?"95vh":"88vh",background:"#fff",borderRadius:mob?"24px 24px 0 0":20,display:"flex",flexDirection:"column",animation:"fadeUp .25s ease both",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>

            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"20px 24px 16px",borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
              <div style={{fontWeight:800,fontSize:16}}>Nova despesa</div>
              <button onClick={()=>setPlanAddOpen(false)} style={{background:C.bgSoft,border:"none",borderRadius:8,width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.textMid}}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={18} y1={6} x2={6} y2={18}/><line x1={6} y1={6} x2={18} y2={18}/></svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{flex:1,overflowY:"auto",padding:"20px 24px"}}>

              {/* Month selector */}
              <div style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:C.text,marginBottom:6}}>Mês</label>
                <select value={planAddMonth} onChange={e=>setPlanAddMonth(e.target.value)}
                  style={{width:"100%",background:C.bgSoft,border:`1.5px solid ${C.border}`,borderRadius:11,padding:"10px 14px",fontSize:13,color:C.text,outline:"none",fontFamily:"inherit",cursor:"pointer",boxSizing:"border-box"}}>
                  {timelineMonthsD.map((m,i)=><option key={m} value={m}>{MONTHS_FULL_D[i]} {planYearD}</option>)}
                </select>
              </div>

              {/* Suggestions */}
              {expenses.length>0&&(
                <div style={{marginBottom:14}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                    <label style={{fontSize:12,fontWeight:600,color:C.text}}>
                      Suas despesas
                      <span style={{fontWeight:400,color:C.textLight,marginLeft:6}}>Toque para preencher</span>
                    </label>
                    <button onClick={()=>{
                      const existing = monthlyExpenses[planAddMonth]||[];
                      const existingKeys = new Set(existing.map(e=>e.name+"_"+e.value));
                      const toAdd = expenses
                        .filter(e=>!existingKeys.has(e.name+"_"+e.value))
                        .map(e=>({id:Date.now()+Math.random(),name:e.name,value:e.value,type:e.type,category:e.category}));
                      if(!toAdd.length) return;
                      setMonthlyExpenses(prev=>({...prev,[planAddMonth]:[...(prev[planAddMonth]||[]),...toAdd]}));
                      setPlanAddOpen(false);
                    }}
                      style={{display:"flex",alignItems:"center",gap:5,background:C.coral,color:"#fff",border:"none",borderRadius:8,padding:"5px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0,boxShadow:"0 2px 6px rgba(252,23,87,.25)"}}>
                      <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={12} y1={5} x2={12} y2={19}/><line x1={5} y1={12} x2={19} y2={12}/></svg>
                      Adicionar todas
                    </button>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {expenses.map(e=>(
                      <button key={e.id} onClick={()=>{setPlanName(e.name);setPlanValue(e.value);setPlanType(e.type);setPlanCategory(e.category);}}
                        style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:100,border:`1.5px solid ${planName===e.name?CAT_COLORS[e.category]:C.border}`,background:planName===e.name?CAT_BG[e.category]:C.bgSoft,cursor:"pointer",fontFamily:"inherit",transition:"all .12s",flexShrink:0}}>
                        <span style={{fontSize:13}}>{CAT_EMOJI[e.category]}</span>
                        <span style={{fontSize:12,fontWeight:planName===e.name?700:500,color:planName===e.name?CAT_COLORS[e.category]:C.text,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</span>
                        <span style={{fontSize:11,color:planName===e.name?CAT_COLORS[e.category]:C.textMid,fontWeight:600,flexShrink:0}}>{formatBRL(e.value)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <div style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:C.text,marginBottom:6}}>Descrição</label>
                <input value={planName} onChange={e=>setPlanName(e.target.value)} placeholder="Ex: Aluguel, Supermercado..."
                  style={{width:"100%",background:C.bgSoft,border:`1.5px solid ${C.border}`,borderRadius:11,padding:"11px 14px",fontSize:14,color:C.text,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}
                  onFocus={e=>e.target.style.borderColor=C.coral} onBlur={e=>e.target.style.borderColor=C.border}/>
              </div>

              {/* Value + Type */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                <div>
                  <label style={{display:"block",fontSize:12,fontWeight:600,color:C.text,marginBottom:6}}>Valor (R$)</label>
                  <input type="number" value={planValue} onChange={e=>setPlanValue(e.target.value)} placeholder="0,00"
                    style={{width:"100%",background:C.bgSoft,border:`1.5px solid ${C.border}`,borderRadius:11,padding:"11px 14px",fontSize:14,color:C.text,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}
                    onFocus={e=>e.target.style.borderColor=C.coral} onBlur={e=>e.target.style.borderColor=C.border}/>
                </div>
                <div>
                  <label style={{display:"block",fontSize:12,fontWeight:600,color:C.text,marginBottom:6}}>Tipo</label>
                  <select value={planType} onChange={e=>setPlanType(e.target.value)}
                    style={{width:"100%",background:C.bgSoft,border:`1.5px solid ${C.border}`,borderRadius:11,padding:"11px 14px",fontSize:13,color:C.text,outline:"none",fontFamily:"inherit",boxSizing:"border-box",cursor:"pointer"}}>
                    <option value="fixa">Fixa</option>
                    <option value="variavel">Variável</option>
                  </select>
                </div>
              </div>

              {/* Category */}
              <div style={{marginBottom:8}}>
                <label style={{display:"block",fontSize:12,fontWeight:600,color:C.text,marginBottom:6}}>Categoria</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {CATEGORIES.map(cat=>(
                    <button key={cat} onClick={()=>setPlanCategory(cat)}
                      style={{padding:"5px 11px",borderRadius:100,border:`1.5px solid ${planCategory===cat?CAT_COLORS[cat]:C.border}`,background:planCategory===cat?CAT_BG[cat]:"transparent",fontSize:11,fontWeight:planCategory===cat?700:500,color:planCategory===cat?CAT_COLORS[cat]:C.textMid,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:4,transition:"all .12s"}}>
                      <span>{CAT_EMOJI[cat]}</span>{cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{padding:"16px 24px",borderTop:`1px solid ${C.border}`,flexShrink:0}}>
              <button onClick={addPlanExpenseD} disabled={!planName||!planValue}
                style={{width:"100%",background:(!planName||!planValue)?C.border:C.coral,color:(!planName||!planValue)?C.textLight:"#fff",border:"none",borderRadius:12,padding:"14px",fontWeight:700,fontSize:14,fontFamily:"inherit",cursor:(!planName||!planValue)?"not-allowed":"pointer",transition:"background .2s",boxShadow:(!planName||!planValue)?"none":"0 2px 10px rgba(252,23,87,.3)"}}>
                Adicionar despesa
              </button>
            </div>

          </div>
        </div>
      )}
      {showProfile&&(
        <ProfilePage user={profileUser} plan={plan} onClose={()=>setShowProfile(false)} onLogout={onLogout} onUpdateUser={u=>setProfileUser(u)}/>
      )}

      {/* ── Getting Started Modal ─────────────────────────────────── */}
      {!spotlightDone&&(
        <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:mob?"0":"24px"}} onClick={()=>setSpotlightDone(true)}>
          <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.45)",backdropFilter:"blur(4px)"}}/>
          <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:mob?"100%":480,height:mob?"100%":"auto",background:"#fff",borderRadius:mob?0:24,boxShadow:"0 24px 80px rgba(0,0,0,.22)",overflow:"hidden",display:"flex",flexDirection:"column",animation:"fadeUp .35s ease both"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"linear-gradient(135deg,#FC1757,#C8003B)",padding:mob?"32px 24px 28px":"32px 32px 28px",position:"relative",overflow:"hidden",flexShrink:0}}>
              <div style={{position:"absolute",top:-40,right:-40,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,.07)"}}/>
              <button onClick={()=>setSpotlightDone(true)} style={{position:"absolute",top:16,right:16,background:"rgba(255,255,255,.2)",border:"none",color:"#fff",width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit"}}>✕</button>
              <div style={{position:"relative",zIndex:1}}>
                <div style={{fontSize:mob?32:36,marginBottom:10}}>🚀</div>
                <div style={{fontSize:mob?18:22,fontWeight:800,color:"#fff",lineHeight:1.2,marginBottom:6}}>Tudo pronto! Vamos começar?</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,.8)",lineHeight:1.6}}>Siga estes 2 passos para ativar o Se Poupe.</div>
              </div>
            </div>
            <div style={{padding:mob?"20px 24px 16px":"24px 28px 12px",display:"flex",flexDirection:"column",gap:10,flex:mob?1:"none",overflowY:"auto"}}>
              <div style={{display:"flex",gap:14,alignItems:"flex-start",padding:"14px 16px",background:"#FFF5F7",border:"1.5px solid #FC175730",borderRadius:14}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:C.coral,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,flexShrink:0}}>1</div>
                <div>
                  <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:3}}>Digite seu <span style={{color:C.coral}}>Salário Líquido Mensal</span></div>
                  <div style={{fontSize:12,color:C.textMid,lineHeight:1.6}}>Informe o valor <strong style={{color:C.text}}>após</strong> descontos de INSS e IR. É a base de todos os cálculos.</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:15}}><div style={{width:2,height:16,background:C.border,borderRadius:2}}/></div>
              <div style={{display:"flex",gap:14,alignItems:"flex-start",padding:"14px 16px",background:C.blueLight,border:`1.5px solid ${C.blue}30`,borderRadius:14}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:C.blue,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,flexShrink:0}}>2</div>
                <div>
                  <div style={{fontSize:14,fontWeight:800,color:C.text,marginBottom:3}}>Adicione suas <span style={{color:C.blue}}>Despesas Mensais</span></div>
                  <div style={{fontSize:12,color:C.textMid,lineHeight:1.6}}>Vá até <strong style={{color:C.text}}>Despesas</strong> e cole sua lista — extrato, anotações, qualquer formato. A IA organiza tudo.</div>
                </div>
              </div>
              <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:13,color:C.textLight}}>💡</span>
                <span style={{fontSize:12,color:C.textLight,lineHeight:1.5}}>Com esses dois dados a IA já gera sua análise financeira completa.</span>
              </div>
            </div>
            <div style={{padding:mob?"16px 24px 28px":"14px 28px 28px",flexShrink:0}}>
              <button onClick={()=>{setSpotlightDone(true);setActiveTab("overview");}}
                style={{width:"100%",background:C.coral,color:"#fff",border:"none",borderRadius:12,padding:"14px",fontWeight:800,fontSize:14,fontFamily:"inherit",cursor:"pointer",boxShadow:"0 4px 14px rgba(252,23,87,.3)"}}>
                ✓ Entendi — vou configurar agora!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [user,setUser]           = useState(null);
  const [onboarded,setOnboarded] = useState(false);
  const [isNewUser,setIsNewUser] = useState(false);
  const [loading,setLoading]     = useState(true);
  const [plan,setPlan]           = useState("free");
  const [cookiePrefs,setCookiePrefs] = useState(null); // null = not yet decided

  useEffect(()=>{
    loadSession().then(async saved=>{
      if(saved){
        setUser(saved);
        setOnboarded(true);
        const p = await loadPlan(saved.email);
        setPlan(p||"free");
      }
      const c = await loadCookies();
      setCookiePrefs(c); // null triggers banner, object means already decided
      setLoading(false);
    });
  },[]);

  const handleAuth = async (u,isNew=false) => {
    await saveSession(u);
    const p = await loadPlan(u.email);
    setPlan(p||"free");
    setUser(u); setIsNewUser(isNew); setOnboarded(false);
  };
  const handleCookies = async (prefs) => {
    await saveCookies(prefs);
    setCookiePrefs(prefs);
  };
  const handleLogout = async () => {
    await saveSession(null);
    setUser(null); setOnboarded(false); setIsNewUser(false); setPlan("free");
  };
  const handleUpgrade = async () => {
    if(!user) return;
    await savePlan(user.email,"pro");
    setPlan("pro");
  };

  if(loading) return (
    <div style={{minHeight:"100vh",background:"#F7F7F7",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <style>{BASE_CSS}</style>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:28,marginBottom:10,animation:"spin 1s linear infinite",display:"inline-block",color:"#FC1757"}}>✦</div>
        <div style={{fontSize:13,color:"#717171",fontWeight:500}}>Carregando...</div>
      </div>
    </div>
  );

  const showCookieBanner = cookiePrefs===null;

  if(!user) return (
    <>
      <AuthGate onAuth={handleAuth}/>
      {showCookieBanner&&<CookieBanner onAccept={handleCookies}/>}
    </>
  );
  if(!onboarded) return (
    <>
      <Onboarding user={user} onFinish={()=>setOnboarded(true)}/>
      {showCookieBanner&&<CookieBanner onAccept={handleCookies}/>}
    </>
  );
  return (
    <>
      <Dashboard user={user} onLogout={handleLogout} isFirstVisit={isNewUser} plan={plan} onPlanUpgrade={handleUpgrade}/>
      {showCookieBanner&&<CookieBanner onAccept={handleCookies}/>}
    </>
  );
}
