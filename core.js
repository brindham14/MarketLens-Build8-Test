/* MarketLens shared data layer. Preserves source calculations; never invents missing values. */
(function(){
 'use strict';
 const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const num=v=>finite(v)?Number(v):null;
 const pct=(a,b)=>finite(a)&&finite(b)&&Number(b)!==0?(Number(a)/Number(b)-1)*100:null;
 const mean=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
 function closeHistory(history,symbol){
  const dates=Array.isArray(history?.dates)?history.dates:[];
  const c=history?.stocks?.[symbol]?.c;
  if(!Array.isArray(c)||c.length!==dates.length||!c.length)return {available:false,points:[]};
  const points=[]; for(let i=0;i<c.length;i++)if(finite(c[i])&&dates[i])points.push({date:dates[i],close:Number(c[i])});
  return {available:points.length>0,points};
 }
 function normalize(summary,quoteFile,history){
  const quotes=quoteFile?.quotes||{};
  const stocks=(Array.isArray(summary)?summary:[]).map(raw=>{
   const q=quotes[raw.symbol]||{};
   const row={...raw};
   // Quotes are the authoritative price/day-change fields when present.
   if(finite(q.p))row.price=Number(q.p);
   if(finite(q.c))row.change=Number(q.c);
   // Convert only valid numeric source values; preserve null for absent fields.
   for(const key of ['price','change','rs','rsd','mom','turnover','fromHigh','ret3','ret6','ret1','r1','ret1w','bi','tr','trend','a50','a200','vcp','pp','fl','breakoutToday','b50','inside5']) row[key]=num(row[key]);
   row.closeHistory=closeHistory(history,row.symbol);
   return row;
  });
  return {
   stocks,
   bySymbol:Object.fromEntries(stocks.map(s=>[s.symbol,s])),
   quoteAsOf:quoteFile?.asOf||null,
   quoteUpdated:quoteFile?.updated||null,
   technicalAsOf:history?.dates?.at(-1)||null,
   history,
   quality:{summaryRows:stocks.length,quoteRows:Object.keys(quotes).length,historySymbols:Object.keys(history?.stocks||{}).length}
  };
 }
 window.MarketLensCore={normalize,closeHistory,finite,num,pct,mean};
})();
