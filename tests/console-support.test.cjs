const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const consoles = require('../console-support.js');
const bios = require('../bios-support.js');
const {generateLibrary} = require('../generate-library.cjs');
const root = path.resolve(__dirname,'..');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/\r\n/g,'\n');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const manifest = JSON.parse(fs.readFileSync(path.join(root,'games.json'),'utf8'));
const quiet = {log(){},warn(){}};
const normalize = value => JSON.parse(JSON.stringify(value));

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'retro-hub-test-'));
  for(const [name,data] of Object.entries(files)) {
    const file = path.join(dir,name);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,data);
  }
  return {dir,cleanup(){
    // Only recursively remove this test-created directory directly inside temp.
    assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('retro-hub-test-'));
    fs.rmSync(dir,{recursive:true,force:true});
  }};
}

test('unambiguous console formats, case-insensitive folders and archive hints',()=>{
  for(const [file,id] of [['test.gba','gba'],['test.GBC','gb'],['test.nes','nes'],['test.sfc','snes'],['test.smc','snes'],['test.z64','n64'],['test.v64','n64'],['test.nds','nds'],['test.vb','vb'],['test.gen','segaMD'],['test.sms','segaMS'],['test.gg','segaGG'],['test.32x','sega32x'],['test.a26','atari2600'],['test.a52','atari5200'],['test.a78','atari7800'],['test.j64','jaguar'],['test.lnx','lynx'],['test.col','coleco'],['test.pce','pce'],['test.ngc','ngp'],['test.wsc','ws']]) {
    assert.equal(consoles.resolveSystem(file)?.id,id,file);
  }
  for(const system of consoles.systems) {
    assert.equal(consoles.resolveSystem('game.'+system.extensions[0],system.folders[0].toUpperCase())?.id,system.id);
    assert.equal(consoles.resolveSystem('game.zip',system.id)?.id,system.id);
  }
  for(const file of ['game.zip','game.bin','game.cue','game.iso','game.rom','game.nsp','game.3ds']) assert.equal(consoles.resolveSystem(file),null,file);
  assert.equal(consoles.resolveSystem('game.gba','nes'),null);
  assert.equal(consoles.resolveSystem('game.iso','psp'),null);
});

test('root and nested console libraries, icons, archives and preserved GBA IDs',()=>{
  const f=fixture({'PokemonEmerald.gba':'','PokemonEmerald.ico':'','Root Game.nes':'','Root Game.ico':'','games/snes/Subfolder/Game.sfc':'','games/genesis/Game.bin':'','games/nes/Packed.zip':'','games/arcade/arcade.zip':'','Ambiguous.zip':'','games/psp/Unsupported.iso':'','games/bios/colecovision.rom':''});
  try {
    const list=generateLibrary(f.dir,quiet);
    assert.equal(list.length,6);
    assert.equal(list.find(g=>g.id==='emerald').name,'Pokémon Emerald');
    assert.equal(list.find(g=>g.id==='emerald').system,'gba');
    assert.equal(list.find(g=>g.id==='user:root game.nes').icon,'Root%20Game.ico');
    assert.equal(list.find(g=>g.file==='games/snes/Subfolder/Game.sfc').system,'snes');
    assert.equal(list.find(g=>g.file==='games/genesis/Game.bin').system,'segaMD');
    assert.equal(list.find(g=>g.file==='games/arcade/arcade.zip').system,'arcade');
    assert.equal(list.find(g=>g.file==='games/nes/Packed.zip').system,'nes');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.dir,'games.json'),'utf8')),list);
  } finally {f.cleanup();}
});

test('CUE companions load together, suppress tracks, and reject incomplete or unsafe discs',()=>{
  const f=fixture({'games/psx/Disc.cue':'FILE "Track 01.bin" BINARY\n TRACK 01 MODE2/2352\nFILE track02.bin BINARY\n TRACK 02 AUDIO\n','games/psx/Track 01.bin':'','games/psx/track02.bin':'','games/psx/Missing.cue':'FILE "absent.bin" BINARY\n','games/psx/Unsafe.cue':'FILE "../other.bin" BINARY\n','games/psx/Empty.cue':''});
  try {
    const list=generateLibrary(f.dir,quiet);
    assert.equal(list.length,1);
    assert.equal(list[0].file,'games/psx/Disc.cue');
    assert.deepEqual(list[0].externalFiles,{'/Track 01.bin':'games/psx/Track%2001.bin','/track02.bin':'games/psx/track02.bin'});
  } finally {f.cleanup();}
});

