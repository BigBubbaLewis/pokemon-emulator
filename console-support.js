/* Shared by the browser and library generator. GBA keeps its existing core. */
(function(root) {
  "use strict";
  const archives = ["zip","7z"];
  const systems = [
    {id:"gba",name:"Game Boy Advance",extensions:["gba"],folders:["gba"]},
    {id:"gb",name:"Game Boy / Game Boy Color",extensions:["gb","gbc"],folders:["gb","gbc","gameboy"]},
    {id:"nes",name:"NES / Famicom",extensions:["nes","unf","unif"],folders:["nes","famicom"]},
    {id:"snes",name:"SNES / Super Famicom",extensions:["sfc","smc"],folders:["snes","superfamicom"]},
    {id:"n64",name:"Nintendo 64",extensions:["n64","z64","v64"],folders:["n64"]},
    {id:"nds",name:"Nintendo DS",extensions:["nds"],folders:["nds","ds"],biosHint:"Optional DS BIOS and firmware files; standard DS games only."},
    {id:"vb",name:"Virtual Boy",extensions:["vb","vboy"],folders:["vb","virtualboy"]},
    {id:"segaMD",name:"Sega Genesis / Mega Drive",extensions:["md","gen","smd","bin"],folders:["genesis","megadrive","segamd"]},
    {id:"segaMS",name:"Sega Master System",extensions:["sms"],folders:["sms","mastersystem","segams"]},
    {id:"segaGG",name:"Sega Game Gear",extensions:["gg"],folders:["gg","gamegear","segagg"]},
    {id:"sega32x",name:"Sega 32X",extensions:["32x","bin"],folders:["32x","sega32x"]},
    {id:"segaCD",name:"Sega CD / Mega CD",extensions:["cue","chd","iso","bin"],folders:["segacd","megacd"],biosRequired:true,biosHint:"bios_CD_U.bin, bios_CD_E.bin or bios_CD_J.bin, matching the game's region."},
    {id:"segaSaturn",name:"Sega Saturn",extensions:["cue","iso","bin"],folders:["saturn","segasaturn"],biosRequired:true,biosHint:"saturn_bios.bin"},
    {id:"psx",name:"PlayStation",extensions:["cue","chd","pbp","img","bin","exe"],folders:["psx","ps1","playstation"],biosRequired:true,biosHint:"scph5500.bin (Japan), scph5501.bin (USA) or scph5502.bin (Europe)."},
    {id:"atari2600",name:"Atari 2600",extensions:["a26","bin"],folders:["atari2600","2600"]},
    {id:"atari5200",name:"Atari 5200",extensions:["a52","bin"],folders:["atari5200","5200"],biosRequired:true,biosHint:"5200.rom"},
    {id:"atari7800",name:"Atari 7800",extensions:["a78","bin"],folders:["atari7800","7800"]},
    {id:"jaguar",name:"Atari Jaguar",extensions:["j64","jag","abs","cof","rom"],folders:["jaguar","atarijaguar"]},
    {id:"lynx",name:"Atari Lynx",extensions:["lnx","lyx"],folders:["lynx","atarilynx"],biosRequired:true,biosHint:"lynxboot.img"},
    {id:"coleco",name:"ColecoVision",extensions:["col","rom"],folders:["coleco","colecovision"],biosRequired:true,biosHint:"colecovision.rom"},
    {id:"pce",name:"PC Engine / TurboGrafx-16 / CD",extensions:["pce","sgx","cue","chd"],folders:["pce","pcengine","turbografx16","pcecd"],biosHint:"CD games require syscard3.pce. Cartridge games do not need a BIOS."},
    {id:"pcfx",name:"PC-FX",extensions:["cue","chd"],folders:["pcfx"],biosRequired:true,biosHint:"pcfx.rom"},
    {id:"ngp",name:"Neo Geo Pocket / Color",extensions:["ngp","ngc"],folders:["ngp","ngpc","neogeopocket"]},
    {id:"ws",name:"WonderSwan / Color",extensions:["ws","wsc"],folders:["ws","wonderswan"]},
    {id:"3do",name:"3DO",extensions:["iso","chd","bin"],folders:["3do"],biosRequired:true,biosHint:"A compatible 3DO BIOS, for example panafz1.bin."},
    {id:"arcade",name:"Arcade (FinalBurn Neo)",extensions:["zip"],folders:["arcade","fbneo","neogeo"],archiveOnly:true,biosHint:"Some games need a matching BIOS archive, such as neogeo.zip. Use a compatible FinalBurn Neo ROM set."},
    {id:"mame",name:"Arcade (MAME 2003 Plus)",extensions:["zip"],folders:["mame","mame2003"],archiveOnly:true,biosHint:"Use a compatible MAME 2003 Plus ROM set; some games need additional BIOS files."}
  ];
  function extension(file) {
    return String(file).split(/[?#]/)[0].split(".").pop().toLowerCase();
  }
  function systemForHint(hint) {
    const key = String(hint || "").toLowerCase().replace(/[^a-z0-9]/g,"");
    return systems.find(s => s.id.toLowerCase() === key || s.folders.includes(key)) || null;
  }
  function accepts(system,file) {
    const ext = extension(file);
    return system.extensions.includes(ext) || (!system.archiveOnly && archives.includes(ext));
  }
  function resolveSystem(file,hint) {
    const explicit = systemForHint(hint);
    if (hint) return explicit && accepts(explicit,file) ? explicit : null;
    const ext = extension(file);
    if (archives.includes(ext)) return null;
    const candidates = systems.filter(s => s.extensions.includes(ext));
    return candidates.length === 1 ? candidates[0] : null;
  }
  function needsBios(system,file) {
    const pceDisc = ["cue","chd"].includes(extension(file)) || String(file).split("/").some(part => part.toLowerCase() === "pcecd");
    return !!system.biosRequired || (system.id === "pce" && pceDisc);
  }
  const api = {systems,archives,extension,systemForHint,resolveSystem,accepts,needsBios};
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ConsoleSupport = api;
})(typeof globalThis === "object" ? globalThis : this);
