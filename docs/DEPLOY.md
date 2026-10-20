# Tutorial Deploy (Docker di WSL / Linux + Nginx global)

Arsitektur runtime:

```
Internet ─► Nginx GLOBAL (host, :80/:443, SSL)
               └─► 127.0.0.1:3000  ─►  [docker] web (Next.js)
                                          │
                       ┌──────────────────┼───────────────┐
                       ▼                  ▼               ▼
                  pgbouncer ─► postgres   redis        worker (Baileys + BullMQ)
```

Yang berjalan di Docker: `postgres`, `pgbouncer`, `redis`, `migrate` (sekali jalan), `web`, `worker`.
Nginx tidak ada di compose — memakai **nginx global** di host Anda.

---

## 1. Prasyarat

```bash
docker --version
docker compose version     # harus Compose v2 (perintah `docker compose`, bukan `docker-compose`)
```

Jika Compose v2 belum ada (Ubuntu/Debian di WSL):

```bash
sudo apt-get update && sudo apt-get install -y docker-compose-plugin
```

Jika docker daemon belum jalan di WSL: `sudo service docker start`
(aktifkan systemd di WSL agar otomatis: `/etc/wsl.conf` → `[boot]` `systemd=true`, lalu `wsl --shutdown`).

## 2. Siapkan project

```bash
cd /opt && git clone <repo-anda> wa-gateway     # atau salin folder project
cd wa-gateway
cp .env.example .env
nano .env
```

Yang **wajib diubah** di `.env`:

| Variabel | Catatan |
|---|---|
| `POSTGRES_PASSWORD` | password kuat. **Samakan** dengan yang ada di `DATABASE_URL` & `DATABASE_URL_DIRECT` |
| `REDIS_PASSWORD` | samakan dengan di `REDIS_URL` |
| `SEED_SUPERADMIN_EMAIL/PASSWORD` | akun login pertama (dibuat otomatis jika belum ada) |
| `COOKIE_SECURE` | `true` jika diakses lewat HTTPS (produksi), `false` jika uji lewat http://IP |

> Password dengan karakter khusus (`@ : / #`) di dalam URL harus di-URL-encode, atau pakai password alfanumerik.

## 3. Jalankan

```bash
docker compose up -d --build
docker compose ps                  # semua harus Up/healthy; `migrate` berstatus Exited (0) = normal
docker compose logs -f web worker
```

Urutan otomatis: postgres sehat → migrate (buat tabel + superadmin) → pgbouncer → web & worker.

Cek: `curl http://127.0.0.1:3000/api/health` → `{"ok":true}`.
Buka `http://IP-SERVER:3000`? Port hanya terbuka di `127.0.0.1`. Untuk uji cepat tanpa nginx dari mesin yang sama: buka `http://localhost:3000` (WSL2 meneruskan localhost ke Windows).

## 4. Nginx global + SSL

```bash
sudo cp infra/nginx/wagw-proxy.conf /etc/nginx/snippets/wagw-proxy.conf
sudo cp infra/nginx/wa-gateway.conf /etc/nginx/sites-available/wa-gateway.conf
sudo sed -i 's/wa.example.com/DOMAIN-ANDA/g' /etc/nginx/sites-available/wa-gateway.conf
```

Karena sertifikat belum ada, terbitkan dulu lewat HTTP:

```bash
# 1) sementara comment dulu blok `server { listen 443 ... }` di file conf, aktifkan site:
sudo ln -s /etc/nginx/sites-available/wa-gateway.conf /etc/nginx/sites-enabled/
sudo mkdir -p /var/www/certbot && sudo nginx -t && sudo systemctl reload nginx

# 2) terbitkan sertifikat
sudo apt-get install -y certbot
sudo certbot certonly --webroot -w /var/www/certbot -d DOMAIN-ANDA

# 3) un-comment blok 443, lalu:
sudo nginx -t && sudo systemctl reload nginx
```

Catatan:
- Dua baris `limit_req_zone` harus di konteks `http`. Jika nginx Anda sudah memuat `sites-enabled/*` di dalam `http {}`, file apa adanya sudah benar.
- Port web di nginx (`127.0.0.1:3000`) harus sama dengan `WEB_PORT` di `.env`.
- Lalu ubah `.env`: `COOKIE_SECURE=true` → `docker compose up -d`.
- Firewall: buka hanya 80/443 (dan SSH). **Jangan** buka 3000/5432/6379.

## 5. Pemakaian pertama

1. Login dengan superadmin dari `.env`.
2. **Pengguna** → buat akun `admin` untuk tim.
3. **Nomor WhatsApp** → tambah nomor → scan QR (WhatsApp → Perangkat tertaut).
4. Tunggu sinkron kontak/grup (menu **Kontak**, **Grup**; tombol *Sync grup* untuk paksa ulang).
5. **List Penerima** → tambah nomor / impor dari grup.
6. **Broadcast** → buat → **Mulai**.

## 6. Operasional

```bash
docker compose logs -f worker            # log Baileys & broadcast
docker compose restart worker            # sesi WA otomatis tersambung lagi (auth tersimpan di Postgres)
git pull && docker compose up -d --build # update versi; migrasi jalan otomatis
docker compose down                      # stop (data aman di volume)
docker compose down -v                   # ⚠ HAPUS semua data
```

**Backup** (cron harian, simpan 14 hari):

```bash
chmod +x infra/scripts/backup.sh
crontab -e
30 2 * * * cd /opt/wa-gateway && ./infra/scripts/backup.sh >> backups/backup.log 2>&1
```

Restore: `gunzip -c backups/FILE.sql.gz | docker compose exec -T postgres psql -U wagw -d wagw`

**Cek query lambat** (log_min_duration_statement = 500ms sudah aktif):

```bash
docker compose logs postgres | grep "duration:"
docker compose exec postgres psql -U wagw -d wagw -c "create extension if not exists pg_stat_statements;"
docker compose exec postgres psql -U wagw -d wagw -c "select calls, round(mean_exec_time::numeric,1) ms, left(query,80) from pg_stat_statements order by mean_exec_time desc limit 10;"
```

## 7. Troubleshooting

| Gejala | Solusi |
|---|---|
| `migrate` gagal "password authentication failed" | password di `.env` tidak sama antara `POSTGRES_PASSWORD` dan URL. Jika volume lama sudah terbentuk dengan password lain: `docker compose down -v` (hanya jika data belum penting) |
| Login berhasil tapi langsung logout lagi | `COOKIE_SECURE=true` padahal akses lewat http. Ubah ke `false` atau pakai HTTPS |
| Dashboard "Worker OFFLINE" | `docker compose logs worker`; biasanya Redis/DB belum siap atau env salah |
| QR tidak muncul | Worker harus online. Setelah ±6 menit tanpa scan sesi dihentikan; klik *Hubungkan* lagi |
| `prepared statement ... does not exist` | pastikan `DATABASE_URL` lewat `pgbouncer` dan kode memakai `prepare:false` (sudah default di project ini) |
| Nomor logged out sendiri | WhatsApp mencabut tautan (sering karena aktivitas mencurigakan). Scan ulang & perlambat broadcast |

## 8. Ukuran server yang disarankan

| Jumlah nomor aktif | RAM minimal |
|---|---|
| 1–5 | 2 GB |
| 5–20 | 4 GB (tuning compose default sudah untuk ini) |
| 20+ | 8 GB+, naikkan `shared_buffers`, `mem_limit` worker, dan pecah worker per kelompok nomor |
