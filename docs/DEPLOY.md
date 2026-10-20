# Deploy

wa-gateway adalah **aplikasi** yang menempel ke infra bersama dari repo
[`devops`](https://github.com/ridhoreynaldo/devops). Database, Redis, nginx, SSL, backup, dan
monitoring semuanya dikelola di sana. Repo ini hanya membawa kode aplikasinya.

```
Internet ─► global_gateway (nginx, devops/00-gateway) ──HTTPS──┐
                                                               ▼
                           network docker: global-gateway-net
   ┌──────────────┬──────────────────┬──────────────────┬──────────────────┐
   ▼              ▼                  ▼                  ▼                  ▼
infra_postgres  infra_pgbouncer  infra_redis_queue   wa_gateway_web   wa_gateway_worker
(devops)        (devops)         (devops)            (repo ini)       (repo ini)
```

## A. Produksi di server devops (cara utama)

Prasyarat: server sudah menjalankan `devops/bootstrap.sh` (layer 00-gateway & 01-infra hidup).

```bash
cd /opt/devops

# 1) Database + user khusus aplikasi (sekali). Output: DATABASE_URL siap pakai.
./scripts/create-app-db.sh wa_gateway

# 2) Clone aplikasi ke layer apps (bootstrap juga melakukan ini bila ada di 04-apps/apps.list)
git clone git@github.com:ridhoreynaldo/wa-gateway.git 04-apps/wa-gateway
cd 04-apps/wa-gateway
cp .env.example .env && nano .env
#   DATABASE_URL / DATABASE_URL_DIRECT  ← dari langkah 1
#   REDIS_URL                           ← REDIS_QUEUE_PASSWORD di /opt/devops/01-infra/.env
#   SEED_SUPERADMIN_*                   ← akun login pertama

# 3) Jalankan
docker compose up -d --build
docker compose ps        # migrate = Exited(0), web & worker = Up

# 4) Vhost nginx (sekali): salin template, ganti domain, terbitkan SSL, reload
cd /opt/devops
cp 00-gateway/nginx/conf.d/wa-gateway.conf.example 00-gateway/nginx/conf.d/wa-gateway.conf
sed -i 's/wa.example.com/wa.domain-anda.com/g' 00-gateway/nginx/conf.d/wa-gateway.conf
./scripts/issue-cert.sh wa.domain-anda.com
make nginx-reload
```

Update versi berikutnya: `cd /opt/devops && ./scripts/deploy-app.sh wa-gateway`
(= `git pull` + `docker compose up -d --build`; migrasi jalan otomatis).

Tidak ada port yang dibuka ke host: nginx gateway menjangkau `wa_gateway_web:3000` lewat network docker.
Pastikan vhost nginx mengirim `X-Forwarded-Proto https` dan `X-Real-IP` (snippet `proxy.conf` di devops sudah).

## B. Standalone (tanpa devops)

Semua service dalam satu stack (`docker-compose.standalone.yml`). Baca komentar di file itu untuk nilai `.env`.

```bash
docker compose -f docker-compose.standalone.yml up -d --build
# web hanya di 127.0.0.1:3000 → taruh nginx/caddy di depannya dengan SSL
```

## C. Dev lokal

```bash
docker compose -f docker-compose.dev.yml up -d   # postgres + pgbouncer + redis lokal
npm install && npm run db:migrate
npm run dev           # http://localhost:3000
npm run dev:worker    # terminal lain
```

## Pemakaian pertama

1. Login dengan superadmin dari `.env`.
2. **Pengguna** → buat akun `admin` untuk tim.
3. **Nomor WhatsApp** → tambah nomor → scan QR (WhatsApp → Perangkat tertaut).
4. **Kontak**/**Grup** terisi setelah sinkron pertama (*Sync grup* untuk paksa ulang).
5. **List Penerima** → tambah nomor / impor dari grup.
6. **Broadcast** → buat → **Mulai**. Biarkan pengaturan default untuk nomor baru.

## API

```bash
# Pesan tunggal (transaksional)
curl -X POST https://wa.domain-anda.com/api/v1/messages \
  -H "Authorization: Bearer wagw_xxx" -H "Content-Type: application/json" \
  -d '{"to":"081234567890","text":"Halo"}'
# → 202 {"id":123,"status":"queued"}

# Kompatibilitas wa-gateway lama (Laravel): POST /send-wa {target, message}
# Bedanya: sekarang WAJIB header Authorization Bearer <api key>.
```

Pesan API ikut aturan nomor yang sama dengan broadcast: jeda per nomor, counter harian, warm-up.

## Troubleshooting

| Gejala | Solusi |
|---|---|
| `migrate` gagal "password authentication failed" | `DATABASE_URL*` tidak cocok dengan output `create-app-db.sh`; cek juga `infra_pgbouncer` sudah healthy |
| `ECONNREFUSED infra_redis_queue` | layer `01-infra` devops belum jalan, atau `REDIS_URL` masih menunjuk `infra_redis` (itu redis cache) |
| Login berhasil tapi langsung logout | `COOKIE_SECURE=true` tapi akses lewat http. Ubah `false` atau pakai HTTPS |
| Dashboard "Worker OFFLINE" | `docker compose logs worker` |
| QR tidak muncul | Worker harus online. Setelah ±6 menit tanpa scan sesi berhenti; klik *Hubungkan* lagi |
| "sesi sedang dipegang instance worker lain" | ada 2 container worker memakai Redis yang sama (mis. `--scale`). Jalankan satu worker saja |
| Campaign auto-pause "Nomor dibatasi/diblokir (403)" | WhatsApp membatasi akun. Hentikan broadcast nomor itu beberapa hari; cek isi pesan & daftar penerima |
| `prepared statement ... does not exist` | pastikan `DATABASE_URL` lewat PgBouncer dan `prepare:false` (default project ini) |
