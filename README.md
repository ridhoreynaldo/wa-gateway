# WA Gateway

WhatsApp gateway multi-nomor berbasis **Baileys** — Next.js 16, PostgreSQL (PgBouncer), Redis/BullMQ, Drizzle ORM.
Login + RBAC (superadmin / admin), scan banyak nomor, kontak & grup, list penerima, broadcast dengan pengaman anti-banned, REST API.

- Deploy produksi (Docker + nginx global): [`docs/DEPLOY.md`](docs/DEPLOY.md)
- Arsitektur & keputusan teknis: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

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

## Perintah

| | |
|---|---|
| `npm run typecheck` | cek tipe |
| `npm run build` / `build:worker` | build web / bundle worker + migrate |
| `docker compose up -d --build` | jalankan stack produksi |

## REST API

```bash
curl -X POST https://DOMAIN/api/v1/messages \
  -H "Authorization: Bearer wagw_xxx" -H "Content-Type: application/json" \
  -d '{"to":"081234567890","text":"Halo"}'
# → 202 {"id":123,"status":"queued"}
```

## Peringatan

Baileys memakai protokol WhatsApp Web tidak resmi. Risiko nomor diblokir selalu ada walau sudah ada pengaman (jeda acak, batas harian, warm-up, jam kirim, opt-out).
Kirim hanya ke penerima yang setuju. Untuk kebutuhan bisnis kritikal pertimbangkan WhatsApp Cloud API resmi.
