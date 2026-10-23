/* ============================================================
   MINI POS — KASIR KANTIN KAMPUS
   Logika JavaScript — Arrayan Ihfanul Faqih (124140156) — RA
   Kompetensi: validasi form, kalkulator, localStorage
   ============================================================ */

"use strict";

/* ================= KONSTANTA & STATE ================= */

const KUNCI_STORAGE = "miniPosKeranjang"; // key localStorage
const MIN_NAMA = 3;        // nama barang minimal 3 karakter
const MIN_HARGA = 500;     // harga satuan minimal Rp 500
const MIN_TOTAL_DISKON = 50000; // total minimal untuk diskon otomatis
const PERSEN_DISKON = 10;  // besar diskon dalam persen
const KODE_PROMO = "HEMAT10"; // kode promo sederhana

// Array keranjang: [{ id, nama, harga, qty }]
let keranjang = [];

// Elemen DOM
const formBarang = document.getElementById("formBarang");
const inputNama = document.getElementById("namaBarang");
const inputHarga = document.getElementById("hargaSatuan");
const inputQty = document.getElementById("qty");
const errorNama = document.getElementById("errorNamaBarang");
const errorHarga = document.getElementById("errorHargaSatuan");
const errorQty = document.getElementById("errorQty");

const labelTotalBelanja = document.getElementById("totalBelanja");
const labelDiskon = document.getElementById("diskon");
const labelTotalAkhir = document.getElementById("totalAkhir");
const inputKodePromo = document.getElementById("kodePromo");
const btnPromo = document.getElementById("btnPromo");
const infoPromo = document.getElementById("infoPromo");
const inputUangBayar = document.getElementById("uangBayar");
const labelKembalian = document.getElementById("kembalian");
const infoKembalian = document.getElementById("infoKembalian");
const btnReset = document.getElementById("btnReset");

const isiTabel = document.getElementById("isiTabel");
const keranjangKosong = document.getElementById("keranjangKosong");

// Formatter Rupiah: 50000 -> "Rp 50.000"
const formatRupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/* ================= UTIL ================= */

/**
 * Menampilkan/menyembunyikan pesan error di bawah sebuah input.
 * @param {HTMLInputElement} input - elemen input yang bermasalah
 * @param {HTMLElement} elemenError - elemen <small> pesan error
 * @param {string} pesan - teks error (string kosong = hapus error)
 */
function setError(input, elemenError, pesan) {
  elemenError.textContent = pesan;
  input.classList.toggle("input-error", pesan !== "");
}

/* ================= VALIDASI FORM ================= */

/**
 * Memvalidasi seluruh input barang.
 * @returns {boolean} true jika semua input valid
 */
function validasiInput() {
  let valid = true;

  const nama = inputNama.value.trim();
  const harga = Number(inputHarga.value);
  const qty = Number(inputQty.value);

  // 1) Nama barang: wajib diisi, minimal 3 karakter
  if (nama === "") {
    setError(inputNama, errorNama, "Nama barang wajib diisi!");
    valid = false;
  } else if (nama.length < MIN_NAMA) {
    setError(inputNama, errorNama, `Nama barang minimal ${MIN_NAMA} karakter.`);
    valid = false;
  } else {
    setError(inputNama, errorNama, "");
  }

  // 2) Harga satuan: wajib angka positif, minimal Rp 500
  if (inputHarga.value === "" || Number.isNaN(harga)) {
    setError(inputHarga, errorHarga, "Harga satuan wajib diisi berupa angka!");
    valid = false;
  } else if (harga <= 0) {
    setError(inputHarga, errorHarga, "Harga tidak boleh 0 atau negatif!");
    valid = false;
  } else if (harga < MIN_HARGA) {
    setError(inputHarga, errorHarga, `Harga satuan minimal ${formatRupiah.format(MIN_HARGA)}.`);
    valid = false;
  } else {
    setError(inputHarga, errorHarga, "");
  }

  // 3) Qty: wajib angka bulat minimal 1
  if (inputQty.value === "" || Number.isNaN(qty)) {
    setError(inputQty, errorQty, "Jumlah (Qty) wajib diisi berupa angka!");
    valid = false;
  } else if (!Number.isInteger(qty) || qty < 1) {
    setError(inputQty, errorQty, "Qty harus angka bulat minimal 1.");
    valid = false;
  } else {
    setError(inputQty, errorQty, "");
  }

  return valid;
}

/* ================= CRUD KERANJANG ================= */

/**
 * Menangani submit form: validasi -> tambah ke keranjang -> simpan -> reset.
 * @param {Event} event
 */