test('different consoles with repeated filenames retain distinct IDs',()=>{
  const f=fixture({'games/nes/Game.zip':'','games/snes/Game.zip':'','games/nes/Game.ico':'','games/snes/Game.ico':''});
  try {
    const list=generateLibrary(f.dir,quiet);
    assert.equal(new Set(list.map(g=>g.id)).size,2);
    assert.deepEqual(list.map(g=>g.icon),['games/nes/Game.ico','games/snes/Game.ico']);
  } finally {f.cleanup();}
});

test('BIOS config preserves raw filenames, extracts console archives, keeps arcade archives intact',()=>{
  const file={name:'scph5501.bin',blob:new Blob(['test'])};
  const url=()=> 'blob:fixture';
  assert.deepEqual(bios.createConfig(consoles.systemForHint('psx'),[file],url),{biosUrl:'',externalFiles:{'/scph5501.bin':'blob:fixture'}});
  assert.deepEqual(bios.createConfig(consoles.systemForHint('psx'),[{...file,name:'bios.zip'}],url),{biosUrl:'blob:fixture',externalFiles:{}});
  assert.deepEqual(bios.createConfig(consoles.systemForHint('arcade'),[{...file,name:'neogeo.zip'}],url),{biosUrl:'',externalFiles:{'/neogeo.zip':'blob:fixture'}});
  assert.throws(()=>bios.createConfig(consoles.systemForHint('psx'),[{...file,name:'one.zip'},{...file,name:'two.zip'}],url),/one BIOS archive/);
  assert.throws(()=>bios.createConfig(consoles.systemForHint('psx'),[{...file,name:'../bios.bin'}],url),/Invalid BIOS filename/);
  assert.equal(consoles.needsBios(consoles.systemForHint('pce'),'game.pce'),false);
  assert.equal(consoles.needsBios(consoles.systemForHint('pce'),'game.cue'),true);
  assert.equal(consoles.needsBios(consoles.systemForHint('pce'),'games/pcecd/game.zip'),true);
});

