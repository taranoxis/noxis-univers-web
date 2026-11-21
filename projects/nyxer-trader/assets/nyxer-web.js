(() => {
  'use strict';
  const API='http://127.0.0.1:8765/api/nyxer/';
  const $=id=>document.getElementById(id);
  let state=null, report=null, busy=false, polling=false;
  const pendingKey='noxis-nyxer-pending-v1';
  let pending={};
  try {pending=JSON.parse(localStorage.getItem(pendingKey)||'{}')} catch {}
  const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
  const money=(n,currency='USD')=>n===null||n===undefined?'Unavailable':new Intl.NumberFormat(undefined,{style:'currency',currency}).format(n);
  const time=s=>s?new Date(s).toLocaleString():'Not fetched';
  const pct=n=>n===null||n===undefined?'—':n.toFixed(2)+'%';
  function localDay(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
  $('entry-date').value=localDay();$('month').value=localDay().slice(0,7);
  function savePending(){try{localStorage.setItem(pendingKey,JSON.stringify(pending))}catch{}}
  function token(kind,data){const key=JSON.stringify(data);if(!pending[kind]||pending[kind].key!==key){pending[kind]={key,id:crypto.randomUUID()};savePending()}return pending[kind].id}
  async function api(path,data){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(API+path,data===undefined?{cache:'no-store',signal:controller.signal}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:controller.signal});
      let body;try{body=await response.json()}catch{throw Error('Unexpected response (HTTP '+response.status+'). Restart the updated backend.')}
      if(!response.ok)throw Error(body.error||'HTTP '+response.status);
      return body;
    }finally{clearTimeout(timer)}
  }
  function tell(text,error=false){$('connection').textContent=text;$('connection').className='status '+(error?'negative':'positive')}
  function sync(){
    const running=state?.last_job?.status==='running';
    $('cycle').disabled=busy||running||!state;$('market-refresh').disabled=busy||running||!state;
    $('entry-submit').disabled=busy||!state;
    for(const id of ['export-ledger','export-trades'])$(id).disabled=!state;
    $('export-month').disabled=!report||report.month!==$('month').value;
  }
  function stats(id,items){const cards=items.map(([label,value])=>{const d=node('div');d.className='stat';d.append(node('span',label),node('strong',value));return d});$(id).replaceChildren(...cards)}
  function table(id,headers,rows){
    if(!rows.length){$(id).replaceChildren(node('p','No records yet.'));return}
    const t=node('table'),head=node('thead'),hr=node('tr');for(const h of headers)hr.append(node('th',h));head.append(hr);t.append(head);const body=node('tbody');
    for(const row of rows){const tr=node('tr');for(const value of row){const td=node('td');if(value instanceof Node)td.append(value);else td.textContent=String(value??'—');if(td.textContent.length>65)td.className='wrap';tr.append(td)}body.append(tr)}
    t.append(body);$(id).replaceChildren(t);
  }
  function render(){
    if(!state)return;
    const p=state.paper,m=state.market,s=state.summary,c=state.config;
    stats('paper-stats',[
      ['Initial simulated capital',money(p.initial_cash)],['Simulated cash',money(p.cash)],
      ['Equity at saved prices',money(s.equity)],['Open simulated positions',String(Object.keys(p.positions).length)]
    ]);
    $('settings').textContent=`Starting funds: ${money(c.start_cash)}. SMA ${c.fast_sma}/${c.slow_sma}, ${c.interval_min}-minute candles. Configured fee assumption: ${pct(c.fee*100)} per side. Target risk allocation: ${pct(c.risk_per_trade*100)}; stop distance: ${pct(c.stop_loss*100)}; take-profit distance: ${pct(c.take_profit*100)}. New entries halt after a ${pct(c.max_daily_loss*100)} daily equity drop at a cycle check. This is not a guaranteed loss cap.`;
    $('halt').textContent=p.halted?'New simulated entries are halted for the current UTC day. Existing positions are still checked during requested cycles.':'No automatic loop. Use Run one paper cycle to process new closed candles.';
    table('positions',['Asset','Quantity','Entry','Entry fee','Stop','Take profit','Saved close'],Object.entries(p.positions).map(([sym,pos])=>[sym,pos.qty.toFixed(8),money(pos.entry),money(pos.entry_fee),money(pos.stop),money(pos.tp),money(m?.symbols[sym]?.price)]));
    $('market-date').textContent=m?'Source: '+m.source+' · Fetched: '+time(m.fetched_at)+'. Check each candle close time; this snapshot may be stale.':'Market data has not been fetched.';
    table('market-table',['Pair','Closed-candle price','Candle closed','SMA 10','SMA 30','Rule state'],m?Object.entries(m.symbols).map(([sym,row])=>[sym+'/USD',money(row.price),time(row.closed_at),money(row.fast_sma),money(row.slow_sma),row.signal==='long'?'LONG (fast > slow)':'FLAT']):[]);
    const rows=state.ledger.slice(-100).reverse().map(row=>{
      let action='Voided '+time(row.voided_at);
      if(!row.voided_at){action=node('button','Void entry');action.className='danger';action.disabled=busy;action.onclick=()=>{if(confirm('Void this entry? It stays in the history and is excluded from totals.'))mutate('ledger',{action:'void',id:row.id},'Entry voided.')}}
      return [row.date,row.type,money(row.cents/100,'EUR'),row.category,row.description,action];
    });
    table('ledger-table',['Date','Type','EUR','Category','Description','Status / action'],rows);
    stats('performance',[
      ['Net closed P/L',money(s.net_closed_pnl)],['Recorded trading fees',money(s.total_fees)],
      ['Closed simulated trades',String(p.trades.length)],['Net win rate',pct(s.win_rate)]
    ]);
    table('trades',['Closed','Asset','Entry','Exit','Fees','Net P/L','Net %','Reason'],p.trades.slice(-100).reverse().map(t=>[time(t.closed_at),t.symbol,money(t.entry),money(t.exit),money(t.entry_fee+t.exit_fee),money(t.net_pnl),pct(t.net_pnl_pct),t.reason]));
    chart(p.equity_history);
    const job=state.last_job;
    $('job').textContent=job?`${job.kind==='cycle'?'Paper cycle':'Market refresh'} · ${job.status} · started ${time(job.started_at)}\n${job.error||job.message||'Waiting for public market data…'}`:'No market operation has been requested.';
    $('job').className='status job '+(['error','interrupted'].includes(job?.status)?'negative':'');sync();
  }
  function chart(points){
    const box=$('equity-chart');box.replaceChildren();
    if(points.length<2){box.append(node('p','The equity curve appears after two observations.'));return}
    const data=points.slice(-300),values=data.map(p=>p.equity),lo=Math.min(...values),hi=Math.max(...values),range=hi-lo||1;
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 800 180');svg.setAttribute('role','img');svg.setAttribute('aria-label','Last '+data.length+' paper equity observations in USD');
    const line=document.createElementNS(ns,'polyline');line.setAttribute('points',data.map((p,i)=>`${15+i/(data.length-1)*770},${155-(p.equity-lo)/range*130}`).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#f3cb72');line.setAttribute('stroke-width','2');svg.append(line);box.append(svg,node('p',`Observed range: ${money(lo)} — ${money(hi)} · ${time(data[0].time)} → ${time(data.at(-1).time)}`));
  }
  async function refresh(quiet=false){
    if(polling)return;polling=true;
    try{state=await api('status');if(state.mode!=='paper')throw Error('Unexpected mode');render();if(!quiet)tell('Connected · saved state loaded. Market data changes only when requested.')}
    catch(error){tell('Saved state unavailable: '+error.message,true)}
    finally{polling=false;sync()}
  }
  async function loadReport(){
    const month=$('month').value;if(!month)return;
    try{const r=await api('report?month='+encodeURIComponent(month));if($('month').value!==month)return;report=r;stats('report-stats',[
      ['Recorded income',money(r.income_cents/100,'EUR')],['Recorded expenses',money(r.expense_cents/100,'EUR')],['Recorded balance',money(r.balance_cents/100,'EUR')],['Entries in month',String(r.entries.filter(e=>!e.voided_at).length)]
    ]);$('report-status').textContent='Loaded '+r.month+' · EUR register only.'}
    catch(error){report=null;$('report-stats').replaceChildren();$('report-status').textContent=error.message}
    sync();
  }
  async function mutate(kind,payload,message){
    if(busy)return false;busy=true;sync();
    const request_id=token(kind,payload);
    try{
      await api(kind,{...payload,request_id});delete pending[kind];savePending();
      await refresh(true);await loadReport();tell(message);return true;
    }catch(error){tell('Operation not confirmed: '+error.message+' Refresh saved state before repeating an uncertain request.',true);return false}
    finally{busy=false;render();sync()}
  }
  $('refresh').onclick=async()=>{await refresh();await loadReport()};
  $('cycle').onclick=()=>mutate('cycle',{},'Paper cycle submitted. Follow its saved status above.');
  $('market-refresh').onclick=()=>mutate('market',{},'Market refresh submitted. No simulated trading requested.');
  $('entry-form').onsubmit=async event=>{event.preventDefault();const ok=await mutate('ledger',{action:'add',date:$('entry-date').value,type:$('entry-type').value,amount:$('entry-amount').value,category:$('entry-category').value,description:$('entry-description').value},'EUR entry saved.');if(ok){$('entry-amount').value='';$('entry-description').value=''}};
  $('month').onchange=()=>{report=null;sync();loadReport()};$('report-refresh').onclick=loadReport;
  for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>{
    for(const item of document.querySelectorAll('[data-tab]')){const on=item===button;item.setAttribute('aria-selected',String(on));$(item.dataset.tab).hidden=!on}
    if(button.dataset.tab==='reports')loadReport();
    if(button.dataset.tab==='proposals')loadProposals();
  };
  function csvCell(value){if(typeof value==='number'&&Number.isFinite(value))return String(value);let s=String(value??'');if(/^[\s]*[=+@\-\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'}
  function download(name,headers,rows){
    const body='\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([body],{type:'text/csv;charset=utf-8'})),link=node('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  function exportLedger(rows,name){download(name,['date','type','amount','currency','category','description','status','created_at','voided_at'],rows.map(r=>[r.date,r.type,(r.cents/100).toFixed(2),'EUR',r.category,r.description,r.voided_at?'voided':'active',r.created_at,r.voided_at||'']))}
  $('export-ledger').onclick=()=>{if(state)exportLedger(state.ledger,'nyxer-web-ledger.csv')};
  $('export-month').onclick=()=>{if(report&&report.month===$('month').value)exportLedger(report.entries,'nyxer-ledger-'+report.month+'.csv')};
  $('export-trades').onclick=()=>{if(state)download('nyxer-paper-trades.csv',['closed_at','symbol','quantity','entry_usd','exit_usd','entry_fee_usd','exit_fee_usd','net_pnl_usd','net_pnl_pct','reason'],state.paper.trades.map(t=>[t.closed_at,t.symbol,t.qty,t.entry,t.exit,t.entry_fee,t.exit_fee,t.net_pnl,t.net_pnl_pct,t.reason]))};
  // --- Propuneri de ordin: Nyxer propune, tu aprobi sau respingi ---
  let proposals=[];
  const proposalStatus=s=>({pending:'în așteptare',approved:'aprobată',rejected:'respinsă',expired:'expirată',executed_paper:'executată în simulare'})[s]||s;
  async function loadProposals(){
    try{const r=await api('proposals');proposals=r.items;renderProposals()}
    catch(error){$('proposal-status').textContent='Propuneri indisponibile: '+error.message}
  }
  function renderProposals(){
    const box=$('proposal-list');
    if(!proposals.length){box.replaceChildren(node('p','Nicio propunere încă.'));return}
    const t=node('table'),head=node('thead'),hr=node('tr');
    for(const h of ['Creată','Asset','Direcție','Cantitate','Preț ref.','Valoare','Stare','Motiv','Acțiune'])hr.append(node('th',h));
    head.append(hr);t.append(head);const body=node('tbody');
    for(const p of proposals){
      const tr=node('tr');
      const cells=[time(p.created_at),p.symbol,p.side==='buy'?'Cumpărare':'Vânzare',p.qty,money(p.price_ref,p.currency),money(p.amount_eur_or_usd,p.currency),proposalStatus(p.status),p.reason];
      for(const v of cells){const td=node('td');td.textContent=String(v??'—');if(td.textContent.length>65)td.className='wrap';tr.append(td)}
      const td=node('td');const id8=p.id.slice(0,8);
      if(p.mode==='live'){td.textContent='Live dezactivat'}
      else if(p.status==='pending'){
        const input=node('input');input.placeholder='APROB '+id8;input.maxLength=20;input.setAttribute('aria-label','Confirmare pentru '+id8);
        const yes=node('button','APROB');yes.className='primary';yes.onclick=()=>proposalAction('approve',{id:id8,confirm:input.value.trim()},'Propunere aprobată.');
        const no=node('button','RESPING');no.onclick=()=>proposalAction('reject',{id:id8},'Propunere respinsă.');
        td.append(input,yes,no);
      }
      else if(p.status==='approved'){
        const run=node('button','Marchează executată în simulare');run.onclick=()=>proposalAction('execute',{id:id8},'Marcată executată în simulare (nu modifică portofoliul de simulare).');td.append(run);
      }
      else td.textContent='—';
      tr.append(td);body.append(tr);
    }
    t.append(body);box.replaceChildren(t);
  }
  async function proposalAction(action,payload,message){
    if(busy)return false;busy=true;
    try{await api('proposals/'+action,payload);tell(message);await loadProposals();return true}
    catch(error){tell(error.message,true);return false}
    finally{busy=false}
  }
  $('proposal-form').onsubmit=async event=>{
    event.preventDefault();
    const ok=await proposalAction('create',{symbol:$('p-symbol').value,side:$('p-side').value,qty:$('p-qty').value,price_ref:$('p-price').value,mode:'paper',reason:$('p-reason').value},'Propunere simulată creată. Trebuie aprobată explicit.');
    if(ok){$('p-qty').value='';$('p-price').value='';$('p-reason').value=''}
  };
  $('p-suggest').onclick=async()=>{
    if(busy)return;busy=true;
    try{const r=await api('proposals/suggest',{});tell(r.created.length?`Am creat ${r.created.length} propuneri. Verifică-le și aprobă-le sau respinge-le.`:'Nicio sugestie nouă: fie nu există semnal LONG, fie există deja o poziție sau o propunere.');await loadProposals()}
    catch(error){tell(error.message,true)}
    finally{busy=false}
  };
  sync();refresh().then(loadReport);
  setInterval(()=>{if(!document.hidden&&!busy)refresh(true)},4000);
})();
