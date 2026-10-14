/* BIOS files use a separate database; existing ROM and save storage is untouched. */
(function(root) {
  "use strict";
  let database;
  const memory = new Map();
  function openDatabase() {
    if (!database) database = new Promise((resolve,reject) => {
      const request = root.indexedDB.open("retro-console-bios",1);
      request.onupgradeneeded = () => request.result.createObjectStore("bios",{keyPath:"system"});
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => { database = null; throw error; });
    return database;
  }
  async function getFiles(system) {
    if (memory.has(system)) return memory.get(system);
    try {
      const db = await openDatabase();
      const files = await new Promise((resolve,reject) => {
        const request = db.transaction("bios","readonly").objectStore("bios").get(system);
        request.onsuccess = () => resolve(request.result?.files || []);
        request.onerror = () => reject(request.error);
      });
      memory.set(system,files);
      return files;
    } catch(error) { return []; }
  }
  async function saveFiles(system,files) {
    memory.set(system,files);
    const db = await openDatabase();
    await new Promise((resolve,reject) => {
      const tx = db.transaction("bios","readwrite");
      tx.objectStore("bios").put({system,files});
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || Error("BIOS storage was interrupted."));
    });
  }
  function createConfig(system,files,createURL) {
    const archives = files.filter(file => /\.(zip|7z)$/i.test(file.name));
    if (!system.archiveOnly && archives.length > 1) throw Error("Choose one BIOS archive or individual BIOS files.");
    const config = {biosUrl:"",externalFiles:{}};
    for (const file of files) {
      if (!file.name || /[\/\\]/.test(file.name) || [".",".."].includes(file.name)) throw Error("Invalid BIOS filename.");
      const url = createURL(file.blob);
      if (!system.archiveOnly && /\.(zip|7z)$/i.test(file.name)) config.biosUrl = url;
      else config.externalFiles["/"+file.name] = url;
    }
    return config;
  }
  const api = {getFiles,saveFiles,createConfig};
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ConsoleBios = api;
})(typeof globalThis === "object" ? globalThis : this);