function tambahKeKeranjang(event) {
  event.preventDefault(); // cegah reload halaman

  // Cegah barang masuk keranjang jika data tidak valid
  if (!validasiInput()) {
    return;
  }

  const item = {
    id: Date.now(), // penanda unik untuk tombol hapus
    nama: inputNama.value.trim(),
    harga: Number(inputHarga.value),
    qty: Number(inputQty.value),
  };

  keranjang.push(item);

  renderTabel();
  hitungSemua();
  simpanStorage();

  // Reset form agar siap input barang berikutnya
  formBarang.reset();
  inputNama.focus();
}

/**
 * Menghapus satu item dari keranjang berdasarkan id.
 * @param {number} id
 */
function hapusItem(id) {
  keranjang = keranjang.filter((item) => item.id !== id);

  renderTabel();
  hitungSemua();
  simpanStorage();
}

/**
 * Mengosongkan seluruh keranjang + membersihkan localStorage
 * (tombol Transaksi Baru / Reset).
 */
function resetTransaksi() {
  if (keranjang.length === 0 && inputUangBayar.value === "") {
    alert("Keranjang sudah kosong, tidak ada yang perlu direset.");
    return;
  }

  const yakin = confirm("Yakin ingin mengosongkan keranjang & mulai transaksi baru?");
  if (!yakin) return;

  keranjang = [];
  localStorage.removeItem(KUNCI_STORAGE);

  // Bersihkan area pembayaran juga
  inputKodePromo.value = "";
  inputUangBayar.value = "";
  infoPromo.textContent = "";
  infoPromo.classList.remove("aktif");

  renderTabel();
  hitungSemua();
}

/* ================= RENDER TABEL ================= */

/**
 * Membangun ulang isi tabel keranjang dari array `keranjang`.
 */
function renderTabel() {
  isiTabel.innerHTML = "";

  keranjang.forEach((item, index) => {
    const baris = document.createElement("tr");

    const subtotal = hitungSubtotal(item);

    baris.innerHTML = `
      <td class="kolom-qty">${index + 1}</td>
      <td>${item.nama}</td>
      <td class="kolom-angka">${formatRupiah.format(item.harga)}</td>
      <td class="kolom-qty">${item.qty}</td>
      <td class="kolom-angka kolom-subtotal">${formatRupiah.format(subtotal)}</td>
      <td class="kolom-aksi">
        <button type="button" class="btn btn-hapus" data-id="${item.id}">Hapus</button>
      </td>
    `;

    isiTabel.appendChild(baris);
  });

  // Tampilkan/sembunyikan pesan keranjang kosong
  keranjangKosong.style.display = keranjang.length === 0 ? "block" : "none";
}

/**
 * Menangani klik tombol Hapus di dalam tabel (event delegation).
 * @param {Event} event
 */
function tanganiKlikTabel(event) {
  const tombol = event.target.closest(".btn-hapus");
  if (!tombol) return;

  const id = Number(tombol.dataset.id);
  hapusItem(id);
}

/* ================= KALKULATOR ================= */

/**
 * Menghitung subtotal satu item: harga satuan x qty.
 * @param {{harga: number, qty: number}} item
 * @returns {number}
 */
function hitungSubtotal(item) {
  return item.harga * item.qty;
}

/**
 * Menjumlahkan seluruh subtotal barang di keranjang.
 * @returns {number} total belanja
 */
function hitungTotal() {
  return keranjang.reduce((total, item) => total + hitungSubtotal(item), 0);
}

/**
 * Menghitung nominal diskon:
 * - Diskon otomatis 10% jika total >= Rp 50.000
 * - Atau kode promo "HEMAT10" -> 10%
 * - Diambil nominal diskon TERBESAR (tidak dijumlahkan)
 * @param {number} total - total belanja
 * @returns {{nominal: number, sumber: string}} nominal diskon & keterangannya
 */
function hitungDiskon(total) {
  const kode = inputKodePromo.value.trim().toUpperCase();

  const diskonOtomatis = total >= MIN_TOTAL_DISKON ? (total * PERSEN_DISKON) / 100 : 0;
  const diskonPromo = kode === KODE_PROMO ? (total * PERSEN_DISKON) / 100 : 0;

  if (diskonPromo > diskonOtomatis) {
    return { nominal: diskonPromo, sumber: `promo ${KODE_PROMO}` };
  }
  if (diskonOtomatis > 0) {
    return { nominal: diskonOtomatis, sumber: "otomatis (belanja >= Rp 50.000)" };
  }
  return { nominal: 0, sumber: "" };
}

