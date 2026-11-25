'use strict';
const {Heap,struct,sizeof,NULL,installCrashHandler}=require('./c');
const h=new Heap();
if(process.argv.includes('--crash')) installCrashHandler();
const p=h.calloc(3,'int');
p.set(42); p.add(1).set(69); p.add(2).set(420);
console.log('int *p =',String(p),'values:',[0,1,2].map(i=>p.add(i).get()));
const pp=h.calloc(1,'pointer');pp.set(p);pp.get().cast('int').set(1337);
console.log('**pp =',p.get());
const Person=struct({age:'int',score:'double',name:'pointer'});
const person=Person.alloc(h);const name=h.cstring('Segmentation Fault');person.field('age').set(18);person.field('score').set(99.5);person.field('name').set(name);
console.log('struct Person:',Person.sizeof,'bytes',person.field('age').get(),person.field('score').get(),h.readString(person.field('name').get()));
console.log('sizeof(int) =',sizeof('int'),'NULL =',NULL);
h.free(p);
function main(){ return read_int(p); }
function read_int(ptr){ return ptr.get(); }
if(process.argv.includes('--crash')) main();
else try{main();}catch(e){console.error(e.stack);}
for(const q of [pp,name,person.pointer])h.free(q);
console.log('Remaining allocations:',h.blocks.size);
