# WA Gateway

WhatsApp gateway multi-nomor berbasis **Baileys** — Next.js 16, PostgreSQL (PgBouncer), Redis/BullMQ, Drizzle ORM.
Login + RBAC (superadmin / admin), scan banyak nomor, kontak & grup, list penerima, broadcast dengan pengaman anti-banned, REST API.

Repo ini adalah **aplikasi**. Infra (Postgres, Redis, nginx, SSL, backup, monitoring) ada di repo
[`devops`](https://github.com/ridhoreynaldo/devops); aplikasi ini di-deploy ke `devops/04-apps/wa-gateway`.

- Deploy: [`docs/DEPLOY.md`](docs/DEPLOY.md)
- Arsitektur & keputusan teknis: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## Pengaman anti-banned (default "normal & aman")

| Aturan | Nilai |
|---|---|
| Jeda antar pesan | 25–60 dtk acak |
| Maks per jam / per hari | 40 / 200 (server menolak lebih agresif) |
| Istirahat tiap ±20 pesan (acak ±25%) | 3–7 menit |
| Jam kirim | 08:00–20:00 WIB |
| Warm-up nomor baru | 20 pesan/hari, +25%/hari — berlaku juga untuk pesan API |
| Sebelum kirim | cek nomor terdaftar (cache 7 hari), simulasi mengetik |
| Anti dobel | 1 nomor tujuan maks 1 pesan / 24 jam per nomor pengirim (lintas campaign & API) |
| Opt-out | balasan STOP → blacklist otomatis; balasan ditandai dibaca (percakapan 2 arah) |
| Auto-pause | 5 gagal beruntun, atau nomor logout / dibatasi WhatsApp (403) |
| Satu nomor = satu socket | lock per sesi di Redis; 2 worker tidak bisa memegang nomor yang sama |

Semua jalur kirim (broadcast & API) berbagi counter harian dan jeda per nomor yang sama.

## Dev lokal

```bash
cp .env.example .env     # sesuaikan URL untuk dev (lihat komentar di docker-compose.dev.yml)
docker compose -f docker-compose.dev.yml up -d    # postgres + pgbouncer + redis
npm install
npm run db:migrate       # migrasi + buat superadmin dari .env
npm run dev              # web   → http://localhost:3000
npm run dev:worker       # worker (terminal lain)
```

Ubah schema: edit `src/modules/*/schema.ts` → `npm run db:generate` → commit folder `drizzle/` → `npm run db:migrate`.

## Compose

| File | Untuk |
|---|---|
| `docker-compose.yml` | produksi di server devops (tanpa DB/Redis/nginx, join `global-gateway-net`) |
| `docker-compose.standalone.yml` | satu stack lengkap tanpa devops |
| `docker-compose.dev.yml` | infra lokal untuk `npm run dev` |

## REST API

```bash
curl -X POST https://DOMAIN/api/v1/messages \
  -H "Authorization: Bearer wagw_xxx" -H "Content-Type: application/json" \
  -d '{"to":"081234567890","text":"Halo"}'
# → 202 {"id":123,"status":"queued"}
```

`POST /send-wa {target, message}` tersedia untuk kompatibilitas dengan gateway lama (wajib Bearer API key).

## Peringatan

Baileys memakai protokol WhatsApp Web tidak resmi. Risiko nomor diblokir selalu ada walau sudah ada pengaman.
Kirim hanya ke penerima yang setuju. Untuk kebutuhan bisnis kritikal pertimbangkan WhatsApp Cloud API resmi.