/**
 * Memvalidasi & menerapkan kode promo saat tombol "Terapkan" diklik.
 */
function terapkanPromo() {
  const kode = inputKodePromo.value.trim().toUpperCase();

  if (kode === "") {
    infoPromo.textContent = "Masukkan kode promo terlebih dahulu.";
    infoPromo.classList.remove("aktif");
  } else if (kode !== KODE_PROMO) {
    infoPromo.textContent = "Kode promo tidak valid!";
    infoPromo.classList.remove("aktif");
  } else {
    infoPromo.textContent = `Kode ${KODE_PROMO} diterapkan: diskon ${PERSEN_DISKON}%.`;
    infoPromo.classList.add("aktif");
  }

  hitungSemua();
}

/**
 * Menghitung kembalian: Uang Bayar - Total Akhir.
 * Menampilkan peringatan jika uang belum mencukupi.
 * @param {number} totalAkhir
 */
function hitungKembalian(totalAkhir) {
  const uangBayar = Number(inputUangBayar.value);

  labelKembalian.classList.remove("kurang");

  // Belum ada input uang bayar
  if (inputUangBayar.value === "" || Number.isNaN(uangBayar)) {
    labelKembalian.textContent = formatRupiah.format(0);
    infoKembalian.textContent = "";
    return;
  }

  const kembalian = uangBayar - totalAkhir;

  if (kembalian < 0) {
    // Uang kurang: tampilkan keterangan belum mencukupi
    labelKembalian.textContent = formatRupiah.format(0);
    labelKembalian.classList.add("kurang");
    infoKembalian.textContent = `Uang belum mencukupi! Kurang ${formatRupiah.format(Math.abs(kembalian))}.`;
  } else {
    labelKembalian.textContent = formatRupiah.format(kembalian);
    infoKembalian.textContent = "";
  }
}

/**
 * Pusat perhitungan: dipanggil setiap ada perubahan
 * (tambah item, hapus item, reset, ubah promo/uang bayar).
 */
function hitungSemua() {
  const totalBelanja = hitungTotal();
  const { nominal, sumber } = hitungDiskon(totalBelanja);
  const totalAkhir = totalBelanja - nominal;

  labelTotalBelanja.textContent = formatRupiah.format(totalBelanja);
  labelDiskon.textContent = sumber
    ? `- ${formatRupiah.format(nominal)}`
    : formatRupiah.format(0);
  labelTotalAkhir.textContent = formatRupiah.format(totalAkhir);

  hitungKembalian(totalAkhir);
}

/* ================= LOCALSTORAGE ================= */

/**
 * Menyimpan keranjang ke localStorage (serialisasi JSON.stringify).
 */
function simpanStorage() {
  try {
    localStorage.setItem(KUNCI_STORAGE, JSON.stringify(keranjang));
  } catch (err) {
    console.error("Gagal menyimpan ke localStorage:", err);
  }
}

/**
 * Memuat keranjang dari localStorage (deserialisasi JSON.parse).
 */
function muatStorage() {
  try {
    const data = localStorage.getItem(KUNCI_STORAGE);
    if (data !== null) {
      const hasil = JSON.parse(data);

      // Validasi bentuk data agar aman jika storage rusak/diubah manual
      if (Array.isArray(hasil)) {
        keranjang = hasil.filter(
          (item) =>
            item &&
            typeof item.nama === "string" &&
            typeof item.harga === "number" &&
            typeof item.qty === "number"
        );
      }
    }
  } catch (err) {
    console.error("Gagal memuat localStorage:", err);
    keranjang = [];
  }
}

/* ================= INISIALISASI ================= */

function init() {
  // Muat keranjang tersimpan saat halaman dibuka (refresh tidak hilang)
  muatStorage();
  renderTabel();
  hitungSemua();

  // Event listener utama
  formBarang.addEventListener("submit", tambahKeKeranjang);
  isiTabel.addEventListener("click", tanganiKlikTabel);
  btnPromo.addEventListener("click", terapkanPromo);
  inputKodePromo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      terapkanPromo();
    }
  });
  inputUangBayar.addEventListener("input", () => hitungSemua());
  btnReset.addEventListener("click", resetTransaksi);

  // Bersihkan pesan error input saat pengguna mulai mengetik ulang
  inputNama.addEventListener("input", () => setError(inputNama, errorNama, ""));
  inputHarga.addEventListener("input", () => setError(inputHarga, errorHarga, ""));
  inputQty.addEventListener("input", () => setError(inputQty, errorQty, ""));
}

init();
