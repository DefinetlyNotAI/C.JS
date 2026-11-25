'use strict';
const util = require('node:util');
const hex = (n, width=8) => Number.isSafeInteger(n) ? (n<0?'-':'')+'0x'+Math.abs(n).toString(16).padStart(width,'0') : '<unknown>';
function hexdump(heap, address, radius=32) {
  if (!heap || !Number.isSafeInteger(address) || address<0 || address>=heap.size) return '  <unmapped address>';
  const bytes = new Uint8Array(heap.buffer);
  const start = Math.max(0, Math.floor((address-radius)/16)*16);
  const end = Math.min(bytes.length, Math.ceil((address+radius+1)/16)*16);
  const rows=[];
  for(let i=start;i<end;i+=16){
    const row=Array.from(bytes.subarray(i,Math.min(i+16,end)));
    rows.push(`${address>=i&&address<i+16?' >':'  '} ${hex(i)}  ${row.map(x=>x.toString(16).padStart(2,'0')).join(' ').padEnd(47)}  |${row.map(x=>x>=32&&x<127?String.fromCharCode(x):'.').join('')}|`);
  }
  return rows.join('\n');
}
class CJSFault extends Error {
  constructor(reason, {heap, pointer, address=pointer?.address, bytes, operation='unknown', signal='SIGSEGV'}={}) {
    super(reason); this.name='CJSFault'; this.code=signal;
    Error.captureStackTrace(this,CJSFault);
    const nativeStack=this.stack;
    const frames=nativeStack.split('\n').slice(1).map(x=>x.trim().replace(/^at /,''));
    const blocks=heap?[...heap.blocks].sort((a,b)=>a[0]-b[0]):[];
    const allocation=pointer?.block;
    const alive=allocation && heap?.blocks.get(pointer.base)===allocation;
    const lines=[`Program received signal ${signal}, ${signal==='SIGABRT'?'Aborted':'Segmentation fault'}. (simulated)`,
      `C.JS runtime: ${reason}`, '', '--- fault context ---',
      `  operation : ${operation}`, `  address   : ${hex(address)}`, `  type      : ${pointer?.type??'<unknown>'}`, `  access    : ${bytes??'<unknown>'} byte(s)`,
      `  allocation: ${allocation?`${hex(pointer.base)} + ${allocation.bytes} bytes [${alive?'LIVE':'FREED'}]`:'<unknown>'}`,
      '', '--- virtual registers (heap offsets, not CPU state) ---',
      `  PTR=${hex(address)}  BASE=${hex(pointer?.base)}  SIZE=${hex(allocation?.bytes)}`, `  SP=<unavailable>  PC=<JavaScript frame>`,
      '', '--- memory near PTR ---', hexdump(heap,address), '', `--- heap map (${blocks.length} live allocations) ---`,
      ...blocks.slice(0,32).map(([base,b])=>`  ${hex(base)}-${hex(base+b.bytes)}  ${b.bytes} B  rw-  [heap]`),
      ...(blocks.length>32?['  ... additional allocations omitted']:[]),
      '', '--- backtrace (C-style formatting) ---', ...frames.map((f,i)=>`#${i}  ${f}`), '', '--- JavaScript stack ---', nativeStack];
    this.report=lines.join('\n'); this.stack=this.report;
  }
  [util.inspect.custom]() { return this.report; }
}
function fault(reason, context) { throw new CJSFault(reason,context); }
function installCrashHandler(){
  const handler=(error)=>{process.stderr.write((error instanceof CJSFault?error.report:error.stack??String(error))+'\n');process.exitCode=error instanceof CJSFault?(error.code==='SIGABRT'?134:139):1;};
  process.on('uncaughtException',handler);
  return ()=>process.removeListener('uncaughtException',handler);
}
module.exports={CJSFault,fault,hexdump,installCrashHandler};
