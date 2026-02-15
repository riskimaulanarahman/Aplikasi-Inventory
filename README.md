# SaaS Inventory Multi Outlet/Cabang (Next.js Frontend + Laravel API)

Aplikasi ini sekarang berfungsi sebagai **frontend Next.js** yang terhubung ke backend API Laravel terpisah.

## Arsitektur
- Frontend: Next.js 14 (repo ini)
- Backend API: Laravel (`inventory-api-laravel`, repo terpisah)
- Database: MySQL (di backend Laravel)
- Auth: Bearer token (Sanctum personal access token), token disimpan pada cookie frontend

## Route Utama Frontend
- `/login` : login user
- `/register` : registrasi owner + Outlet/Cabang trial
- `/t` : picker Outlet/Cabang
- `/t/[tenantSlug]` : aplikasi inventory Outlet/Cabang
- `/platform` : admin monitoring platform

## Environment Frontend
Salin `.env.example` menjadi `.env.local` lalu isi:
- `NEXT_PUBLIC_API_BASE_URL`
- `API_BASE_URL_SERVER`
- `AUTH_TOKEN_COOKIE`
- `NEXT_PUBLIC_AUTH_TOKEN_COOKIE`

Contoh lokal saat backend Laravel berjalan di port 8000:
```env
NEXT_PUBLIC_API_BASE_URL="http://localhost:8000"
API_BASE_URL_SERVER="http://localhost:8000"
AUTH_TOKEN_COOKIE="tw_access_token"
NEXT_PUBLIC_AUTH_TOKEN_COOKIE="tw_access_token"
```

## Setup Lokal Frontend
```bash
npm install
npm run dev
```

## Catatan
- Semua endpoint domain (`/api/auth/*`, `/api/tenant/*`, `/api/billing/*`, `/api/platform/*`) sekarang dipanggil langsung ke backend Laravel.
- Repo ini tidak lagi menggunakan Supabase dan Prisma sebagai backend utama.
