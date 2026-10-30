'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={stocks:[],quotes:{},history:null,themes:[],gaps:[],ipos:[],asOf:'',scan:'vcp',core:null,chartData:null,chartPoints:[],chartMode:'close',chartRange:'6M',watchlist:[],tags:{},savedScans:[]};
const STORE={watch:'marketlens.watchlist.v1',tags:'marketlens.tags.v1',scans:'marketlens.savedScans.v1'};
function readStore(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v??fallback;}catch{return fallback;}}
function writeStore(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function loadPersonal(){state.watchlist=readStore(STORE.watch,[]).filter(x=>typeof x==='string');state.tags=readStore(STORE.tags,{});state.savedScans=readStore(STORE.scans,[]).filter(x=>x&&typeof x.name==='string'&&['rs','mom','turnover','ret3','price','stage'].includes(x.field)&&['gte','lte','eq'].includes(x.op)&&finite(x.value));}
const finite=MarketLensCore.finite;
const fmt=(v,d=1)=>finite(v)?Number(v).toLocaleString('en-IN',{maximumFractionDigits:d}):'—';
const pct=v=>finite(v)?`${Number(v)>0?'+':''}${fmt(v)}%`:'—';
const rupee=v=>finite(v)?'₹'+fmt(v,2):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const val=(o,k)=>o&&finite(o[k])?Number(o[k]):null;
const stageLabel=n=>({1:'Stage 1',2:'Stage 2',3:'Stage 3',4:'Stage 4'}[n]||'—');
const scanDefs=[
 ['vcp','VCP candidates','Three progressively shallower pullbacks, final contraction ≤8%, volume dry-up and price above the 50-day average. Candidate only; chart confirmation is required.'],
 ['cup','Cup & Handle candidates','Candidate flag checks cup depth, duration, rim recovery and handle depth. It does not prove a smooth rounded U; confirm the structure visually.'],
 ['fl','Flag candidates','Candidate requires a ≥25% pole, pullback ≤12% and a 3–25 session consolidation. Confirm pole and flag shape visually.'],
 ['pp','Pocket pivots','Pocket-pivot flag from the supplied pipeline.'],
 ['dvb','Darvas breakouts (last 5 sessions)','Price crossed the detected Darvas-box top within the latest five sessions. The separate status identifies a breakout today.'],
 ['dvi','Darvas box forming','Price is near the upper part of the latest detected Darvas box without a recorded breakout.'],
 ['my','Multi-year breakout zone','Price remains within 15% above a multi-year high that was crossed in the recent 60-session window; this is not necessarily a breakout today.'],
 ['breakoutToday','Generic pivot breakout today','Latest close crossed the supplied generic pivot level. Cup/flag/Darvas breakouts are tracked separately.'],
 ['b50','52-week high breakout','Close above the previous 50-session high; not simply above the 50-day moving average.'],
 ['inside5','Inside-day count','Count of nested inside bars in the latest five sessions; this is not an independent breakout signal.'],
 ['trend8','Trend template 8/8','All eight supplied trend-template checks passed.']
];
async function load(){
 try{
  const files=['summary.json','quotes.json','history.json','themes.json','gaps.json','ipos.json'];
  const [s,q,h,t,g,i]=await Promise.all(files.map(f=>fetch('data/'+f).then(r=>{if(!r.ok)throw Error(f+' missing ('+r.status+')');return r.json()})));
  const normalized=MarketLensCore.normalize(s,q,h);
  state.core=normalized;state.stocks=normalized.stocks;state.quotes=q.quotes||{};state.history=h;state.themes=t.themes||[];state.gaps=Array.isArray(g)?g:[];state.ipos=Array.isArray(i)?i:[];state.asOf=normalized.quoteAsOf||'—';
  init();
 }catch(e){const main=$('main');if(main)main.innerHTML=`<div class="empty">Could not load MarketLens data. Keep the data folder beside index.html and open through GitHub Pages or a local web server.<br><br>${esc(e.message)}</div>`;}
}
function init(){
 loadPersonal();
 $('#dataDate').textContent=state.asOf;$('#overviewAsOf').textContent='Quotes as of '+state.asOf;
 $('#footerData').textContent=`Quotes: ${state.core.quoteAsOf||'—'} · Close history through: ${state.core.technicalAsOf||'—'}`;
 $('#universeCount').textContent=fmt(state.stocks.length,0);const hasMembership=state.stocks.some(x=>typeof x.inNiftyTotalMarket==='boolean');$('#universeFilter').disabled=!hasMembership;if(!hasMembership){$('#universeFilter').value='all';$('#universeFilter').title='Official membership is not present in this uploaded snapshot. Run the updated data pipeline before using this filter.';$('#universeFilter').options[1].textContent='Nifty Total Market (refresh required)';}populateSectors();renderOverview();renderScreener();renderSwing();renderScans();renderWorkspace();renderThemes();renderGaps();renderIpos();runMomentumBacktest();renderBacktestAudit();bind();
}
function populateSectors(){const sectors=[...new Set(state.stocks.map(x=>x.sector).filter(x=>typeof x==='string'&&x.trim()))].sort();$('#sectorFilter').innerHTML='<option value="">All sectors</option>'+sectors.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');}
function table(rows){if(!rows.length)return '<div class="empty">No stocks match these filters.</div>';return `<table class="data-table"><thead><tr><th>STOCK</th><th>PRICE</th><th>DAY %</th><th>RS</th><th>MOMENTUM</th><th>STAGE</th><th>TURNOVER ₹Cr</th><th>MY TAGS</th></tr></thead><tbody>${rows.map(x=>`<tr data-symbol="${esc(x.symbol)}"><td class="stock-name">${esc(x.symbol)}<small>${esc(x.name||x.sector||'')}</small></td><td>${rupee(x.price)}</td><td class="${finite(x.change)&&x.change>=0?'positive':'negative'}">${pct(x.change)}</td><td>${fmt(x.rs,0)}</td><td>${fmt(x.mom)}</td><td><span class="pill ${x.stage===2?'green':''}">${stageLabel(x.stage)}</span></td><td>${fmt(x.turnover)}</td><td>${esc((state.tags[x.symbol]||[]).join(', ')||'—')}</td></tr>`).join('')}</tbody></table>`;}
function countWhere(fn){return state.stocks.filter(fn).length;}
function renderOverview(){
 const validRS=state.stocks.filter(x=>finite(x.rs));const stage2=countWhere(x=>x.stage===2),highRS=countWhere(x=>finite(x.rs)&&x.rs>=90),liquid=countWhere(x=>finite(x.turnover)&&x.turnover>=10);
 $('#metrics').innerHTML=[['STOCK UNIVERSE',fmt(state.stocks.length,0),'Rows in supplied summary'],['STAGE 2',fmt(stage2,0),`${pct(stage2/state.stocks.length*100)} of supplied universe`],['RS ≥ 90',fmt(highRS,0),'Valid supplied RS ratings'],['LIQUIDITY ≥ ₹10Cr',fmt(liquid,0),'Supplied 50-day average traded value']].map(a=>`<div class="metric"><div class="metric-label">${a[0]}</div><div class="metric-value">${a[1]}</div><div class="metric-note">${a[2]}</div></div>`).join('');
 $('#leaderTable').innerHTML=table([...validRS].sort((a,b)=>b.rs-a.rs).slice(0,7));
 $('#themeLeaders').innerHTML=[...state.themes].filter(t=>finite(t.score)).sort((a,b)=>b.score-a.score).slice(0,6).map(t=>`<div class="theme-row"><div style="flex:1"><strong>${esc(t.name)}</strong><small>${esc(t.count||'')}</small><div class="bar"><span style="width:${Math.max(0,Math.min(100,Number(t.score)))}%"></span></div></div><span class="theme-score">${fmt(t.score,0)}</span></div>`).join('')||'<div class="empty">No theme data</div>';
 const tiles=[['VCP candidates','vcp'],['Cup & Handle','cup'],['Flag candidates','fl'],['Darvas breakout','dvb'],['Trend template 8/8','trend8']];$('#scanTiles').innerHTML=tiles.map(([n,k])=>`<div class="scan-tile" data-scan="${k}"><strong>${scanAvailable(k)?fmt(scanCount(k),0):'N/A'}</strong><span>${n}</span></div>`).join('');
}
function scanAvailable(key){
 if(key==='trend8')return state.stocks.some(x=>finite(x.trend));
 return state.stocks.some(x=>Object.prototype.hasOwnProperty.call(x,key)&&finite(x[key]));
}
function scanMatch(x,key){if(!scanAvailable(key))return false;if(key==='trend8')return finite(x.trend)&&x.trend>=8;return finite(x[key])&&x[key]>0;}
function scanCount(key){return scanAvailable(key)?countWhere(x=>scanMatch(x,key)):null;}
function scanDetails(x,key){
 const items=[];
 const stateKey=({vcp:'vcpState',cup:'cupState',fl:'flagState',dvb:'darvasState',dvi:'darvasState'})[key];
 if(stateKey&&x[stateKey])items.push('Status: '+String(x[stateKey]).replaceAll('_',' '));
 if(key==='vcp'&&Array.isArray(x.pbs))items.push('Pullbacks '+x.pbs.join(' / ')+'%');
 if(key==='vcp'&&finite(x.vcpBreakoutToday)&&x.vcpBreakoutToday)items.push('VCP pivot crossed today');
 if(key==='cup'){if(finite(x.cupD))items.push('Cup depth '+fmt(x.cupD)+'%');if(finite(x.hD))items.push('Handle '+fmt(x.hD)+'%');if(finite(x.cupPivot))items.push('Cup pivot ₹'+fmt(x.cupPivot,2));}
 if(key==='fl'){if(finite(x.pole))items.push('Pole '+fmt(x.pole)+'%');if(finite(x.fD))items.push('Pullback '+fmt(x.fD)+'%');if(x.flagBreakoutToday)items.push('Pole high crossed today');}
 if(key==='dvb'&&x.darvasBreakoutToday)items.push('Box top crossed today');
 if(key==='breakoutToday'&&finite(x.pv))items.push('Pivot ₹'+fmt(x.pv,2));
 if(key==='my'&&finite(x.cy))items.push('Base span '+fmt(x.cy)+' years');
 return items.join(' · ')||'—';
}
function renderScanTable(rows,key){
 if(!rows.length)return '<div class="empty">No stocks match this scan.</div>';
 return `<table class="data-table"><thead><tr><th>STOCK</th><th>PRICE</th><th>RS</th><th>MOMENTUM</th><th>STAGE</th><th>TURNOVER ₹Cr</th><th>SETUP DETAILS</th></tr></thead><tbody>${rows.map(x=>`<tr data-symbol="${esc(x.symbol)}"><td class="stock-name">${esc(x.symbol)}<small>${esc(x.name||x.sector||'')}</small></td><td>${rupee(x.price)}</td><td>${fmt(x.rs,0)}</td><td>${fmt(x.mom)}</td><td><span class="pill ${x.stage===2?'green':''}">${stageLabel(x.stage)}</span></td><td>${fmt(x.turnover)}</td><td>${esc(scanDetails(x,key))}</td></tr>`).join('')}</tbody></table>`;
}
function filtered(){
 let a=[...state.stocks],q=$('#search').value.trim().toLowerCase(),stage=$('#stageFilter').value,sector=$('#sectorFilter').value,sort=$('#sortBy').value,universe=$('#universeFilter').value;
 if(universe==='nifty-total-market')a=a.filter(x=>x.inNiftyTotalMarket===true);
 if(q)a=a.filter(x=>(x.symbol+' '+(x.name||'')).toLowerCase().includes(q));if(stage)a=a.filter(x=>String(x.stage)===stage);if(sector)a=a.filter(x=>x.sector===sector);
 if($('#rs90').checked)a=a.filter(x=>finite(x.rs)&&x.rs>=90);
 if($('#liquid').checked)a=a.filter(x=>finite(x.turnover)&&x.turnover>=10);
 if($('#above50').checked)a=a.filter(x=>x.a50===1);
 if($('#vcp').checked)a=a.filter(x=>finite(x.vcp)&&x.vcp>0);
 if($('#breakout').checked)a=a.filter(x=>finite(x.breakoutToday)&&x.breakoutToday>0);
 if($('#trend8').checked)a=a.filter(x=>finite(x.trend)&&x.trend>=8);
 if($('#cupFilter').checked)a=a.filter(x=>finite(x.cup)&&x.cup>0);
 if($('#flagFilter').checked)a=a.filter(x=>finite(x.fl)&&x.fl>0);
 if($('#pocketFilter').checked)a=a.filter(x=>finite(x.pp)&&x.pp>0);
 if($('#darvasFilter').checked)a=a.filter(x=>finite(x.dvb)&&x.dvb>0);
 a.sort((x,y)=>{const xv=val(x,sort),yv=val(y,sort);if(xv===null&&yv===null)return 0;if(xv===null)return 1;if(yv===null)return -1;return yv-xv;});return a;
}
function renderScreener(){const a=filtered();$('#resultCount').textContent=fmt(a.length,0)+' results';$('#screenerTable').innerHTML=table(a.slice(0,500));}
function renderSwing(){const a=state.stocks.filter(x=>finite(x.rs)&&x.rs>=90&&finite(x.turnover)&&x.turnover>=10&&finite(x.mom)).sort((x,y)=>y.mom-x.mom);$('#swingTable').innerHTML=table(a.slice(0,200));$('#swingTable').insertAdjacentHTML('afterbegin',`<p class="muted">Rule: RS ≥ 90, 50-day average traded value ≥ ₹10Cr/day, and a valid momentum score. ${a.length} qualifying stocks from the supplied snapshot. Missing values are excluded.</p>`);}
function renderWorkspace(){const rows=state.watchlist.map(sym=>state.core.bySymbol[sym]).filter(Boolean);$('#workspaceMetrics').innerHTML=[['WATCHLIST',rows.length,'Stocks saved in this browser'],['TAGGED STOCKS',Object.keys(state.tags).filter(k=>(state.tags[k]||[]).length).length,'Symbols with at least one tag'],['SAVED SCANS',state.savedScans.length,'Executable filter rules']].map(a=>`<div class="metric"><div class="metric-label">${a[0]}</div><div class="metric-value">${fmt(a[1],0)}</div><div class="metric-note">${a[2]}</div></div>`).join('');$('#workspaceWatchlist').innerHTML=rows.length?`<table class="data-table"><thead><tr><th>STOCK</th><th>PRICE</th><th>RS</th><th>MOMENTUM</th><th>STAGE</th><th>TAGS</th><th></th></tr></thead><tbody>${rows.map(x=>`<tr><td class="stock-name" data-symbol="${esc(x.symbol)}">${esc(x.symbol)}<small>${esc(x.name||'')}</small></td><td>${rupee(x.price)}</td><td>${fmt(x.rs,0)}</td><td>${fmt(x.mom)}</td><td>${stageLabel(x.stage)}</td><td>${esc((state.tags[x.symbol]||[]).join(', ')||'—')}</td><td><button class="mini-action" data-remove-watch="${esc(x.symbol)}">Remove</button></td></tr>`).join('')}</tbody></table>`:'<div class="empty">Your watchlist is empty. Open a stock from the screener or Swing ideas and choose “Add to watchlist”.</div>';$('#workspaceScans').innerHTML=state.savedScans.length?state.savedScans.map((x,i)=>`<div class="saved-scan-row"><strong>${esc(x.name)}</strong><span>${esc(x.field)} ${x.op==='gte'?'≥':x.op==='lte'?'≤':'='} ${fmt(x.value,2)}</span><button class="mini-action" data-run-saved="${i}">Run</button><button class="mini-action" data-delete-saved="${i}">Delete</button></div>`).join(''):'<div class="empty">No saved custom scans yet.</div>';}
function renderScans(){
 const d=scanDefs.find(x=>x[0]===state.scan)||scanDefs[0];
 $('#scanMenu').innerHTML=scanDefs.map(x=>`<button class="scan-option ${state.scan===x[0]?'active':''}" data-scan="${x[0]}"><strong>${x[1]}</strong><small>${scanAvailable(x[0])?fmt(scanCount(x[0]),0)+' matches':'Data unavailable'}</small></button>`).join('');
 const available=scanAvailable(state.scan),a=state.stocks.filter(x=>scanMatch(x,state.scan)).sort((x,y)=>(val(y,'rs')??-Infinity)-(val(x,'rs')??-Infinity));
 $('#scanTitle').textContent=d[1];$('#scanDescription').textContent=d[2];$('#scanCount').textContent=available?fmt(a.length,0):'N/A';
 $('#scanTable').innerHTML=available?renderScanTable(a.slice(0,250),state.scan):'<div class="empty">Pattern data is unavailable in this data snapshot. Run the updated OHLCV data pipeline and refresh summary.json before using this scan. This is not the same as zero qualifying stocks.</div>';
}
function renderThemes(){$('#themeGrid').innerHTML=state.themes.map(t=>`<article class="theme-card"><div class="theme-card-top"><h3>${esc(t.name)}</h3><span class="score">${fmt(t.score,0)}</span></div><div class="bar"><span style="width:${finite(t.score)?Math.max(0,Math.min(100,Number(t.score))):0}%"></span></div><div class="theme-stats"><span>Relative strength<b>${fmt(t.rs,0)}</b></span><span>Breadth<b>${finite(t.breadth)?fmt(t.breadth)+'%':'—'}</b></span><span>Persistence<b>${finite(t.persist)?fmt(t.persist)+'%':'—'}</b></span></div><div class="theme-members">${esc((t.members||[]).join(' · '))}</div></article>`).join('')||'<div class="empty">No theme data</div>';}
function simpleTable(headers,rows){return `<table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
function renderGaps(){const rows=[...state.gaps].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,500);$('#gapTable').innerHTML=rows.length?simpleTable(['SYMBOL','DATE','OPEN','PREV CLOSE','GAP %','CLOSE'],rows.map(x=>{const gap=finite(x.open)&&finite(x.prevClose)&&Number(x.prevClose)!==0?(Number(x.open)/Number(x.prevClose)-1)*100:null;return [`<span class="stock-name">${esc(x.symbol)}</span>`,esc(x.date),rupee(x.open),rupee(x.prevClose),`<span class="${finite(gap)&&gap>=0?'positive':'negative'}">${pct(gap)}</span>`,rupee(x.close)];})): '<div class="empty">No gap records</div>';}
function renderIpos(){const rows=[...state.ipos].sort((a,b)=>(b.ld||'').localeCompare(a.ld||'')).slice(0,500);$('#ipoTable').innerHTML=rows.length?simpleTable(['SYMBOL','COMPANY','LISTED','LISTING PRICE','LAST PRICE','SINCE LISTING','FROM HIGH'],rows.map(x=>[`<span class="stock-name">${esc(x.symbol)}</span>`,esc(x.name),esc(x.ld),rupee(x.lc),rupee(x.last),`<span class="${finite(x.since)&&x.since>=0?'positive':'negative'}">${pct(x.since)}</span>`,`<span class="${finite(x.fromHi)&&x.fromHi>=0?'positive':'negative'}">${pct(x.fromHi)}</span>`])):'<div class="empty">No IPO records</div>';}
async function showStock(sym){
 const x=state.core.bySymbol[sym];if(!x)return;
 const points=(x.closeHistory?.points||[]).slice(-180);
 let candles=null,candleError='';
 try{const r=await fetch('data/candles/'+encodeURIComponent(sym)+'.json');if(!r.ok)throw Error('Local OHLCV candle file is not available');candles=validateCandles(await r.json());if(!candles)throw Error('Candle file failed OHLCV validation');}catch(e){candleError=e.message;}
 const hasCandles=!!candles;
 $('#modalContent').innerHTML=`<div class="eyebrow">NSE EQUITY · STOCK DETAIL</div><h2>${esc(x.symbol)}</h2><div class="stock-meta">${esc(x.name||'')} · ${esc(x.sector||'Sector not provided')}</div><div class="detail-grid">${[['LAST PRICE',rupee(x.price)],['DAY CHANGE',pct(x.change)],['RS RATING',fmt(x.rs,0)],['MOMENTUM',fmt(x.mom)],['STAGE',stageLabel(x.stage)],['TURNOVER',finite(x.turnover)?'₹'+fmt(x.turnover)+' Cr':'—'],['FROM 52W HIGH',pct(x.fromHigh)],['VS BENCHMARK',pct(x.bi)]].map(a=>`<div class="detail-stat"><small>${a[0]}</small><strong>${a[1]}</strong></div>`).join('')}</div><div class="detail-actions"><button class="reset-btn" id="addWatchFromDetail" data-symbol="${esc(sym)}">${state.watchlist.includes(sym)?'Already in watchlist':'Add to watchlist'}</button><label class="tag-editor">Tags <input id="stockTags" value="${esc((state.tags[sym]||[]).join(', '))}" placeholder="VCP, Breakout, Pullback" maxlength="120"></label><button class="reset-btn" id="saveStockTags" data-symbol="${esc(sym)}">Save tags</button></div><div class="eyebrow">PATTERN FLAGS · PIPELINE SNAPSHOT</div><p class="stock-meta">${[['VCP',x.vcp,x.vcpState],['Cup & Handle',x.cup,x.cupState],['Flag',x.fl,x.flagState],['Pocket Pivot',x.pp,null],['Darvas breakout',x.dvb,x.darvasState],['Darvas box',x.dvi,x.darvasState]].map(([n,v,st])=>`${n}: ${finite(v)?(v>0?'Yes':'No'):'Not available'}${st?' ('+String(st).replaceAll('_',' ')+')':''}`).join(' · ')}</p><div class="eyebrow">${hasCandles?'DAILY OHLCV CANDLE CHART':'DAILY CLOSE HISTORY'}</div><div class="chart-range"><span>TIMEFRAME</span>${[['1M','1M'],['3M','3M'],['6M','6M'],['1Y','1Y'],['ALL','ALL']].map(([v,l])=>`<button type="button" class="chart-range-btn ${v==='6M'?'active':''}" data-chart-range="${v}">${l}</button>`).join('')}</div>${hasCandles?`<div class="chart-tools"><label><input type="checkbox" data-overlay="ema9" checked> EMA 9</label><label><input type="checkbox" data-overlay="ema20" checked> EMA 20</label><label><input type="checkbox" data-overlay="sma50"> SMA 50</label><label><input type="checkbox" data-overlay="sma200"> SMA 200</label><label><input type="checkbox" data-overlay="supertrend"> Supertrend 7,3</label></div><div id="indicatorReadout" class="indicator-readout"></div>`:''}<div class="chart-wrap"><canvas id="priceChart"></canvas></div><div class="chart-caption">${hasCandles?`${candles.d.length} validated OHLCV sessions · ${candles.d[0]} to ${candles.d.at(-1)} · Source: local data/candles/${esc(sym)}.json`:points.length?`${points.length} daily closing-price observations · ${points[0].date} to ${points.at(-1).date} · Close-only fallback; ${esc(candleError)}`:'No valid OHLCV candle file or closing-price history available for this symbol.'}</div><p class="stock-meta">Quote date: ${esc(state.core.quoteAsOf||'—')} · Technical history through: ${esc(state.core.technicalAsOf||'—')}. No synthetic chart data is displayed.</p>`;
 $('#modal').classList.add('show');state.chartRange='6M';state.chartData=hasCandles?candles:null;state.chartPoints=points;state.chartMode=hasCandles?'candles':'close';if(hasCandles)renderIndicatorPanel(candles);requestAnimationFrame(()=>{if(hasCandles)drawCandles(candles);else if(points.length)drawCloseHistory(points);});
}
function drawCloseHistory(points){
 const c=$('#priceChart');if(!c||!points?.length)return;
 const ranges={'1M':21,'3M':63,'6M':126,'1Y':252,'ALL':points.length};
 const data=points.slice(-Math.min(points.length,ranges[state.chartRange]||126)).filter(p=>finite(p.close));
 if(data.length<2){c.parentElement.innerHTML='<div class="empty">Not enough valid daily closing prices to draw this chart.</div>';return;}
 const dpr=window.devicePixelRatio||1,w=Math.max(280,c.clientWidth||280),h=Math.max(220,c.clientHeight||260);c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 const vals=data.map(p=>Number(p.close)),lo=Math.min(...vals),hi=Math.max(...vals),span=hi-lo||Math.max(1,hi*.02),left=12,right=12,top=18,bottom=25,pw=w-left-right,ph=h-top-bottom;
 ctx.font='10px sans-serif';ctx.fillStyle='#7d8798';ctx.strokeStyle='#e9edf3';ctx.lineWidth=1;
 for(let i=0;i<4;i++){const y=top+ph*i/3;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();const v=hi-(span*i/3);ctx.fillText('₹'+v.toFixed(2),left+3,y-4);}
 const x=i=>left+(i/(vals.length-1))*pw,y=v=>top+((hi-v)/span)*ph;
 ctx.beginPath();vals.forEach((v,i)=>{if(i===0)ctx.moveTo(x(i),y(v));else ctx.lineTo(x(i),y(v));});ctx.strokeStyle='#496de0';ctx.lineWidth=2;ctx.stroke();
 const last=vals.at(-1),first=vals[0],up=last>=first;ctx.lineTo(x(vals.length-1),top+ph);ctx.lineTo(x(0),top+ph);ctx.closePath();ctx.fillStyle=up?'rgba(22,134,91,.09)':'rgba(211,75,85,.08)';ctx.fill();
 ctx.fillStyle='#667287';ctx.fillText(data[0].date,left,h-7);const end=data.at(-1).date;ctx.textAlign='right';ctx.fillText(end,w-right,h-7);ctx.textAlign='left';
 const cap=$('.chart-caption');if(cap)cap.textContent=`${data.length} daily closing-price observations · ${data[0].date} to ${end} · Close-only history; OHLCV candles are not available for this symbol.`;
}
function redrawActiveChart(){if(state.chartMode==='candles'&&state.chartData)drawCandles(state.chartData);else drawCloseHistory(state.chartPoints);}
function validateCandles(x){
 if(!x||!Array.isArray(x.d)||!['o','h','l','c','v'].every(k=>Array.isArray(x[k])))return null;
 const n=x.d.length;if(n<2||!['o','h','l','c','v'].every(k=>x[k].length===n))return null;
 let prior='';
 for(let i=0;i<n;i++){const o=Number(x.o[i]),h=Number(x.h[i]),l=Number(x.l[i]),c=Number(x.c[i]),v=Number(x.v[i]),date=String(x.d[i]||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||date<=prior||![o,h,l,c,v].every(Number.isFinite)||o<=0||h<=0||l<=0||c<=0||h<Math.max(o,c,l)||l>Math.min(o,c)||v<0)return null;
  prior=date;
 }
 return {d:x.d.slice(-260),o:x.o.slice(-260).map(Number),h:x.h.slice(-260).map(Number),l:x.l.slice(-260).map(Number),c:x.c.slice(-260).map(Number),v:x.v.slice(-260).map(Number)};
}
function ema(values,period){const out=Array(values.length).fill(null);if(values.length<period)return out;const k=2/(period+1);let seed=values.slice(0,period).reduce((a,b)=>a+b,0)/period;out[period-1]=seed;for(let i=period;i<values.length;i++){seed=values[i]*k+seed*(1-k);out[i]=seed;}return out;}
function smaSeries(values,period){return values.map((_,i)=>i+1<period?null:values.slice(i-period+1,i+1).reduce((a,b)=>a+b,0)/period);}
function atrSeries(x,period=7){const tr=x.c.map((c,i)=>i===0?x.h[i]-x.l[i]:Math.max(x.h[i]-x.l[i],Math.abs(x.h[i]-x.c[i-1]),Math.abs(x.l[i]-x.c[i-1])));const out=Array(tr.length).fill(null);if(tr.length<period)return out;let a=tr.slice(0,period).reduce((s,v)=>s+v,0)/period;out[period-1]=a;for(let i=period;i<tr.length;i++){a=(a*(period-1)+tr[i])/period;out[i]=a;}return out;}
function rsi(values,period=14){if(values.length<=period)return null;let gain=0,loss=0;for(let i=1;i<=period;i++){const d=values[i]-values[i-1];gain+=Math.max(0,d);loss+=Math.max(0,-d);}gain/=period;loss/=period;for(let i=period+1;i<values.length;i++){const d=values[i]-values[i-1];gain=(gain*(period-1)+Math.max(0,d))/period;loss=(loss*(period-1)+Math.max(0,-d))/period;}return loss===0?(gain===0?50:100):100-100/(1+gain/loss);}
function supertrend(x,period=7,mult=3){const atr=atrSeries(x,period),n=x.c.length,st=Array(n).fill(null),dir=Array(n).fill(1),fu=Array(n).fill(null),fl=Array(n).fill(null);for(let i=0;i<n;i++){if(atr[i]===null)continue;const mid=(x.h[i]+x.l[i])/2,bu=mid+mult*atr[i],bl=mid-mult*atr[i];if(i===period-1){fu[i]=bu;fl[i]=bl;dir[i]=1;st[i]=fl[i];continue;}fu[i]=(bu<fu[i-1]||x.c[i-1]>fu[i-1])?bu:fu[i-1];fl[i]=(bl>fl[i-1]||x.c[i-1]<fl[i-1])?bl:fl[i-1];if(dir[i-1]===1)dir[i]=x.c[i]<fl[i]?-1:1;else dir[i]=x.c[i]>fu[i]?1:-1;st[i]=dir[i]===1?fl[i]:fu[i];}return {line:st,dir};}
function indicatorData(x){const st=supertrend(x);const avg=x.v.slice(-51,-1).reduce((a,b)=>a+b,0)/Math.max(1,x.v.slice(-51,-1).length);return {ema9:ema(x.c,9),ema20:ema(x.c,20),sma50:smaSeries(x.c,50),sma200:smaSeries(x.c,200),supertrend:st,rsi14:rsi(x.c,14),rvol:avg>0?x.v.at(-1)/avg:null};}
function renderIndicatorPanel(x){const d=indicatorData(x),el=$('#indicatorReadout');if(!el)return;el.innerHTML=[['RSI 14',finite(d.rsi14)?fmt(d.rsi14,1):'—'],['RVOL vs 50D',finite(d.rvol)?fmt(d.rvol,2)+'×':'—'],['EMA 9',finite(d.ema9.at(-1))?rupee(d.ema9.at(-1)):'—'],['EMA 20',finite(d.ema20.at(-1))?rupee(d.ema20.at(-1)):'—'],['SMA 50',finite(d.sma50.at(-1))?rupee(d.sma50.at(-1)):'—'],['SMA 200',finite(d.sma200.at(-1))?rupee(d.sma200.at(-1)):'—'],['Supertrend 7,3',finite(d.supertrend.line.at(-1))?rupee(d.supertrend.line.at(-1)):'—']].map(a=>`<div><small>${a[0]}</small><strong>${a[1]}</strong></div>`).join('');}
function drawCandles(x){
 const ranges={'1M':21,'3M':63,'6M':126,'1Y':252,'ALL':x.d.length},count=Math.min(x.d.length,ranges[state.chartRange]||126),start=x.d.length-count;x={d:x.d.slice(start),o:x.o.slice(start),h:x.h.slice(start),l:x.l.slice(start),c:x.c.slice(start),v:x.v.slice(start)};
 const c=$('#priceChart');if(!c)return;const dpr=window.devicePixelRatio||1,w=Math.max(280,c.clientWidth||280),h=Math.max(220,c.clientHeight||260);c.width=w*dpr;c.height=h*dpr;const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);const ind=indicatorData(x),n=x.d.length;
 const selected={ema9:true,ema20:true,sma50:false,sma200:false,supertrend:false};$$('[data-overlay]').forEach(el=>selected[el.dataset.overlay]=el.checked);
 const series=[x.h,x.l];['ema9','ema20','sma50','sma200'].forEach(k=>{if(selected[k])series.push(ind[k].filter(finite));});if(selected.supertrend)series.push(ind.supertrend.line.filter(finite));
 const lo=Math.min(...series.flat()),hi=Math.max(...series.flat()),span=hi-lo||1,pad=14,plotH=h-2*pad;
 ctx.strokeStyle='#e8ecf2';ctx.lineWidth=1;for(let i=0;i<4;i++){const y=pad+plotH*i/3;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
 const step=(w-2*pad)/n,body=Math.max(2,Math.min(9,step*.62)),px=i=>pad+step*(i+.5),py=v=>pad+(hi-v)/span*plotH;
 x.d.forEach((_,i)=>{const xx=px(i),up=x.c[i]>=x.o[i];ctx.strokeStyle=up?'#16865b':'#d34b55';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(xx,py(x.h[i]));ctx.lineTo(xx,py(x.l[i]));ctx.stroke();const top=py(Math.max(x.o[i],x.c[i])),bot=py(Math.min(x.o[i],x.c[i]));ctx.fillRect(xx-body/2,top,body,Math.max(1,bot-top));});
 const colors={ema9:'#e0a12d',ema20:'#4b80d8',sma50:'#8c63c7',sma200:'#333d50',supertrend:'#16865b'};
 Object.keys(colors).forEach(k=>{if(!selected[k])return;const a=k==='supertrend'?ind.supertrend.line:ind[k];ctx.strokeStyle=colors[k];ctx.lineWidth=1.6;ctx.beginPath();let begun=false;a.forEach((v,i)=>{if(!finite(v)){begun=false;return;}if(!begun){ctx.moveTo(px(i),py(v));begun=true;}else ctx.lineTo(px(i),py(v));});ctx.stroke();});
 $$('[data-overlay]').forEach(el=>el.onchange=()=>drawCandles(x));
}


function runMomentumBacktest(){
 const h=state.history,dates=h?.dates,stocks=h?.stocks;
 const box=$('#backtestSummary');if(!box)return;
 if(!Array.isArray(dates)||!stocks){box.innerHTML='<div class="empty">Historical close data is unavailable.</div>';return;}
 const closes=Object.entries(stocks).map(([symbol,x])=>({symbol,c:Array.isArray(x.c)?x.c:[]}));
 const monthEnds=[];
 for(let i=0;i<dates.length-1;i++){if(String(dates[i]).slice(0,7)!==String(dates[i+1]).slice(0,7))monthEnds.push(i);}
 if(dates.length)monthEnds.push(dates.length-1);
 const topN=Number($('#btHoldings')?.value||20),periods=[],skipped=[];
 let equity=100000,peak=equity,maxDD=0,positive=0,used=0;
 for(let k=0;k<monthEnds.length-1;k++){
  const start=monthEnds[k],end=monthEnds[k+1],signal=start-21;
  if(signal-252<0)continue;
  const ranked=[];
  for(const x of closes){
   const p3=Number(x.c[signal]),p3b=Number(x.c[signal-63]),p6b=Number(x.c[signal-126]),p9b=Number(x.c[signal-189]),p12b=Number(x.c[signal-252]),p0=Number(x.c[start]),p1=Number(x.c[end]);
   const vals=[p3,p3b,p6b,p9b,p12b,p0,p1];
   if(!vals.every(Number.isFinite)||vals.some(v=>v<=0))continue;
   const r3=p3/p3b-1,r6=p3/p6b-1,r9=p3/p9b-1,r12=p3/p12b-1;
   const score=.4*r3+.2*r6+.2*r9+.2*r12;
   ranked.push({symbol:x.symbol,score,ret:p1/p0-1,start:p0,end:p1});
  }
  ranked.sort((a,b)=>b.score-a.score);
  const selected=ranked.slice(0,topN);
  if(selected.length<topN){skipped.push({date:dates[start],reason:'Not enough valid stocks'});continue;}
  const r=selected.reduce((a,x)=>a+x.ret,0)/selected.length;
  if(!Number.isFinite(r)||r<=-1){skipped.push({date:dates[start],reason:'Invalid portfolio return'});continue;}
  equity*=1+r;peak=Math.max(peak,equity);maxDD=Math.min(maxDD,equity/peak-1);positive+=r>0?1:0;used++;
  periods.push({date:dates[end],from:dates[start],ret:r,equity,holdings:selected});
 }
 if(!periods.length){box.innerHTML='<div class="empty">Not enough valid history to run this simulation.</div>';return;}
 const days=(Date.parse(periods.at(-1).date)-Date.parse(periods[0].from))/86400000;
 const years=days/365.25,cagr=years>0?Math.pow(equity/100000,1/years)-1:null,total=equity/100000-1;
 box.innerHTML=[['ENDING VALUE','₹'+fmt(equity,0),'Starting capital ₹1,00,000'],['TOTAL RETURN',pct(total*100),`${used} monthly periods`],['CAGR',pct(cagr*100),'Annualized from calendar days'],['MAX DRAWDOWN',pct(maxDD*100),'Month-end equity observations'],['POSITIVE MONTHS',`${positive}/${used}`,`${pct(positive/used*100)} of included periods`],['SKIPPED PERIODS',String(skipped.length),'Insufficient/invalid price observations']].map(a=>`<div class="metric"><div class="metric-label">${a[0]}</div><div class="metric-value">${a[1]}</div><div class="metric-note">${a[2]}</div></div>`).join('');
 $('#btPeriod').textContent=`${periods[0].from} → ${periods.at(-1).date}`;
 const vals=[100000,...periods.map(x=>x.equity)],w=900,hh=220,min=Math.min(...vals),max=Math.max(...vals),span=max-min||1;
 const pts=vals.map((v,i)=>`${i/(vals.length-1)*w},${hh-((v-min)/span)*(hh-20)-10}`).join(' ');
 $('#btEquity').innerHTML=`<svg viewBox="0 0 ${w} ${hh}" role="img" aria-label="Monthly portfolio value line"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke"/></svg>`;
 const latest=periods.at(-1).holdings;
 $('#btHoldingsTable').innerHTML=`<table class="data-table"><thead><tr><th>SYMBOL</th><th>WEIGHT</th><th>12-1M MOMENTUM SCORE</th><th>MONTH RETURN</th></tr></thead><tbody>${latest.map(x=>`<tr><td>${esc(x.symbol)}</td><td>${fmt(100/latest.length,2)}%</td><td>${pct(x.score*100)}</td><td>${pct(x.ret*100)}</td></tr>`).join('')}</tbody></table>`;
 $('#btMonthly').innerHTML=`<table class="data-table"><thead><tr><th>MONTH END</th><th>MONTH RETURN</th><th>PORTFOLIO VALUE</th></tr></thead><tbody>${periods.slice(-18).reverse().map(x=>`<tr><td>${x.date}</td><td class="${x.ret>=0?'positive':'negative'}">${pct(x.ret*100)}</td><td>₹${fmt(x.equity,0)}</td></tr>`).join('')}</tbody></table>`;
 $('#btSkippedNote')?.remove();
 const note=document.createElement('p');note.id='btSkippedNote';note.className='muted';note.textContent=`Method: at each month-end, rank using the weighted 3/6/9/12-month return score (40/20/20/20) measured 21 sessions earlier; equal-weight the top ${topN} stocks for the next month. Only periods where all selected stocks have valid start/end closes are included. ${skipped.length} periods skipped. No benchmark or transaction costs are included.`;$('#backtestSummary').after(note);
}


function renderBacktestAudit(){
 const audit=$('#btModuleAudit'),breadth=$('#btBreadthSnapshot'),sectorBox=$('#btSectorSnapshot');
 if(audit)audit.innerHTML=`<table class="data-table"><thead><tr><th>MODULE</th><th>STATUS</th><th>WHY IT IS NOT SHOWN AS VALID PERFORMANCE</th></tr></thead><tbody>
 <tr><td>Strategy Backtest</td><td><span class="pill">Not implemented</span></td><td>No defined entry/exit rules, execution model or portfolio engine in this build.</td></tr>
 <tr><td>MA Crossover</td><td><span class="pill">Pending</span></td><td>Daily close data can produce signals, but OHLCV execution, slippage, costs and corporate-action validation are not available.</td></tr>
 <tr><td>Market Breadth</td><td><span class="pill green">Snapshot only</span></td><td>Current historical-universe breadth is measurable; point-in-time constituent membership is missing, so no breadth strategy backtest is claimed.</td></tr>
 <tr><td>Sector Rotation</td><td><span class="pill green">Snapshot only</span></td><td>Current sector grouping and trailing returns can be summarized; historical sector membership and tradable rebalance execution are not validated.</td></tr>
 <tr><td>Mean Reversion</td><td><span class="pill">Pending</span></td><td>Existing OHLCV/gap execution assumptions have not been validated; close-only history cannot verify intraday fills or gap risk.</td></tr>
 </tbody></table>`;
 if(!state.history?.dates||!state.history?.stocks){if(breadth)breadth.innerHTML='<div class="empty">History unavailable.</div>';return;}
 const dates=state.history.dates,stocks=state.history.stocks,idx=dates.length-1,rows=[];
 for(const [symbol,x] of Object.entries(stocks)){
  const c=x.c||[];let last=idx;while(last>=0&&!(Number.isFinite(c[last])&&c[last]>0))last--;
  if(last<0)continue;
  const series=c.slice(0,last+1).filter(v=>Number.isFinite(v)&&v>0);
  if(series.length<200)continue;
  const price=series.at(-1),sma50=series.slice(-50).reduce((u,v)=>u+v,0)/50,sma200=series.slice(-200).reduce((u,v)=>u+v,0)/200;
  rows.push({symbol,sector:x.sec||'Unclassified',price,above50:price>sma50,above200:price>sma200,ret3:series.length>63?price/series.at(-64)-1:null});
 }
 const n=rows.length,ab50=rows.filter(x=>x.above50).length,ab200=rows.filter(x=>x.above200).length;
 if(breadth)breadth.innerHTML=`<div class="metric-grid"><div class="metric"><div class="metric-label">VALID STOCKS</div><div class="metric-value">${fmt(n,0)}</div><div class="metric-note">At least 200 non-missing closes</div></div><div class="metric"><div class="metric-label">ABOVE 50-DAY SMA</div><div class="metric-value">${pct(n?ab50/n*100:null)}</div><div class="metric-note">${ab50} of ${n} stocks</div></div><div class="metric"><div class="metric-label">ABOVE 200-DAY SMA</div><div class="metric-value">${pct(n?ab200/n*100:null)}</div><div class="metric-note">${ab200} of ${n} stocks</div></div><div class="metric"><div class="metric-label">AS OF</div><div class="metric-value" style="font-size:18px">${dates[idx]||'—'}</div><div class="metric-note">History snapshot date</div></div></div><p class="muted">Snapshot only: universe is the 705 stocks present in history.json. This is not complete NSE market breadth and is not point-in-time constituent adjusted.</p>`;
 const groups={};for(const r of rows){(groups[r.sector]??=[]).push(r.ret3);}
 const sectors=Object.entries(groups).map(([name,vals])=>({name,count:vals.filter(Number.isFinite).length,ret:vals.filter(Number.isFinite).length?vals.filter(Number.isFinite).reduce((x,y)=>x+y,0)/vals.filter(Number.isFinite).length:null})).filter(x=>finite(x.ret)).sort((a,b)=>b.ret-a.ret).slice(0,15);
 if(sectorBox)sectorBox.innerHTML=`<h3 style="margin:18px 0 10px">Sector average 3-month price return</h3><p class="muted">Equal-weight average of available stock returns within the sector. Current snapshot only; not a historical sector-rotation strategy.</p><table class="data-table"><thead><tr><th>SECTOR</th><th>STOCKS</th><th>AVG 3M RETURN</th></tr></thead><tbody>${sectors.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.count}</td><td class="${x.ret>=0?'positive':'negative'}">${pct(x.ret*100)}</td></tr>`).join('')}</tbody></table>`;
}


function saveCustomScan(){const name=$('#customName').value.trim(),field=$('#customField').value,op=$('#customOp').value,rawValue=$('#customValue').value.trim(),value=Number(rawValue);if(!name||!rawValue||!Number.isFinite(value)){$('#customScanFeedback').textContent='Enter a scan name and a valid numeric value.';return;}state.savedScans.push({name,field,op,value});if(!writeStore(STORE.scans,state.savedScans)){$('#customScanFeedback').textContent='Browser storage is unavailable. The scan could not be saved.';state.savedScans.pop();return;}$('#customScanFeedback').textContent='Saved. This rule is now available in My workspace.';$('#customName').value='';renderWorkspace();}
function renderCustomResults(rule){const op=rule.op,rows=state.stocks.filter(x=>finite(x[rule.field])&&(op==='gte'?Number(x[rule.field])>=rule.value:op==='lte'?Number(x[rule.field])<=rule.value:Number(x[rule.field])===rule.value)).sort((a,b)=>(val(b,'rs')??-Infinity)-(val(a,'rs')??-Infinity));$('#scanMenu').innerHTML=scanDefs.map(x=>`<button class="scan-option" data-scan="${x[0]}"><strong>${x[1]}</strong><small>${scanAvailable(x[0])?fmt(scanCount(x[0]),0)+' matches':'Data unavailable'}</small></button>`).join('');$('#scanTitle').textContent=rule.name;$('#scanDescription').textContent=`Custom rule: ${rule.field} ${op==='gte'?'≥':op==='lte'?'≤':'='} ${rule.value}. Missing values are excluded.`;$('#scanCount').textContent=fmt(rows.length,0);$('#scanTable').innerHTML=renderScanTable(rows.slice(0,250),'custom');}

function bind(){
 $$('#nav .nav-item').forEach(a=>a.addEventListener('click',()=>go(a.dataset.page)));$$('[data-go]').forEach(a=>a.addEventListener('click',()=>go(a.dataset.go)));
 ['search','universeFilter','stageFilter','sectorFilter','sortBy','rs90','liquid','above50','vcp','breakout','trend8','cupFilter','flagFilter','pocketFilter','darvasFilter'].forEach(id=>$('#'+id).addEventListener(id==='search'?'input':'change',renderScreener));
 $('#resetFilters').addEventListener('click',()=>{['search','stageFilter','sectorFilter'].forEach(id=>$('#'+id).value='');$('#universeFilter').value='all';['rs90','liquid','above50','vcp','breakout','trend8','cupFilter','flagFilter','pocketFilter','darvasFilter'].forEach(id=>$('#'+id).checked=false);renderScreener();});
 document.body.addEventListener('click',e=>{const range=e.target.closest('[data-chart-range]');if(range){state.chartRange=range.dataset.chartRange;$$('[data-chart-range]').forEach(b=>b.classList.toggle('active',b===range));redrawActiveChart();return;}const rm=e.target.closest('[data-remove-watch]');if(rm){state.watchlist=state.watchlist.filter(x=>x!==rm.dataset.removeWatch);writeStore(STORE.watch,state.watchlist);renderWorkspace();return;}const run=e.target.closest('[data-run-saved]');if(run){const rule=state.savedScans[Number(run.dataset.runSaved)];if(rule){state.scan='custom:'+run.dataset.runSaved;go('scans');renderCustomResults(rule);}return;}const del=e.target.closest('[data-delete-saved]');if(del){state.savedScans.splice(Number(del.dataset.deleteSaved),1);writeStore(STORE.scans,state.savedScans);renderWorkspace();return;}if(e.target.id==='addWatchFromDetail'){const sym=e.target.dataset.symbol;if(!state.watchlist.includes(sym))state.watchlist.push(sym);writeStore(STORE.watch,state.watchlist);e.target.textContent='Already in watchlist';renderWorkspace();return;}if(e.target.id==='saveStockTags'){const sym=e.target.dataset.symbol;state.tags[sym]=[...new Set($('#stockTags').value.split(',').map(x=>x.trim()).filter(Boolean))].slice(0,10);if(!state.tags[sym].length)delete state.tags[sym];writeStore(STORE.tags,state.tags);renderWorkspace();return;}const tr=e.target.closest('[data-symbol]');if(tr)showStock(tr.dataset.symbol);const sc=e.target.closest('[data-scan]');if(sc){state.scan=sc.dataset.scan;if($('#page-scans').classList.contains('active'))renderScans();else go('scans');}});
 $('#saveCustomScan').addEventListener('click',saveCustomScan);$('#clearWatchlist').addEventListener('click',()=>{if(confirm('Clear the entire local watchlist?')){state.watchlist=[];writeStore(STORE.watch,state.watchlist);renderWorkspace();}});
 window.addEventListener('resize',()=>{if($('#modal')?.classList.contains('show'))redrawActiveChart();});$('#closeModal').addEventListener('click',()=>$('#modal').classList.remove('show'));$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')$('#modal').classList.remove('show');});$('#refreshBtn').addEventListener('click',()=>location.reload());$('#runBacktest').addEventListener('click',runMomentumBacktest);$('#btHoldings').addEventListener('change',runMomentumBacktest);
}
function go(page){$$('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));$$('.nav-item').forEach(a=>a.classList.toggle('active',a.dataset.page===page));$('#pageCrumb').textContent=({workspace:'My workspace',overview:'Overview',screener:'Stock screener',swing:'Swing ideas',scans:'Popular scans',themes:'Sector & themes',gaps:'Gap activity',ipos:'IPO tracker',backtest:'Backtest research'})[page]||page;window.scrollTo(0,0);if(page==='scans'&&!String(state.scan).startsWith('custom:'))renderScans();if(page==='workspace')renderWorkspace();}
load();
