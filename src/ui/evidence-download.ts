/** Download the already-visible evidence; this helper never calls a provider or API. */
export function renderEvidenceDownloadScript():string {return String.raw`<script>
window.niubigeoDownloadEvidence=(name,rows,format)=>{
 if(format!=='csv'&&format!=='json')throw Error('Choose CSV or JSON');
 const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];
 const cell=value=>{let text=value==null?'':typeof value==='object'?JSON.stringify(value):String(value);if(['=','+','-','@','\t','\r','\n'].some(prefix=>text.startsWith(prefix)||text.trimStart().startsWith(prefix)))text="'"+text;return '"'+text.replaceAll('"','""')+'"'};
 const content=format==='json'?JSON.stringify(rows,null,2)+'\n':'\uFEFF'+[columns,...rows.map(row=>columns.map(key=>row[key]))].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
 const url=URL.createObjectURL(new Blob([content],{type:format==='json'?'application/json':'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name+'.'+format;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
</script>`;}
