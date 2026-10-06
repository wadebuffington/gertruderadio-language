/* Storage: one progress object in IndexedDB, with export and import of the
   same object as a file. Nothing depends on an account or a server.
   Falls back to localStorage when IndexedDB is unavailable (some private
   windows), and to memory when neither is. */
"use strict";
window.LS = window.LS || {};

LS.Store = (function () {
  const DB = "language-studio", OS = "progress", KEY = "main";
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("no indexedDB"));
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(OS);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  async function load() {
    try {
      const db = await open();
      return await new Promise((resolve, reject) => {
        const r = db.transaction(OS).objectStore(OS).get(KEY);
        r.onsuccess = () => resolve(r.result ? JSON.parse(r.result) : null);
        r.onerror = () => reject(r.error);
      });
    } catch (e) {
      try { return JSON.parse(localStorage.getItem("ls.progress") || "null"); }
      catch (e2) { return null; }
    }
  }

  // Saves are coalesced: many grades in a second become one write.
  let pending = null, timer = 0;
  function save(state) {
    pending = state;
    clearTimeout(timer);
    timer = setTimeout(flush, 250);
  }
  async function flush() {
    if (!pending) return;
    const json = JSON.stringify(pending);
    pending = null;
    try {
      const db = await open();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(OS, "readwrite");
        tx.objectStore(OS).put(json, KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      try { localStorage.setItem("ls.progress", json); } catch (e2) { /* memory only */ }
    }
  }
  addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });

  function exportFile(state) {
    const blob = new Blob([JSON.stringify(state, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "language-studio-progress-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importFile(file) {
    return file.text().then(t => {
      const s = JSON.parse(t);
      if (!s || typeof s !== "object" || !s.cards || !s.stats) throw new Error("Not a progress file");
      return s;
    });
  }

  return { load, save, flush, exportFile, importFile };
})();