function fakeIndexedDB() {
  const databases=new Map();
  return {databases,open(name) {
    const request={};
    queueMicrotask(()=>{
      const upgrade=!databases.has(name);
      if(upgrade) databases.set(name,new Map());
      const stores=databases.get(name);
      request.result={objectStoreNames:{contains:key=>stores.has(key)},createObjectStore:key=>stores.set(key,new Map()),transaction(key){
        const tx={};
        tx.objectStore=()=>({get(id){const r={};queueMicrotask(()=>{r.result=stores.get(key).get(id);r.onsuccess?.();});return r;},put(record){stores.get(key).set(record.system,record);queueMicrotask(()=>tx.oncomplete?.());}});
        return tx;
      }};
      if(upgrade) request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  }};
}

test('BIOS files survive a fresh page cache in a separate database',async()=>{
  const idb=fakeIndexedDB();
  const source=fs.readFileSync(path.join(root,'bios-support.js'),'utf8');
  const boot=()=>{const ctx={indexedDB:idb};vm.createContext(ctx);vm.runInContext(source,ctx);return ctx.ConsoleBios;};
  const first=boot();
  await first.saveFiles('psx',[{name:'scph5501.bin',blob:new Blob(['fixture'])}]);
  const second=boot();
  const stored=await second.getFiles('psx');
  assert.equal(stored[0].name,'scph5501.bin');
  assert.equal(await stored[0].blob.text(),'fixture');
  assert.deepEqual(Array.from(idb.databases.keys()),['retro-console-bios']);
});

class Element {
  constructor(tag='div') {
    this.tagName=tag.toUpperCase();this.children=[];this.value='';this.textContent='';this.className='';this.dataset={};this.listeners={};this.open=false;
    this.style={setProperty:(key,value)=>this.style[key]=value};
    this.classList={contains:n=>this.className.split(' ').includes(n),add:n=>{if(!this.classList.contains(n))this.className+=' '+n;},remove:n=>{this.className=this.className.split(' ').filter(x=>x!==n).join(' ');},toggle:(n,on)=>on?this.classList.add(n):this.classList.remove(n)};
  }
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  addEventListener(name,fn){this.listeners[name]=fn;}
  showModal(){this.open=true;}
  close(){this.open=false;}
  focus(){this.focused=true;}
  remove(){}
  click(){this.onclick?.();}
}
const storage=values=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)});
async function bootApp(list=manifest,options={}) {
  const elements=new Map(Array.from(html.matchAll(/id="([^"]+)"/g),m=>[m[1],new Element()]));
  elements.get('brandIcon').src='./gba-icon.svg';elements.get('siteFavicon').href='./gba-icon.svg';elements.get('gameTitle').textContent='Retro Game Hub';
  const document={body:new Element('body'),documentElement:new Element('html'),title:'Retro Game Hub',getElementById:id=>elements.get(id),createElement:tag=>new Element(tag),querySelectorAll:()=>[],addEventListener:()=>{}};
  const local=options.local||new Map([['gba-speed','8'],['gba-selected','emerald'],['save-sentinel','untouched']]);
  const session=options.session||new Map();
  const files=options.bios||new Map();
  const ctx={document,HTMLElement:Element,localStorage:storage(local),sessionStorage:storage(session),navigator:{},ConsoleSupport:consoles,ConsoleBios:{getFiles:async system=>files.get(system)||[],saveFiles:async(system,records)=>files.set(system,records),createConfig:bios.createConfig},addEventListener(){},indexedDB:fakeIndexedDB(),location:{reload:()=>ctx.reloads++},reloads:0,confirm:()=>true,Blob,URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}},console:quiet,fetch:async()=>({ok:true,json:async()=>list}),setInterval:()=>0,clearInterval(){},setTimeout:()=>0,clearTimeout(){}};
  ctx.window=ctx;vm.createContext(ctx);await vm.runInContext(script,ctx,{filename:'index.html'});
  return {ctx,elements,local,session,files,run:code=>vm.runInContext(code,ctx),async play(id){ctx.testID=id;return vm.runInContext('selectedGame=testID;loadGame()',ctx);}};
}
const entry=(system,file)=>({id:'test:'+file,name:'Test '+system,file,system});

test('home library accepts mixed consoles, filters by console and retains neutral colors',async()=>{
  const app=await bootApp([...manifest,entry('nes','games/nes/Test.nes'),entry('gb','Test.gbc'),entry('psp','games/psp/Test.iso')]);
  assert.equal(app.run('gameStarted'),false);
  assert.equal(app.elements.get('homeGames').children.length,8);
  app.elements.get('homeSystem').value='nes';app.run('drawHome()');assert.equal(app.elements.get('homeGames').children.length,1);
  app.elements.get('homeSystem').value='';app.elements.get('homeSearch').value='Game Boy Color';app.run('drawHome()');assert.equal(app.elements.get('homeGames').children.length,1);
  assert.equal(app.run('speed'),8);
  assert.equal(app.elements.get('siteFavicon').href,'./gba-icon.svg');
  assert.equal(app.ctx.document.documentElement.style['--bg'],undefined);
});

test('each supported console sets its actual core before appending the unchanged CDN loader',async()=>{
  for(const system of consoles.systems) {
    const game=entry(system.id,'games/'+system.folders[0]+'/Test.'+system.extensions[0]);
    const records=new Map([[system.id,[{name:'bios.zip',blob:new Blob(['fixture'])}]]]);
    const app=await bootApp([game],{bios:records});
    await app.play(game.id);
    assert.equal(app.ctx.EJS_core,system.id,system.name);
    assert.equal(app.ctx.EJS_gameUrl,'./'+game.file);
    assert.equal(app.ctx.EJS_gameID,app.run('hashGame(testID)'));
    assert.equal(app.elements.get('consoleSubtitle').textContent,system.name+' · Personal Game Hub');
    assert.equal(app.ctx.EJS_color,'#8b949e');
    assert.equal(app.ctx.document.documentElement.style['--bg'],'#121417');
    assert.equal(app.ctx.document.body.children.find(e=>e.tagName==='SCRIPT').src,'https://cdn.emulatorjs.org/stable/data/loader.js');
    if(system.archiveOnly) assert.equal(app.ctx.EJS_externalFiles['/bios.zip'],'blob:fixture');
    else assert.equal(app.ctx.EJS_biosUrl,'blob:fixture');
  }
});

