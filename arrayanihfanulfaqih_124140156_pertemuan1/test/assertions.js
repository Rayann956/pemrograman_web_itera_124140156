/* Assertions tes Mini POS (dijalankan dalam context yang sama dengan script.js) */
"use strict";

let lulus = 0, gagal = 0;
function cek(judul, kondisi) {
  if (kondisi) { lulus++; console.log(`  PASS  ${judul}`); }
  else { gagal++; console.log(`  FAIL  ${judul}`); }
}
const ev = { preventDefault() {} };

console.log("== 1. VALIDASI FORM ==");
inputNama.value = "Air"; inputHarga.value = "5000"; inputQty.value = "2";
cek("Input valid diterima", validasiInput() === true);

inputNama.value = "Ai";
cek("Nama < 3 karakter ditolak", validasiInput() === false);
cek("Pesan error nama muncul", errorNama.textContent !== "");

inputNama.value = "Air Mineral";
inputHarga.value = "0";
cek("Harga 0 ditolak", validasiInput() === false);
cek("Pesan error harga muncul", errorHarga.textContent !== "");

inputHarga.value = "400";
cek("Harga < 500 ditolak", validasiInput() === false);

inputHarga.value = "5000"; inputQty.value = "0";
cek("Qty 0 ditolak", validasiInput() === false);

inputQty.value = "2.5";
cek("Qty desimal ditolak", validasiInput() === false);
cek("Pesan error qty muncul", errorQty.textContent !== "");

console.log("== 2. TAMBAH + RESET FORM ==");
inputNama.value = "Buku Tulis"; inputHarga.value = "5000"; inputQty.value = "3";
tambahKeKeranjang(ev);
cek("Item masuk keranjang", keranjang.length === 1);
cek("Form di-reset setelah tambah", inputNama.value === "" && inputHarga.value === "" && inputQty.value === "");

console.log("== 3. KALKULATOR ==");
inputNama.value = "Air Mineral 600ml"; inputHarga.value = "4000"; inputQty.value = "10";
tambahKeKeranjang(ev);
// 5000x3 = 15.000, 4000x10 = 40.000 -> total 55.000 -> diskon otomatis 5.500
cek("Total belanja = Rp 55.000", labelTotalBelanja.textContent.includes("55.000"));
cek("Diskon otomatis 10% = Rp 5.500", labelDiskon.textContent.includes("5.500"));
cek("Total akhir = Rp 49.500", labelTotalAkhir.textContent.includes("49.500"));

inputUangBayar.value = "100000";
hitungSemua();
cek("Kembalian = Rp 50.500", labelKembalian.textContent.includes("50.500"));
cek("Tidak ada pesan uang kurang", infoKembalian.textContent === "");

inputUangBayar.value = "40000";
hitungSemua();
cek("Uang kurang terdeteksi", infoKembalian.textContent.toLowerCase().includes("belum mencukupi"));

console.log("== 4. KODE PROMO ==");
inputUangBayar.value = ""; inputKodePromo.value = "hemat10";
terapkanPromo();
cek("Promo HEMAT10 diterima (huruf kecil pun valid)", infoPromo.textContent.includes("diterapkan"));

// kasus promo lebih besar dari diskon otomatis: keranjang baru total 40.000
keranjang = [];
inputNama.value = "Pensil"; inputHarga.value = "2000"; inputQty.value = "20";
tambahKeKeranjang(ev);
inputKodePromo.value = "HEMAT10";
terapkanPromo();
cek("Diskon promo Rp 4.000", labelDiskon.textContent.includes("4.000"));
cek("Total akhir = Rp 36.000", labelTotalAkhir.textContent.includes("36.000"));

console.log("== 5. HAPUS ITEM ==");
const idHapus = keranjang[0].id;
hapusItem(idHapus);
cek("Item terhapus, keranjang kosong", keranjang.length === 0);
cek("Total kembali Rp 0", labelTotalBelanja.textContent.includes("0"));

console.log("== 6. LOCALSTORAGE PERSIST ==");
inputKodePromo.value = "";
inputNama.value = "Roti Bakar"; inputHarga.value = "10000"; inputQty.value = "2";
tambahKeKeranjang(ev);
const dataStore = JSON.parse(localStorage.getItem("miniPosKeranjang"));
cek("Storage berisi 1 item", Array.isArray(dataStore) && dataStore.length === 1);
cek("Isi storage benar", dataStore[0].nama === "Roti Bakar" && dataStore[0].qty === 2);

// simulasi refresh: kosongkan state lalu muat ulang dari storage
keranjang = [];
muatStorage();
cek("muatStorage memulihkan item (persist refresh)", keranjang.length === 1 && keranjang[0].nama === "Roti Bakar");
cek("Item punya id utk tombol hapus", typeof keranjang[0].id === "number");

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) throw new Error("Ada tes yang gagal!");
