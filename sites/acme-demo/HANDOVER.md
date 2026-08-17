# Acme Demo handover

- [ ] Cập nhật brand, logo, domain và nội dung demo.
- [ ] Copy `.env.example` thành `.env`, điền secrets/recipient thật và không commit.
- [ ] Chạy preflight, migrations, deploy và seed trên staging.
- [ ] Chạy `bun run site:admin:create --site=acme-demo --stage=staging`, rồi xóa CMS_BOOTSTRAP_PASSWORD khỏi .env.
- [ ] Smoke login, media, preview, publish, lead, notification và sitemap.
- [ ] Xác nhận health + operational alert receipt, không chỉ provider capability.
- [ ] Chạy `site:backup`, `site:backup:archive:prepare` + `site:backup:archive` với bucket khóa `acme-demo-backups`, rồi `site:restore:remote` dry-run/apply vào `acme-demo-restore-drill-<date>` và smoke target.
- [ ] Cấu hình GitHub variables/secret cho `scheduled-cms-backup.yml`, giữ receipt manual dispatch đầu tiên và xác nhận schedule tuần kế tiếp.
- [ ] Kết nối domain/HTTPS, kiểm tra RUM và đào tạo editor.
