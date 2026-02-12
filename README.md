# Aplikasi Inventori Stok (Next.js + Tailwind CSS)

Aplikasi manajemen stok untuk gudang pusat dan outlet, dengan fokus pada alur operasional harian: stok masuk/keluar, transfer, opname, dan pengelolaan master data.

## Fitur Saat Ini

### 1) Dashboard
- Ringkasan jumlah produk, jumlah outlet, total stok.
- Rekap total transaksi masuk, keluar, dan jumlah kejadian opname.
- Daftar stok produk pusat dengan penanda stok rendah.

### 2) Stok Masuk
- Input stok masuk untuk lokasi pusat.
- Pemilihan produk via dropdown searchable.
- Modal konfirmasi input (jumlah, catatan, proyeksi stok akhir).

### 3) Stok Keluar
- Input stok keluar dari pusat atau outlet.
- Validasi agar jumlah keluar tidak melebihi stok tersedia.
- Mendukung favorit produk per lokasi dan prioritas produk berdasarkan frekuensi pemakaian.

### 4) Modul Lainnya
- Riwayat:
  - Daftar riwayat pergerakan stok.
  - Filter tipe transaksi: `Masuk`, `Keluar`, `Opname`.
  - Pagination + pilihan ukuran halaman (`5/10/20`).
- Produk:
  - Tambah, ubah, hapus produk.
  - SKU unik.
  - Wajib pilih kategori.
  - Filter daftar produk per kategori + pagination.
- Kategori:
  - Tambah, ubah, hapus kategori.
  - Proteksi hapus jika kategori masih dipakai produk.
- Outlet:
  - Tambah, ubah, hapus outlet.
  - Input koordinat (latitude/longitude).
  - Pencarian alamat via Nominatim OSM.
  - Pemilihan titik via peta Leaflet (klik/geser marker).
  - Proteksi hapus jika outlet masih punya stok/riwayat pergerakan/riwayat transfer.
- Transfer:
  - Transfer stok dari pusat ke banyak outlet sekaligus.
  - Transfer antar outlet.
  - Validasi tujuan duplikat, tujuan sama dengan sumber, dan stok sumber.
  - Log transfer + pagination.
- Opname:
  - Input stok fisik per lokasi (pusat/outlet).
  - Hitung selisih otomatis terhadap stok sistem.
  - Catat event opname ke riwayat.

### 5) UX & UI
- Responsive layout desktop/mobile.
- Bottom navigation mobile + dialog modul "Lainnya".
- Toast notifikasi sukses/error.
- Animasi transisi panel, sheet modal, dan pulse event.

## Batasan Saat Ini
- Data masih bersifat in-memory (state React) dan seeded dari mock data.
- Reload halaman akan mengembalikan data ke kondisi awal.
- Belum ada backend, autentikasi, atau sinkronisasi database.
- Belum ada fitur harga produk (hanya fokus kuantitas stok).

## Teknologi
- Next.js `14.2.5`
- React `18.3.1`
- TypeScript
- Tailwind CSS `3.4.7`

## Menjalankan Proyek

### Prasyarat
- Node.js 18+ (disarankan Node.js 20+)
- npm

### Development
```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

### Build Production
```bash
npm run build
npm run start
```

### Lint
```bash
npm run lint
```

## Struktur Folder Ringkas

```text
app/
  layout.tsx
  page.tsx
  globals.css
components/
  InventoryApp.tsx
  BottomNav.tsx
  OutletMapPicker.tsx
lib/
  types.ts
  mockData.ts
```

## Catatan Integrasi Eksternal
- Peta outlet memuat Leaflet dari CDN `unpkg.com`.
- Pencarian alamat outlet menggunakan API Nominatim OpenStreetMap.
- Fitur peta dan geocoding membutuhkan koneksi internet saat runtime.
