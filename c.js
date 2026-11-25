'use strict';
const diagnostics = require('./diagnostics');
const {fault} = diagnostics;
const types = Object.freeze({ char: 1, int: 4, float: 4, double: 8, pointer: 4 });
class Heap {
  constructor(size = 65536) { this.buffer = new ArrayBuffer(size); this.view = new DataView(this.buffer); this.blocks = new Map(); this.size = size; }
  malloc(bytes, type = 'char') {
    if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new RangeError('invalid allocation');
    if (!(type in types)) throw new TypeError('unknown type');
    let addr = 8;
    for (const [base, block] of [...this.blocks].sort((a,b)=>a[0]-b[0])) {
      if (addr + bytes <= base) break;
      addr = Math.ceil((base + block.bytes)/8)*8;
    }
    if (addr + bytes > this.size) fault('out of memory',{heap:this,bytes,operation:'malloc',signal:'SIGABRT'});
    const block = {bytes}; this.blocks.set(addr, block);
    return new Pointer(this, addr, type, addr, block);
  }
  calloc(count, type = 'int') { const p = this.malloc(count * types[type], type); new Uint8Array(this.buffer,p.address,count*types[type]).fill(0); return p; }
  free(p) { if (p === null) return; if (!(p instanceof Pointer) || p.heap !== this || p.address !== p.base || this.blocks.get(p.base) !== p.block) fault('invalid or double free',{heap:this,pointer:p instanceof Pointer?p:undefined,operation:'free',signal:'SIGABRT'}); this.blocks.delete(p.base); }
  realloc(p, bytes) { if (p === null) return this.malloc(bytes); p.check(0); if(p.address !== p.base) fault('invalid realloc',{heap:this,pointer:p,bytes,operation:'realloc',signal:'SIGABRT'}); if(bytes===0){this.free(p);return null;} const q=this.malloc(bytes,p.type); new Uint8Array(this.buffer,q.address,Math.min(bytes,p.block.bytes)).set(new Uint8Array(this.buffer,p.address,Math.min(bytes,p.block.bytes))); this.free(p); return q; }
  fromAddress(address, type='char') { if(address===0)return null; for(const [base,block] of this.blocks) if(address>=base && address<base+block.bytes) return new Pointer(this,address,type,base,block); fault('invalid address',{heap:this,address,operation:'fromAddress'}); }
  cstring(s) { const data = new TextEncoder().encode(s); const p=this.calloc(data.length+1,'char'); new Uint8Array(this.buffer,p.address,data.length).set(data); return p; }
  strlen(p) { let n=0; while(p.cast('char').add(n).get()!==0)n++; return n; }
  readString(p) { return new TextDecoder().decode(new Uint8Array(this.buffer,p.address,this.strlen(p))); }
  memcpy(dst,src,n) { dst.check(n,'memcpy write'); src.check(n,'memcpy read'); if(dst.heap!==this || src.heap!==this)throw new Error('foreign heap'); if(dst.address<src.address+n && src.address<dst.address+n)throw new Error('overlapping memcpy'); new Uint8Array(this.buffer,dst.address,n).set(new Uint8Array(this.buffer,src.address,n)); return dst; }
}
class Pointer {
  constructor(heap,address,type,base,block) { if(!Object.hasOwn(types,type))throw new TypeError('unknown type'); Object.assign(this,{heap,address,type,base,block}); Object.freeze(this); }
  check(n=types[this.type], operation='pointer check') { if(this.heap.blocks.get(this.base)!==this.block)fault('use after free',{heap:this.heap,pointer:this,bytes:n,operation}); if(!Number.isSafeInteger(n)||n<0||!Number.isSafeInteger(this.address)||this.address<this.base||this.address+n>this.base+this.block.bytes)fault('out of bounds',{heap:this.heap,pointer:this,bytes:n,operation}); }
  add(n) { if(!Number.isSafeInteger(n))throw new TypeError('integer offset required'); const p=new Pointer(this.heap,this.address+n*types[this.type],this.type,this.base,this.block); p.check(0,'pointer arithmetic'); return p; }
  cast(type) { return new Pointer(this.heap,this.address,type,this.base,this.block); }
  get() { this.check(types[this.type],'read'); const v=this.heap.view,a=this.address; switch(this.type){case 'char':return v.getUint8(a);case 'int':return v.getInt32(a,true);case 'float':return v.getFloat32(a,true);case 'double':return v.getFloat64(a,true);case 'pointer':return this.heap.fromAddress(v.getUint32(a,true));} }
  set(x) { this.check(types[this.type],'write'); const v=this.heap.view,a=this.address; switch(this.type){case 'char':v.setUint8(a,x);break;case 'int':v.setInt32(a,x,true);break;case 'float':v.setFloat32(a,x,true);break;case 'double':v.setFloat64(a,x,true);break;case 'pointer':if(x!==null){if(!(x instanceof Pointer)||x.heap!==this.heap)throw new TypeError('invalid pointer');x.check(1);}v.setUint32(a,x===null?0:x.address,true);break;} return this; }
  toString(){return '0x'+this.address.toString(16).padStart(8,'0');}
}
function struct(fields) { let size=0,align=1; const layout=Object.create(null); for(const [name,type] of Object.entries(fields)){if(!Object.hasOwn(types,type))throw new TypeError('unknown type');const n=types[type];size=Math.ceil(size/n)*n;layout[name]={offset:size,type};size+=n;align=Math.max(align,n);} size=Math.ceil(size/align)*align; return Object.freeze({sizeof:size,alloc(heap){const p=heap.calloc(size,'char');return {pointer:p,field(name){const f=layout[name];if(!f)throw new Error('unknown field');return p.add(f.offset).cast(f.type);}};}}); }
module.exports={Heap,Pointer,struct,sizeof:type=>types[type],NULL:null,CJSFault:diagnostics.CJSFault,hexdump:diagnostics.hexdump,installCrashHandler:diagnostics.installCrashHandler};
