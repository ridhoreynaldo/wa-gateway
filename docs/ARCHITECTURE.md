# Arsitektur

## Modular monolith

Satu repo, dua proses dari kode yang sama:

| Proses | Entry | Tugas |
|---|---|---|
| `web` | Next.js (`src/app`) | UI, auth/RBAC, server actions, REST API |
| `worker` | `worker/index.ts` | Socket Baileys (semua nomor), antrian BullMQ (broadcast & API) |

Baileys **tidak boleh** jalan di Next.js (hot-reload / multi-instance akan memutus koneksi WA).
Web → worker hanya lewat Redis (`wa:commands` pub/sub + antrian BullMQ). Worker → web lewat DB + Redis (status, QR).

```
src/
  app/            routes tipis: baca data dari modul, panggil actions
  shared/         env, db, redis, queue, logger, phone, ui, action wrapper
  modules/
    <modul>/
      schema.ts       tabel Drizzle (dipakai drizzle-kit)
      repository.ts   SATU-SATUNYA tempat query SQL modul itu
      actions.ts      server actions ("use server"): cek permission → panggil repo → audit
      service.ts      logika bisnis non-trivial (jika perlu)
      *.worker.ts / runtime/ / processor.ts   → WORKER-ONLY, jangan diimpor web
```

Modul: `auth`, `users`, `wa-sessions`, `contacts`, `groups`, `lists`, `broadcast`, `messaging`, `api-keys`, `audit`.

Aturan:
1. Query SQL hanya di `repository.ts` (atau file worker modul itu sendiri).
2. Modul lain memakai fungsi publik repository/service modul tsb, bukan menyentuh tabelnya.
3. File worker-only tidak boleh diimpor dari `src/app` (build web akan gagal karena menarik Baileys — itu disengaja).
4. Setiap server action: `requirePermission()` → validasi Zod → `ownerScope()` untuk filter kepemilikan → `audit()`.

## RBAC

`src/modules/auth/rbac.ts` — matriks role → permission. `superadmin` punya `scope:all` (lihat semua data) + `user:manage` + `audit:read`.
`admin` hanya data miliknya (`ownerScope(user)` menambah `WHERE owner_id = …`).

## Anti N+1 & performa query

- Daftar selalu 1 query dengan JOIN / `GROUP BY` (mis. list + jumlah item, session + nama pemilik, audit + email user).
- Auth state Baileys: `get` = 1 query `IN (...)`, `set` = 1 upsert batch.
- Insert massal selalu batch (kontak 1000/chunk, peserta grup 2000/chunk); campaign dibuat dengan 1 `INSERT … SELECT` (sekaligus membuang blacklist).
- Counter campaign didenormalisasi (`sent_count`, dst.) → halaman daftar tanpa `COUNT(*)`.
- Kontak: keyset pagination (`WHERE jid > $cursor ORDER BY jid LIMIT n`), bukan OFFSET.
- Index sesuai pola akses: `campaign_recipients(campaign_id, status, id)` untuk “ambil pending berikutnya”, `messages(session_id, created_at)`, dll.
- PgBouncer transaction mode + `prepare:false`; `DB_POOL_MAX` kecil per proses (10).
- Skala besar: partisi `messages` per bulan (`PARTITION BY RANGE (created_at)`) + hapus partisi lama; tambahkan ketika >50 juta baris.

## Mesin broadcast (keamanan)

Tiap campaign = rantai job BullMQ `tick`. Satu tick = maksimal **satu** pesan:

1. campaign masih `running`? nomor `connected`?
2. di dalam jam kirim (default 08–20 WIB)? kalau tidak → tunda sampai jam buka (+jitter)
3. batas harian = `min(daily_limit, warm-up)` dan batas per jam — counter di Redis (O(1)), dibagi semua campaign pada nomor yang sama
4. **klaim jeda per nomor** (`SET NX PX gap`) — atomik; dua campaign/API di nomor yang sama tidak bisa menembus jeda
5. ambil penerima → cek blacklist → **sudah dikirimi <24 jam? skip** → `onWhatsApp()` (cache 7 hari) → simulasi mengetik → kirim
6. istirahat panjang tiap N pesan (N diacak ±25% supaya pola tidak kaku)
7. 5 kegagalan beruntun → campaign auto-pause; nomor logout/403 dari WA → semua campaign nomor itu auto-pause
8. balasan “STOP” → blacklist otomatis; balasan dari penerima ditandai dibaca setelah jeda manusiawi
9. **satu nomor = satu socket**: lock `wa:owner:{session}` di Redis mencegah dua instance worker memegang nomor yang sama

Semua pengaman bersama (cek nomor, typing, counter, recent, warm-up) ada di `messaging/safety.worker.ts` dan dipakai broadcast maupun API.

Rantai tersimpan di Redis (AOF aktif) → selamat dari restart.

Default (“normal & aman”): jeda 25–60 dtk, ≤40/jam, ≤200/hari, istirahat 3–7 menit tiap 20 pesan, 08:00–20:00, warm-up 20 → +25%/hari.
Server menolak setelan lebih agresif dari batas keras di `broadcast/actions.ts`.

## Kenapa Redis

BullMQ (antrian tahan restart + delayed job), klaim jeda atomik, counter limit, pub/sub perintah web→worker, QR sementara, rate-limit login/API.
Postgres tetap sumber kebenaran untuk semua data bisnis.

## Belum ada (ide lanjutan)

- Webhook keluar (pesan masuk / status) — pesan masuk sudah dicatat di tabel `messages`, tinggal antrian pengirim webhook.
- Kirim ke grup & `/send-document` (kompatibilitas gateway lama) — belum didukung.
- Kirim media (gambar/dokumen), tombol, dan penjadwalan campaign pada waktu tertentu.
- Multi-worker dengan sharding sesi (lock per sesi di Redis).
- Dashboard grafik per hari, ekspor CSV laporan.
- Tes otomatis (unit untuk `template`, `limits`, `parseNumbers`; integrasi untuk processor).
