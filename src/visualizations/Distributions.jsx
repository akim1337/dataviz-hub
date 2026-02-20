import { useState, useMemo, useCallback } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

/* ── MATH ── */
const lnGamma = (z) => {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  const c = [0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];
  let x = c[0]; for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
};
const gamma = (z) => Math.exp(lnGamma(z));
const comb = (n, k) => { if (k > n || k < 0) return 0; if (k === 0 || k === n) return 1; let r = 1; for (let i = 0; i < Math.min(k, n - k); i++) r = (r * (n - i)) / (i + 1); return r; };
const erfinv = (x) => { const a = 0.147, ln1mx2 = Math.log(1 - x * x), t1 = 2 / (Math.PI * a) + ln1mx2 / 2, t2 = ln1mx2 / a; return Math.sign(x) * Math.sqrt(Math.sqrt(t1 * t1 - t2) - t1); };
const normQ = (p) => Math.SQRT2 * erfinv(2 * p - 1);
const normPDF = (x, mu, s) => (1 / (s * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / s) ** 2);

const tQuantile = (p, df) => {
  if (df >= 30) return normQ(p);
  let x = normQ(p);
  for (let i = 0; i < 15; i++) {
    const pdf = (gamma((df+1)/2) / (Math.sqrt(df*Math.PI) * gamma(df/2))) * Math.pow(1 + x*x/df, -(df+1)/2);
    const cdf = tCDF(x, df), err = cdf - p;
    if (Math.abs(err) < 1e-12) break;
    x -= err / Math.max(pdf, 1e-30);
  }
  return x;
};
const tCDF = (x, df) => { const t = df / (df + x*x), ib = incBeta(t, df/2, 0.5); return x >= 0 ? 1 - 0.5*ib : 0.5*ib; };
const incBeta = (x, a, b) => {
  if (x === 0 || x === 1) return x === 0 ? 0 : 1;
  const lnB = lnGamma(a) + lnGamma(b) - lnGamma(a+b);
  const front = Math.exp(Math.log(x)*a + Math.log(1-x)*b - lnB);
  let f=1, c=1, d=0;
  for (let i=0; i<=200; i++) {
    let m=Math.floor(i/2), num;
    if (i===0) num=1; else if (i%2===0) num=(m*(b-m)*x)/((a+2*m-1)*(a+2*m)); else num=-((a+m)*(a+b+m)*x)/((a+2*m)*(a+2*m+1));
    d=1+num*d; if(Math.abs(d)<1e-30) d=1e-30; d=1/d;
    c=1+num/c; if(Math.abs(c)<1e-30) c=1e-30;
    f*=c*d; if(Math.abs(c*d-1)<1e-10) break;
  }
  return (front*(f-1))/a;
};

/* ── SAMPLERS ── */
const rN = (m,s) => { let u,v,w; do{u=Math.random()*2-1;v=Math.random()*2-1;w=u*u+v*v;}while(w>=1||w===0); return m+s*u*Math.sqrt(-2*Math.log(w)/w); };
const rExp = (l) => -Math.log(1-Math.random())/l;
const rPois = (l) => { const L=Math.exp(-Math.min(l,700)); let k=0,p=1; do{k++;p*=Math.random();}while(p>L); return k-1; };
const rBin = (n,p) => { let s=0; for(let i=0;i<n;i++) if(Math.random()<p) s++; return s; };
const rChi = (k) => { let s=0; for(let i=0;i<k;i++){const z=rN(0,1);s+=z*z;} return s; };
const rT = (df) => rN(0,1)/Math.sqrt(rChi(df)/df);
const rU = (a,b) => a+Math.random()*(b-a);
const rLN = (m,s) => Math.exp(rN(m,s));
const rGeo = (p) => Math.floor(Math.log(1-Math.random())/Math.log(1-p))+1;
const rCau = (x0,g) => x0+g*Math.tan(Math.PI*(Math.random()-0.5));

