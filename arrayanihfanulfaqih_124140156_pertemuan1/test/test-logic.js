/* Harness: jalankan script.js + assertions dalam SATU context vm
   (meniru perilaku top-level script browser). */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function buatElemen(id) {
  return {
    id,
    value: "",
    textContent: "",
    innerHTML: "",
    children: [],
    style: {},
    dataset: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      toggle(c, force) {
        if (force === undefined) { this._set.has(c) ? this._set.delete(c) : this._set.add(c); }
        else if (force) { this.add(c); } else { this.remove(c); }
      },
      contains(c) { return this._set.has(c); },
    },
    addEventListener() {},
    appendChild() {},
    focus() {},
    closest() { return null; },
  };
}

const ids = [
  "formBarang", "namaBarang", "hargaSatuan", "qty",
  "errorNamaBarang", "errorHargaSatuan", "errorQty",
  "totalBelanja", "diskon", "totalAkhir",
  "kodePromo", "btnPromo", "infoPromo",
  "uangBayar", "kembalian", "infoKembalian", "btnReset",
  "isiTabel", "keranjangKosong",
];

const store = new Map();
const localStorageSim = {
  getItem: (k) => (store.has(k) && store.get(k) !== undefined ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.set(k, undefined),
};

const elements = {};
for (const id of ids) elements[id] = buatElemen(id);

// Tiru perilaku form.reset() browser: kosongkan input di dalam form
elements["formBarang"].reset = () => {
  for (const id of ["namaBarang", "hargaSatuan", "qty"]) elements[id].value = "";
};

const sandbox = {
  console,
  process,
  localStorage: localStorageSim,
  document: {
    getElementById: (id) => elements[id] || null,
    createElement: () => buatElemen("tr"),
  },
  confirm: () => true,
  alert: () => {},
  Intl,
  Date,
  Number,
  JSON,
};
vm.createContext(sandbox);

const kodeScript = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
const kodeTes = fs.readFileSync(path.join(__dirname, "assertions.js"), "utf8");

vm.runInContext(kodeScript, sandbox, { filename: "script.js" });
vm.runInContext(kodeTes, sandbox, { filename: "assertions.js" });