test('missing required BIOS keeps Home available and opens the correct BIOS setup',async()=>{
  const game={...entry('psx','games/psx/Disc.cue'),externalFiles:{'/track.bin':'games/psx/track.bin'}};const app=await bootApp([game]);
  await app.play(game.id);
  assert.equal(app.run('gameStarted'),false);
  assert.equal(app.run('gameLoading'),false);
  assert.equal(app.elements.get('settingsDialog').open,true);
  assert.equal(app.elements.get('biosSystem').value,'psx');
  assert.match(app.elements.get('biosStatus').textContent,/Add the BIOS for PlayStation/);
  assert.equal(app.ctx.document.body.children.length,0);
  app.files.set('psx',[{name:'scph5501.bin',blob:new Blob(['fixture'])}]);
  await app.play(game.id);
  assert.equal(app.run('gameStarted'),true);
  assert.equal(app.ctx.EJS_externalFiles['/scph5501.bin'],'blob:fixture');
  assert.equal(app.ctx.EJS_externalFiles['/track.bin'],'games/psx/track.bin');
  assert.equal(app.ctx.EJS_disableCue,true);
});

test('switching console and Home preserve storage and select the right next core',async()=>{
  const game=entry('nes','games/nes/Test.nes');const initial=await bootApp([...manifest,game]);
  await initial.play('emerald');
  initial.ctx.testID=game.id;initial.run('selectGame(testID)');
  assert.equal(initial.ctx.reloads,1);
  const next=await bootApp([...manifest,game],{local:initial.local,session:initial.session});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(next.ctx.EJS_core,'nes');assert.equal(next.session.size,0);
  next.elements.get('homeButton').onclick();assert.equal(next.ctx.reloads,1);
  const home=await bootApp([...manifest,game],{local:next.local,session:next.session});
  assert.equal(home.run('gameStarted'),false);assert.equal(home.local.get('save-sentinel'),'untouched');
});

test('existing GBA IDs and hash values, ROM bytes, save manager and controls stay compatible',()=>{
  const hashes={'user:pokemon - firered version (usa).gba':1460530101,'user:pokemon - leafgreen version (usa).gba':725107753,'user:pokemon - ruby version (usa).gba':3445946022,'user:pokemon - sapphire version (usa).gba':4212476676,emerald:3043437631,'user:sonic advance (usa) (en,ja).gba':3292884565};
  const ctx={};vm.createContext(ctx);vm.runInContext(script.match(/function hashGame\(id\) \{[\s\S]*?\n\}/)[0],ctx);
  for(const [id,hash] of Object.entries(hashes)) {
    assert.ok(manifest.some(g=>g.id===id&&g.system==='gba'));
    ctx.testID=id;assert.equal(vm.runInContext('hashGame(testID)',ctx),hash);
  }
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim().replace(/\r\n/g,'\n');
  const original=git('show','HEAD:index.html');
  const section=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
  for(const [start,end] of [['/* -------- STORAGE: UNCHANGED -------- */','/* -------- EMULATOR -------- */'],['/* -------- FAST FORWARD -------- */','/* -------- FULLSCREEN -------- */'],['/* -------- KEYBOARD SHORTCUTS -------- */','/* -------- PROJECT-BUNDLED GAME LIBRARY -------- */'],['/* -------- SAVE MANAGEMENT -------- */','/* -------- EMULATORJS CONFIGURATION -------- */'],['window.EJS_Buttons =','/* -------- HOME SCREEN & GAME LOADING -------- */']]) assert.equal(section(html,start,end),section(original,start,end));
  const before=JSON.parse(git('show','HEAD:games.json'));
  for(const game of before) {
    const current=manifest.find(g=>g.id===game.id);assert.ok(current);
    for(const key of ['id','name','file','icon']) assert.equal(current[key],game[key]);
    const file=decodeURIComponent(game.file);
    assert.equal(git('hash-object','--',file),git('rev-parse','HEAD:'+file));
  }
});