/* ── DISTRIBUTIONS ── */
const D = {
  normal: { name:"Нормальное", en:"Normal", em:"🔔", desc:"Колоколообразная кривая. Рост, IQ, ошибки измерений.",
    cases:["Рост мужчин: μ≈176 см, σ≈7 см → 95% попадут в 162–190 см","IQ тест: μ=100, σ=15 → оценка интеллекта стандартизирована именно под эту кривую","Ошибка GPS: каждое измерение координат отклоняется от истинного по нормальному закону"], type:"continuous", ci:true,
    params:[{key:"mu",label:"μ (среднее)",min:-10,max:10,step:0.5,def:0},{key:"sigma",label:"σ (ст.откл.)",min:0.1,max:10,step:0.1,def:1}],
    pdf:(x,{mu,sigma})=>normPDF(x,mu,sigma), range:({mu,sigma})=>[mu-4*sigma,mu+4*sigma],
    stats:({mu})=>({mean:mu,median:mu,mode:mu}), sam:({mu,sigma})=>rN(mu,sigma) },
  uniform: { name:"Равномерное", en:"Uniform", em:"▬", desc:"Все значения равновероятны. Кубик, RNG.",
    cases:["Бросок кубика: P(1)=P(2)=...=P(6)=1/6 — идеальная дискретная равномерность","Math.random(): генератор выдаёт число от 0 до 1, каждое равновероятно","Время ожидания автобуса: если ходит каждые 10 мин и ты пришёл случайно → ждёшь U(0,10)"], type:"continuous", ci:true,
    params:[{key:"a",label:"a (мин)",min:-10,max:5,step:0.5,def:0},{key:"b",label:"b (макс)",min:-5,max:15,step:0.5,def:5}],
    pdf:(x,{a,b})=>(x>=a&&x<=b?1/(b-a):0), range:({a,b})=>[a-1,b+1],
    stats:({a,b})=>({mean:(a+b)/2,median:(a+b)/2,mode:null}), sam:({a,b})=>rU(a,b) },
  exponential: { name:"Экспоненц.", en:"Exponential", em:"📉", desc:"Время до события. Между звонками, жизнь лампочки.",
    cases:["Время между заказами в приложении: в среднем 1 заказ в 3 мин → λ=1/3, экспоненциальное","Срок жизни лампочки: «память» отсутствует — старая лампочка ломается с той же вероятностью что и новая","Распад атома: время до распада одного радиоактивного ядра — классический Exp(λ)"], type:"continuous", ci:true,
    params:[{key:"lambda",label:"λ (rate)",min:0.1,max:5,step:0.1,def:1}],
    pdf:(x,{lambda})=>(x>=0?lambda*Math.exp(-lambda*x):0), range:({lambda})=>[0,5/lambda+1],
    stats:({lambda})=>({mean:1/lambda,median:Math.log(2)/lambda,mode:0}), sam:({lambda})=>rExp(lambda) },
  poisson: { name:"Пуассона", en:"Poisson", em:"🎯", desc:"Число событий за интервал. Звонки/час, баги/релиз.",
    cases:["Ошибки в коде: в среднем 3 бага на 1000 строк → число багов в модуле ~ Poisson(3)","Голы в футболе: среднее ~2.5 за матч → P(0 голов)≈8%, отсюда букмекеры считают тоталы","Звонки в колл-центр: 20 звонков/час → за 15 мин ожидаешь ~Poisson(5)"], type:"discrete", ci:true,
    params:[{key:"lambda",label:"λ (среднее)",min:0.5,max:30,step:0.5,def:5}],
    pmf:(k,{lambda})=>Math.exp(-lambda+k*Math.log(lambda)-lnGamma(k+1)), range:({lambda})=>[0,Math.ceil(lambda+4*Math.sqrt(lambda))],
    stats:({lambda})=>({mean:lambda,median:Math.round(lambda+1/3-0.02/Math.max(lambda,0.01)),mode:Math.floor(lambda)}), sam:({lambda})=>rPois(lambda) },
  binomial: { name:"Биномиальное", en:"Binomial", em:"🪙", desc:"Успехи из n попыток. Монетки, конверсии, A/B.",
    cases:["A/B тест: 1000 посетителей, конверсия 3% → число покупок ~ Bin(1000, 0.03)","Контроль качества: из 50 деталей проверяешь, сколько бракованных при P(брак)=2%","Лотерея: купил 10 билетов, P(выигрыш)=0.1 → число выигрышей ~ Bin(10, 0.1)"], type:"discrete", ci:true,
    params:[{key:"nn",label:"n (испыт.)",min:1,max:60,step:1,def:20},{key:"p",label:"p (вероятн.)",min:0.01,max:0.99,step:0.01,def:0.5}],
    pmf:(k,{nn,p})=>{if(k<0||k>nn)return 0;return comb(nn,k)*Math.pow(p,k)*Math.pow(1-p,nn-k);}, range:({nn})=>[0,nn],
    stats:({nn,p})=>({mean:nn*p,median:Math.round(nn*p),mode:Math.floor((nn+1)*p)}), sam:({nn,p})=>rBin(nn,p) },
  geometric: { name:"Геометрич.", en:"Geometric", em:"🎰", desc:"Попыток до успеха. Собеседования→оффер, свайпы→мэтч.",
    cases:["Собеседования: конверсия оффера ~10% → в среднем 10 собесов до первого оффера","Тиндер: P(мэтч)≈2% → медианно ~35 свайпов до мэтча, но может быть и 200","Подбрасывание монеты до орла: P=0.5 → в среднем 2 броска, но иногда 10+"], type:"discrete", ci:true,
    params:[{key:"p",label:"p (успех)",min:0.01,max:0.8,step:0.01,def:0.2}],
    pmf:(k,{p})=>(k<1?0:p*Math.pow(1-p,k-1)), range:({p})=>[1,Math.min(Math.ceil(5/p),100)],
    stats:({p})=>({mean:1/p,median:Math.ceil(-1/Math.log2(1-p)),mode:1}), sam:({p})=>rGeo(p) },
  chisquared: { name:"Хи-квадрат", en:"Chi-squared", em:"χ²", desc:"Тест независимости. Подходит ли модель данным?",
    cases:["A/B тест: χ²-тест проверяет, различаются ли конверсии двух групп статистически значимо","Опросник: связан ли пол с предпочтением бренда? χ² по таблице сопряжённости","Генетика: Мендель проверял отношение 3:1 фенотипов — χ² показывает, совпадает ли теория"], type:"continuous", ci:true,
    params:[{key:"k",label:"k (степ. своб.)",min:1,max:30,step:1,def:4}],
    pdf:(x,{k})=>{if(x<=0)return 0;return(Math.pow(x,k/2-1)*Math.exp(-x/2))/(Math.pow(2,k/2)*gamma(k/2));}, range:({k})=>[0,k+4*Math.sqrt(2*k)+2],
    stats:({k})=>({mean:k,median:k*Math.pow(1-2/(9*k),3),mode:Math.max(k-2,0)}), sam:({k})=>rChi(k) },
  student_t: { name:"Стьюдента", en:"Student's t", em:"📊", desc:"Нормальное для малых выборок. t-тесты.",
    cases:["Клиническое исследование: n=15 пациентов, t-тест сравнивает давление до/после лекарства","Стартап-метрики: у тебя 12 дней данных — z-тест врёт, t-тест учитывает неопределённость σ","Пивоварня Guinness: Госсет (Student) изобрёл t-тест для контроля качества на малых партиях"], type:"continuous", ci:true,
    params:[{key:"df",label:"ν (степ. своб.)",min:1,max:50,step:1,def:5}],
    pdf:(x,{df})=>(gamma((df+1)/2)/(Math.sqrt(df*Math.PI)*gamma(df/2)))*Math.pow(1+x*x/df,-(df+1)/2), range:()=>[-5,5],
    stats:({df})=>({mean:df>1?0:null,median:0,mode:0}), sam:({df})=>rT(df) },
  cauchy: { name:"Коши", en:"Cauchy", em:"🌀", desc:"Похоже на нормальное, но μ и σ² НЕ СУЩЕСТВУЮТ. Чёрные лебеди.",
    cases:["Финансовые крахи: доходность акций иногда Cauchy-подобна — среднее бесполезно, хвосты убивают","Отношение двух нормальных: если X и Y ~ N(0,1), то X/Y ~ Cauchy — вот почему ratio estimation опасен","Лоренцев профиль: форма спектральных линий в физике — ширина пика описывается γ"], type:"continuous", ci:false,
    params:[{key:"x0",label:"x₀ (центр)",min:-10,max:10,step:0.5,def:0},{key:"g",label:"γ (масштаб)",min:0.1,max:5,step:0.1,def:1}],
    pdf:(x,{x0,g})=>1/(Math.PI*g*(1+((x-x0)/g)**2)), range:({x0,g})=>[x0-8*g,x0+8*g],
    stats:({x0})=>({mean:null,median:x0,mode:x0}), sam:({x0,g})=>rCau(x0,g) },
  lognormal: { name:"Логнормальное", en:"Log-Normal", em:"💰", desc:"Доходы, акции. Правый хвост — всегда кто-то богаче.",
    cases:["Зарплаты: медиана ~60к, но среднее ~90к из-за хвоста — CEO тянут среднее вверх","Размер файлов: большинство мелкие, но иногда 10GB видео — классический правый хвост","Время ответа сервера: обычно 50мс, но бывают спайки 5000мс — p99 латентность"], type:"continuous", ci:true,
    params:[{key:"mu",label:"μ",min:-2,max:3,step:0.1,def:0},{key:"sigma",label:"σ",min:0.1,max:2,step:0.1,def:0.5}],
    pdf:(x,{mu,sigma})=>{if(x<=0)return 0;return(1/(x*sigma*Math.sqrt(2*Math.PI)))*Math.exp(-((Math.log(x)-mu)**2)/(2*sigma*sigma));},
    range:({mu,sigma})=>[0,Math.exp(mu+3*sigma)+1],
    stats:({mu,sigma})=>({mean:Math.exp(mu+sigma*sigma/2),median:Math.exp(mu),mode:Math.exp(mu-sigma*sigma)}), sam:({mu,sigma})=>rLN(mu,sigma) },
};

/* ── DATA GEN ── */
const genTheo = (key, par) => {
  const d = D[key], [lo,hi] = d.range(par);
  if (d.type === "discrete") { const r=[]; for(let k=Math.floor(lo);k<=Math.min(Math.ceil(hi),200);k++) r.push({x:k,y:d.pmf(k,par)}); return r; }
  const pts=300, s=(hi-lo)/pts, r=[];
  for(let i=0;i<=pts;i++){const x=lo+i*s; r.push({x:+x.toFixed(4),y:d.pdf(x,par)});} return r;
};

const genEmp = (key, par, n) => {
  const d = D[key];
  const samples = Array.from({length:n}, ()=>d.sam(par));
  const sorted = [...samples].sort((a,b)=>a-b);
  const mean = samples.reduce((s,v)=>s+v,0)/n;
  const med = n%2===0 ? (sorted[n/2-1]+sorted[n/2])/2 : sorted[Math.floor(n/2)];
  const std = Math.sqrt(samples.reduce((s,v)=>s+(v-mean)**2,0)/(n-1));
  const [lo,hi] = d.range(par);

  if (d.type === "discrete") {
    const cnt={}; samples.forEach(v=>{const k=Math.round(v);cnt[k]=(cnt[k]||0)+1;});
    const bd=[]; for(let k=Math.floor(lo);k<=Math.min(Math.ceil(hi),200);k++) bd.push({x:k,y:(cnt[k]||0)/n});
    let mk=Math.floor(lo),mc=0; for(const[k,c] of Object.entries(cnt)){if(c>mc){mc=c;mk=+k;}} return {data:bd,mean,median:med,mode:mk,std};
  }
  const bins=Math.min(Math.max(Math.round(Math.sqrt(n)),10),80), bw=(hi-lo||1)/bins;
  const hist=new Array(bins).fill(0);
  samples.forEach(v=>{let i=Math.floor((v-lo)/bw);i=Math.max(0,Math.min(bins-1,i));hist[i]++;});
  const bd=hist.map((c,i)=>({x:+(lo+(i+0.5)*bw).toFixed(4),y:c/(n*bw)}));
  let mb=0,mx=0; hist.forEach((c,i)=>{if(c>mb){mb=c;mx=lo+(i+0.5)*bw;}}); return {data:bd,mean,median:med,mode:mx,std};
};

const compCI = (emp, n, lv) => {
  const alpha=1-lv, z=n>=30?normQ(1-alpha/2):tQuantile(1-alpha/2,n-1), se=emp.std/Math.sqrt(n);
  return {lo:emp.mean-z*se, hi:emp.mean+z*se, se, z, mean:emp.mean};
};

const genSampDist = (ci) => {
  const mu=ci.mean, s=ci.se, lo=mu-4*s, hi=mu+4*s, pts=200, step=(hi-lo)/pts, r=[];
  for(let i=0;i<=pts;i++){const x=lo+i*step,y=normPDF(x,mu,s); r.push({x:+x.toFixed(5),y,yCI:(x>=ci.lo&&x<=ci.hi)?y:0});} return r;
};

/* ── STYLES ── */
const AC="#e8c547",MC="#ff6b6b",MDC="#51cf66",MOC="#74b9ff",CC="#c084fc";
const F=`'JetBrains Mono','Fira Code','SF Mono',monospace`;

/* ── COMPONENT ── */
export default function App() {
  const [act,setAct]=useState("normal");
  const [n,setN]=useState(500);
  const [sT,setST]=useState(true);
  const [sE,setSE]=useState(true);
  const [ss,setSS]=useState({mean:true,median:true,mode:true});
  const [sCI,setSCI]=useState(true);
  const [ciLv,setCILv]=useState(0.95);
  const [seed,setSeed]=useState(0);

  const d=D[act], disc=d.type==="discrete";
  const [par,setPar]=useState(()=>{const p={};Object.entries(D).forEach(([k,v])=>{p[k]={};v.params.forEach(pr=>(p[k][pr.key]=pr.def));});return p;});
  const cp=par[act];
  const setP=useCallback((k,v)=>setPar(p=>({...p,[act]:{...p[act],[k]:+v}})),[act]);

  const theo=useMemo(()=>genTheo(act,cp),[act,cp]);
  const emp=useMemo(()=>genEmp(act,cp,n),[act,cp,n,seed]);
  const ts=useMemo(()=>d.stats(cp),[d,cp]);
  const ci=useMemo(()=>d.ci?compCI(emp,n,ciLv):null,[emp,n,ciLv,d.ci]);
  const sampD=useMemo(()=>ci?genSampDist(ci):null,[ci]);
  const showCIC=sCI&&ci&&d.ci;

  const B=({c,l,v,s:sub})=>(
    <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:4,background:c+"15",border:`1px solid ${c}40`,fontSize:11,color:c,fontFamily:F,lineHeight:1.3,whiteSpace:"nowrap"}}>
      <span style={{width:7,height:7,borderRadius:"50%",background:c,flexShrink:0}}/>
      {l}: <b>{v==null?"∄":typeof v==="number"?v.toFixed(3):v}</b>
      {sub&&<span style={{fontSize:9,opacity:0.6}}> {sub}</span>}
    </span>
  );

  return (
    <div style={{background:"#0d1117",color:"#c9d1d9",minHeight:"100vh",fontFamily:F,padding:"16px 20px",boxSizing:"border-box"}}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap" rel="stylesheet"/>

      <div style={{marginBottom:14}}>
        <h1 style={{fontSize:20,fontWeight:700,color:AC,margin:0}}>∿ Distribution Explorer</h1>
        <p style={{fontSize:11,color:"#8b949e",margin:"3px 0 0"}}>10 распределений · теория + эмпирика · μ / Me / Mo · sampling distribution + CI</p>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
        {Object.entries(D).map(([k,v])=>(
          <button key={k} onClick={()=>setAct(k)} style={{
            padding:"5px 11px",borderRadius:4,cursor:"pointer",fontSize:11,fontFamily:F,
            border:act===k?`1.5px solid ${AC}`:"1.5px solid #30363d",
            background:act===k?AC+"18":"#161b22",color:act===k?AC:"#8b949e",
            fontWeight:act===k?600:400,transition:"all .15s"}}>
            <span style={{marginRight:4}}>{v.em}</span>{v.name}
          </button>
        ))}
      </div>

      {/* Desc */}
      <div style={{background:"#161b22",border:"1px solid #30363d",borderRadius:6,padding:"8px 12px",marginBottom:14,fontSize:11,color:"#8b949e",lineHeight:1.5}}>
        <span style={{color:AC,fontWeight:600}}>{d.en}</span> — {d.desc}
        {!d.ci&&<span style={{color:CC,marginLeft:8}}>⚠ CI не определён — среднее не существует</span>}
        {d.cases&&(
          <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:3}}>
            {d.cases.map((c,i)=>(
              <div key={i} style={{display:"flex",gap:6,alignItems:"baseline"}}>
                <span style={{color:AC,fontSize:10,flexShrink:0}}>▹</span>
                <span style={{fontSize:11,color:"#8b949e",lineHeight:1.4}}>{c}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      <div style={{display:"grid",gridTemplateColumns:"250px 1fr",gap:14}}>
        {/* LEFT */}
        <div style={{background:"#161b22",borderRadius:8,border:"1px solid #30363d",padding:14,display:"flex",flexDirection:"column",gap:12,fontSize:11}}>
          <div style={{fontSize:12,fontWeight:600,color:AC}}>Параметры</div>
          {d.params.map(pr=>(
            <div key={pr.key}>
              <div style={{display:"flex",justifyContent:"space-between",color:"#8b949e",marginBottom:3}}>
                <span>{pr.label}</span><span style={{color:"#c9d1d9",fontWeight:600}}>{cp[pr.key]}</span>
              </div>
              <input type="range" min={pr.min} max={pr.max} step={pr.step} value={cp[pr.key]}
                onChange={e=>setP(pr.key,e.target.value)} style={{width:"100%",accentColor:AC}}/>
            </div>
          ))}

          <div style={{borderTop:"1px solid #30363d",paddingTop:12}}>
            <div style={{display:"flex",justifyContent:"space-between",color:"#8b949e",marginBottom:3}}>
              <span>n (выборка)</span><span style={{color:"#c9d1d9",fontWeight:600}}>{n}</span>
            </div>
            <input type="range" min={10} max={10000} step={10} value={n} onChange={e=>setN(+e.target.value)} style={{width:"100%",accentColor:AC}}/>
            <div style={{display:"flex",gap:3,marginTop:5,flexWrap:"wrap"}}>
              {[30,100,500,1000,2020,5000,10000].map(v=>(
                <button key={v} onClick={()=>setN(v)} style={{
                  padding:"2px 7px",fontSize:10,borderRadius:3,fontFamily:F,cursor:"pointer",
                  border:"1px solid #30363d",background:n===v?AC+"22":"transparent",color:n===v?AC:"#8b949e"
                }}>{v>=1000?v/1000+"k":v}</button>
              ))}
            </div>
          </div>

          {d.ci&&(
            <div style={{borderTop:"1px solid #30363d",paddingTop:12}}>
              <div style={{display:"flex",justifyContent:"space-between",color:CC,marginBottom:5}}>
                <span>CI уровень</span><span style={{fontWeight:600}}>{(ciLv*100).toFixed(0)}%</span>
              </div>
              <div style={{display:"flex",gap:4}}>
                {[0.90,0.95,0.99].map(lv=>(
                  <button key={lv} onClick={()=>setCILv(lv)} style={{
                    flex:1,padding:"4px 0",fontSize:11,borderRadius:4,fontFamily:F,cursor:"pointer",
                    border:ciLv===lv?`1.5px solid ${CC}`:"1.5px solid #30363d",
                    background:ciLv===lv?CC+"20":"transparent",color:ciLv===lv?CC:"#8b949e",fontWeight:ciLv===lv?600:400
                  }}>{(lv*100).toFixed(0)}%</button>
                ))}
              </div>
            </div>
          )}

          <button onClick={()=>setSeed(s=>s+1)} style={{
            padding:"7px 0",borderRadius:5,border:`1.5px solid ${AC}55`,background:AC+"10",
            color:AC,cursor:"pointer",fontSize:11,fontFamily:F,fontWeight:600}}>↻ RESAMPLE</button>

          <div style={{borderTop:"1px solid #30363d",paddingTop:10,display:"flex",flexDirection:"column",gap:6}}>
            {[
              {ch:sT,set:setST,label:"Теоретическое PDF",col:AC},
              {ch:sE,set:setSE,label:"Эмпирическая гистограмма",col:AC},
              ...(d.ci?[{ch:sCI,set:setSCI,label:"Sampling Dist + CI",col:CC}]:[]),
              {ch:ss.mean,set:v=>setSS(p=>({...p,mean:v})),label:"Среднее (μ)",col:MC},
              {ch:ss.median,set:v=>setSS(p=>({...p,median:v})),label:"Медиана (Me)",col:MDC},
              {ch:ss.mode,set:v=>setSS(p=>({...p,mode:v})),label:"Мода (Mo)",col:MOC},
            ].map((t,i)=>(
              <label key={i} style={{fontSize:10,color:t.col,display:"flex",alignItems:"center",gap:7,cursor:"pointer"}}>
                <input type="checkbox" checked={t.ch} onChange={e=>t.set(e.target.checked)} style={{accentColor:t.col}}/>{t.label}
              </label>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>

          {/* CHART 1: Population */}
          <div style={{background:"#161b22",borderRadius:8,border:"1px solid #30363d",padding:"14px 14px 8px",display:"flex",flexDirection:"column"}}>
            <div style={{fontSize:11,fontWeight:600,color:"#8b949e",marginBottom:8}}>
              <span style={{color:AC}}>▸</span> Распределение генеральной совокупности
              <span style={{fontWeight:400,fontSize:10,marginLeft:8,color:"#484f58"}}>population distribution</span>
            </div>

            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
              <div style={{fontSize:9,color:"#484f58",textTransform:"uppercase",letterSpacing:1,width:"100%"}}>Теоретич.</div>
              {ss.mean&&<B c={MC} l="μ" v={ts.mean}/>}{ss.median&&<B c={MDC} l="Me" v={ts.median}/>}{ss.mode&&<B c={MOC} l="Mo" v={ts.mode}/>}
              <div style={{fontSize:9,color:"#484f58",textTransform:"uppercase",letterSpacing:1,width:"100%",marginTop:2}}>Эмпирич. (n={n})</div>
              {ss.mean&&<B c={MC} l="x̄" v={emp.mean}/>}{ss.median&&<B c={MDC} l="Me" v={emp.median}/>}{ss.mode&&<B c={MOC} l="Mo" v={emp.mode}/>}
            </div>

            <div style={{flex:1,minHeight:showCIC?240:360}}>
              <ResponsiveContainer width="100%" height="100%">
                {disc?(
                  <BarChart data={theo.map((t,i)=>({x:t.x,theo:sT?t.y:undefined,emp:sE&&emp.data[i]?emp.data[i].y:undefined}))} margin={{top:5,right:30,left:10,bottom:15}} barGap={0}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false}/>
                    <XAxis dataKey="x" stroke="#484f58" tick={{fontSize:10,fill:"#8b949e",fontFamily:F}}/>
                    <YAxis stroke="#484f58" tick={{fontSize:10,fill:"#8b949e",fontFamily:F}} tickFormatter={v=>v.toFixed(2)}/>
                    <Tooltip contentStyle={{background:"#0d1117",border:"1px solid #30363d",borderRadius:6,fontSize:11,fontFamily:F,color:"#c9d1d9"}} formatter={v=>[v?.toFixed(4),""]}/>
                    {sE&&<Bar dataKey="emp" fill={AC+"40"} name="Эмпирич."/>}
                    {sT&&<Bar dataKey="theo" fill={AC+"99"} name="Теоретич."/>}
                    {ss.mean&&ts.mean!=null&&<ReferenceLine x={Math.round(ts.mean)} stroke={MC} strokeDasharray="4 3" strokeWidth={1.5}/>}
                    {ss.median&&ts.median!=null&&<ReferenceLine x={Math.round(ts.median)} stroke={MDC} strokeDasharray="4 3" strokeWidth={1.5}/>}
                    {ss.mode&&ts.mode!=null&&<ReferenceLine x={Math.round(ts.mode)} stroke={MOC} strokeDasharray="4 3" strokeWidth={1.5}/>}
                  </BarChart>
                ):(
                  <AreaChart margin={{top:5,right:30,left:10,bottom:15}}>
                    <defs>
                      <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={AC} stopOpacity={0.35}/><stop offset="100%" stopColor={AC} stopOpacity={0}/></linearGradient>
                      <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={AC} stopOpacity={0.12}/><stop offset="100%" stopColor={AC} stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false}/>
                    <XAxis dataKey="x" type="number" domain={["dataMin","dataMax"]} stroke="#484f58" tick={{fontSize:10,fill:"#8b949e",fontFamily:F}} tickFormatter={v=>+v.toFixed(1)} allowDuplicatedCategory={false}/>
                    <YAxis stroke="#484f58" tick={{fontSize:10,fill:"#8b949e",fontFamily:F}} tickFormatter={v=>v.toFixed(2)}/>
                    <Tooltip contentStyle={{background:"#0d1117",border:"1px solid #30363d",borderRadius:6,fontSize:11,fontFamily:F,color:"#c9d1d9"}} formatter={v=>[v?.toFixed(4),""]} labelFormatter={v=>`x = ${(+v).toFixed(3)}`}/>
                    {sE&&<Area data={emp.data} type="stepAfter" dataKey="y" stroke={AC+"44"} fill="url(#eg)" strokeWidth={1} name="Эмпирич." isAnimationActive={false}/>}
                    {sT&&<Area data={theo} type="monotone" dataKey="y" stroke={AC} fill="url(#tg)" strokeWidth={2} name="Теоретич." isAnimationActive={false}/>}
                    {ss.mean&&ts.mean!=null&&<ReferenceLine x={ts.mean} stroke={MC} strokeDasharray="4 3" strokeWidth={1.5} label={{value:"μ",position:"top",fill:MC,fontSize:11,fontFamily:F}}/>}
                    {ss.median&&ts.median!=null&&<ReferenceLine x={ts.median} stroke={MDC} strokeDasharray="4 3" strokeWidth={1.5} label={{value:"Me",position:"top",fill:MDC,fontSize:11,fontFamily:F}}/>}
                    {ss.mode&&ts.mode!=null&&<ReferenceLine x={ts.mode} stroke={MOC} strokeDasharray="4 3" strokeWidth={1.5} label={{value:"Mo",position:"top",fill:MOC,fontSize:11,fontFamily:F}}/>}
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>

            <div style={{fontSize:9,color:"#484f58",marginTop:4,borderTop:"1px solid #21262d",paddingTop:4}}>
              <span style={{color:AC}}>▬</span> PDF/PMF &nbsp;<span style={{color:AC,opacity:0.3}}>▬</span> гистограмма &nbsp;
              <span style={{color:MC}}>┊</span> μ &nbsp;<span style={{color:MDC}}>┊</span> Me &nbsp;<span style={{color:MOC}}>┊</span> Mo
            </div>
          </div>

          {/* CHART 2: Sampling distribution + CI */}
          {showCIC&&sampD&&(
            <div style={{background:"#161b22",borderRadius:8,border:`1px solid ${CC}33`,padding:"14px 14px 8px",display:"flex",flexDirection:"column"}}>
              <div style={{fontSize:11,fontWeight:600,color:CC,marginBottom:6}}>
                ▸ Распределение выборочного среднего
                <span style={{fontWeight:400,fontSize:10,marginLeft:8,color:"#8b949e"}}>
                  sampling distribution of x̄ · {(ciLv*100).toFixed(0)}% CI · {n<30?"t-распр.":"z-норм."}
                </span>
              </div>

              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                <B c={CC} l="x̄" v={ci.mean}/>
                <B c={CC} l="SE" v={ci.se} s={`σ/√n = ${emp.std.toFixed(2)}/√${n}`}/>
                <B c={CC} l="CI" v={`[${ci.lo.toFixed(3)}, ${ci.hi.toFixed(3)}]`}/>
                <B c={CC} l="±" v={ci.z*ci.se} s={`z=${ci.z.toFixed(3)}`}/>
                <B c={CC} l="ширина" v={ci.hi-ci.lo}/>
              </div>

              <div style={{minHeight:200}}>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={sampD} margin={{top:5,right:30,left:10,bottom:15}}>
                    <defs>
                      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CC} stopOpacity={0.08}/><stop offset="100%" stopColor={CC} stopOpacity={0}/></linearGradient>
                      <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CC} stopOpacity={0.4}/><stop offset="100%" stopColor={CC} stopOpacity={0.05}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false}/>
                    <XAxis dataKey="x" type="number" domain={["dataMin","dataMax"]} stroke="#484f58" tick={{fontSize:10,fill:"#8b949e",fontFamily:F}} tickFormatter={v=>(+v).toFixed(2)}/>
                    <YAxis stroke="#484f58" tick={{fontSize:10,fill:"#8b949e",fontFamily:F}} tickFormatter={v=>v.toFixed(1)}/>
                    <Tooltip contentStyle={{background:"#0d1117",border:"1px solid #30363d",borderRadius:6,fontSize:11,fontFamily:F,color:"#c9d1d9"}} formatter={v=>[v?.toFixed(4),""]} labelFormatter={v=>`x̄ = ${(+v).toFixed(4)}`}/>
                    <Area type="monotone" dataKey="yCI" stroke="none" fill="url(#cg)" isAnimationActive={false} name={`${(ciLv*100).toFixed(0)}% CI`}/>
                    <Area type="monotone" dataKey="y" stroke={CC} fill="url(#sg)" strokeWidth={1.5} isAnimationActive={false} name="Sampling dist"/>
                    <ReferenceLine x={ci.mean} stroke={MC} strokeWidth={1.5} strokeDasharray="4 3" label={{value:"x̄",position:"top",fill:MC,fontSize:11,fontFamily:F}}/>
                    <ReferenceLine x={ci.lo} stroke={CC} strokeWidth={1.5} strokeDasharray="3 3" label={{value:ci.lo.toFixed(3),position:"bottom",fill:CC,fontSize:9,fontFamily:F}}/>
                    <ReferenceLine x={ci.hi} stroke={CC} strokeWidth={1.5} strokeDasharray="3 3" label={{value:ci.hi.toFixed(3),position:"bottom",fill:CC,fontSize:9,fontFamily:F}}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div style={{fontSize:9,color:"#484f58",marginTop:4,lineHeight:1.6,borderTop:"1px solid #21262d",paddingTop:4}}>
                <span style={{color:CC}}>▬</span> N(x̄, SE²) — распр. выборочного среднего &nbsp;
                <span style={{color:CC,opacity:0.5}}>█</span> {(ciLv*100).toFixed(0)}% площади &nbsp;
                <span style={{color:CC}}>┊</span> границы CI &nbsp;| &nbsp;
                ↑n → SE↓ → CI сужается &nbsp;| &nbsp;↑CI% → шире интервал
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
