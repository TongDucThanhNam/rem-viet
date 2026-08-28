# Agency CMS operations runbook

For a Track A release candidate, follow
`docs/cms/track-a-staging-release-procedure.md` in order. Use
`docs/client-handover-checklist.md` for the client-facing boundary and
`docs/pilot-handover-script.md` for the unassisted acceptance run. The commands
below are operational references; their presence does not authorize an external
write or replace the exact release sequence.

## Provision một site

```bash
bun run site:init --id=acme --preset=showcase --dry-run
bun run site:init --id=acme --preset=showcase
bun run site:seed --site=acme
bun run site:verify --site=acme
```

`site:init` chạy lại an toàn: manifest JSON tương đương trả `unchanged`; env,
seed, handover hoặc logo đã được khách tùy biến trả `preserved` và không bị ghi
đè. Sau mỗi lần init luôn chạy `site:verify`; command này fail nếu manifest
không phải HTTPS origin, env template thiếu/trùng/thừa key, template chứa secret
thật, handover thiếu bước, resource name trùng, brand seed bị leak hoặc local
seed asset không tồn tại. Copy manifest đã review thành `site.manifest.json` của
repo khách, điền secret chỉ trong `.env`, chạy quality gates rồi deploy staging.
Tên Alchemy/Worker/D1/R2 lấy từ manifest và có stage suffix.

Trước khi xin quota hoặc tạo tài nguyên Cloudflare cho site thứ hai, chạy proof
reuse local bằng production Worker thật:

```bash
bun run test:e2e:second-site
```

Gate này tạo D1/R2 tạm cô lập từ manifest `acme-demo`, migrate/seed từ đầu rồi
smoke identity, login, publish/restore và media lifecycle. Nó tự cleanup và nằm
trong root `quality`, nhưng không thay thế second-site staging deploy/receipt
thật của schema release.

Sau khi deploy site thứ hai thật, dùng command fail-closed dưới đây để tạo đúng
fragment `secondSite` cho schema release. Inject `CMS_E2E_PASSWORD` từ password
manager vào environment của process; không truyền password qua argument. Bốn
timestamp là receipt của operator và command tự tính/khóa KPI 120 phút + 1 ngày:

```bash
bun run site:smoke:staging --site=<site-id> --stage=staging \
  --origin=https://<staging-host> --dry-run

bun run site:smoke:staging --site=<site-id> --stage=staging \
  --origin=https://<staging-host> \
  --deploy-started-at=<ISO-8601> --deploy-completed-at=<ISO-8601> \
  --brand-started-at=<ISO-8601> --brand-completed-at=<ISO-8601> \
  --confirm-site=<site-id> --confirm-origin=https://<staging-host> --apply
```

Apply chỉ chạy khi checkout local sạch, live `/api/health` cũng báo clean và
commit khớp, D1 khỏe, private env còn Git-ignore và Alchemy plan là ba `noop`.
Nó chạy đúng ba browser scenarios tự cleanup: login + draft/preview/publish/
public/restore, lead inbox lifecycle, media lifecycle; sitemap được verify riêng.
Browser/provider raw output và credentials không đi vào receipt. Chỉ copy
`releaseEvidence.secondSite`; command dừng trước mutation nếu thiếu bất kỳ gate
nào.

Root `quality` luôn build qua `build:web:secure`: command chèn canary riêng cho
13 cấu hình chỉ được phép tồn tại phía server, rồi quét toàn bộ artifact client
theo dạng raw, JSON-escaped và URI-encoded. Nó cũng quét các giá trị private đang
được cấu hình nhưng không in giá trị ra log. Không bỏ qua gate này trước launch.

Manifest gốc cũng dùng cùng giao diện, nên luôn kiểm tra plan trước khi tạo tài
nguyên:

```bash
bun run site:build --site=rem-viet
bun run site:deploy --site=rem-viet --stage=staging --dry-run
bun run site:deploy --site=rem-viet --stage=staging --origin=https://<staging-host> --preflight
bun run site:deploy --site=rem-viet --stage=staging --origin=https://<staging-host> --plan
bun run site:deploy --site=rem-viet --stage=staging --origin=https://<staging-host> --yes
```

Tag `v1.0.0-client-ready` có gate riêng. Copy template trong `docs/releases/`,
trước tiên xem snapshot live chỉ-đọc, điền bằng chứng thật từ đúng release
commit, commit file evidence rồi chạy verifier cuối:

```bash
bun run release:readiness --site=rem-viet --stage=staging --origin=https://<staging-host> --profile=default --alerts-profile=alerts
bun run release:verify
```

Schema v3 fail nếu staging/pilot không cùng clean Git commit + deploy-input hash,
thiếu pilot không-developer, p75 field, exactly-once Resend,
Cloudflare policy/dispatch receipt thật, isolated staging restore trước
second-site smoke, backup trước production migration, hai receipt backup
production manual/weekly riêng biệt hoặc clean checkout. GitHub Actions chạy lại
full `quality` và verifier khi tag được push.

`release:readiness` chạy song song bảy audit live chỉ-đọc: D1 capacity,
operational alert history, deterministic alert-policy preflight, field Web
Vitals 28 ngày, preflight notification smoke và GitHub scheduled-backup
activation cho production, cộng với tag-triggered client-ready workflow.
Notification preflight đồng thời đọc provenance public từ `/api/health`;
readiness fail nếu Worker thiếu contract, source dirty, site/stage sai, commit
khác HEAD hoặc deploy-input hash khác release evidence. Scheduled-backup audit
đồng thời yêu cầu workflow byte-identical trên default branch, cấu hình
repository, manual receipt, weekly receipt kế tiếp và immutable sequence hiện
còn active; release evidence cũ không thể che một automation đã drift hoặc bị
tắt. Output aggregate chỉ giữ count/p75/boolean/action cùng trạng thái
evidence/commit; không in
database UUID/name, recipient, policy payload, provider error hay credential. Nếu
không truyền đủ `--site`, `--stage`, `--origin`, command vẫn audit capacity/alert
history nhưng fail-closed với năm gap alert-policy, `field-performance-audit`,
`notification-runtime-audit`, `scheduled-backup-audit` và
`client-ready-workflow-audit`. Client-ready workflow audit yêu cầu file
byte-identical trên default branch và Actions registration active; chạy riêng
bằng `bun run release:github:audit`. Command này giúp chuẩn bị evidence, không thay thế
`release:verify`.

`--dry-run` chỉ in Worker/D1/R2/seed plan; không gọi Alchemy và không thay đổi
Cloudflare. `--preflight` chạy đúng Alchemy 2 CLI, parse manifest và kiểm tra
private env/bindings, nhưng thoát trước khi provider/resource Effect chạy nên
cũng không provision tài nguyên. `--plan` chạy provider-backed Alchemy plan mà
không apply; `--yes` chỉ được forward cho deploy thật để terminal Windows/CI
không phụ thuộc interactive selector. `--dry-run`, `--preflight` và `--plan`
loại trừ lẫn nhau; command fail trước khi gọi Alchemy nếu truyền nhiều mode.

Mọi stage không phải production bắt buộc có `--origin` HTTPS chỉ gồm
scheme + host. Deploy dùng chính origin này cho cả `CORS_ORIGIN` và
`BETTER_AUTH_URL`; nhờ vậy preflight không thể báo xanh khi staging login sẽ
dùng nhầm domain production. Stage `production` bị khóa vào `siteUrl` trong
manifest.

Alchemy gắn năm binding provenance không-secret vào Worker: site, stage, full Git
SHA, deterministic deploy-input SHA-256 và source state. Staging cho phép deploy
từ checkout dirty nhưng ghi rõ `sourceState=dirty`; production từ chối deploy
dirty. Pilot/release chỉ pass khi `/api/health` báo `clean` và identity khớp exact
checkout/evidence. Sau deploy luôn chạy `--plan` lại và yêu cầu cả Worker/D1/R2
`noop`.

Mỗi site phụ phải có file private `sites/<site>/.env` tạo từ `.env.example`.
Alchemy không bao giờ fallback sang `apps/web/.env` cho site phụ; thiếu file hoặc
thiếu `CORS_ORIGIN`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `ADMIN_EMAILS` thì
deploy dừng trước khi provision tài nguyên. `.env.example` chỉ chứa placeholder;
`site:verify` từ chối credential/recipient thật trong file đã commit, kể cả key
lạ chưa được review. Không commit file `.env`.

Có thể tạo file private bằng workflow fail-closed sau. Command lấy email Owner
từ Cloudflare profile đang đăng nhập, sinh auth/bootstrap secret riêng, từ chối
overwrite và không in giá trị nào:

```bash
bun run site:env:prepare --site=<site-id> --dry-run
bun run site:env:prepare --site=<site-id> --apply --confirm-site=<site-id>
```

### Recovery khi first deploy báo D1 import/poll error

Alchemy có thể đã tạo/migrate D1 trước khi CLI nhận một response poll thiếu
bookmark. Không xóa D1, không clear state và không tạo database tên khác ngay.
Chạy lại đúng manifest/origin ở chế độ chỉ đọc:

```bash
bun run site:deploy --site=<site-id> --stage=staging \
  --origin=https://<staging-host> --plan
```

- Nếu D1 và R2 đều `noop`, resource identity đúng manifest và chỉ Worker còn
  `update`, retry một lần bằng cùng command với `--yes`.
- Nếu D1 còn `create`, `update` hoặc `replace`, dừng apply. Kiểm tra Alchemy
  state, database name/table count và migration incident trước khi quyết định.
- Sau retry phải chạy `--plan` lần nữa; chỉ coi deploy converged khi Worker, D1
  và R2 đều `noop`.

Quy trình này không biến lỗi thành pass: plan sau lỗi là bằng chứng bắt buộc rằng
partial apply đã hội tụ trước khi retry.

### Audit D1 capacity trước restore/second-site

Hai release proof cần hai D1 database khác nhau nhưng không cần tồn tại đồng
thời. Một slot trống là đủ nếu restore cô lập chạy trước, target được verify và
cleanup, rồi chính slot đã trả lại mới dùng cho site thứ hai. Chỉ yêu cầu hai
slot nếu muốn giữ restore target hoặc chạy hai proof song song. Dùng cùng Alchemy
OAuth profile, không copy access token sang Wrangler hay log:

```bash
bun run cloudflare:capacity:audit --required-slots=1
bun run cloudflare:capacity:audit --required-slots=0 --json
bun run cloudflare:d1-references:audit --profile=default
bun run cloudflare:d1-references:audit --profile=default --all
```

Command đầu exit `2` nếu thiếu slot. Report match tên D1 chính xác với mọi
`site.manifest.json` đã check in, đọc thêm size/table count và chỉ đánh dấu phần
còn lại là `UNRECOGNIZED`. Nhãn này **không** có nghĩa là được xóa. Trước khi
retire database phải xác nhận project owner, export backup nếu có table/data và
xin approval rõ ràng cho đúng database ID; command audit hoàn toàn read-only.
Hai command `d1-references` đọc danh sách Worker và settings/bindings trực tiếp
qua Alchemy OAuth, chỉ giữ D1 binding name/Worker name và che database ID còn 8
ký tự. Mặc định chỉ hiện database 0 table; `--all` dùng khi cần tìm candidate
tiếp theo. `BLOCKED_ACTIVE_WORKER_BINDING` không được retire.
`UNBOUND_OWNER_REVIEW_REQUIRED` vẫn chưa phải approval xóa: phải xác nhận project
owner và xin approval riêng cho đúng tên + ID trước mọi mutation. Report luôn ghi
`Deletion authorized: NO`.

Chỉ sau approval riêng cho đúng database, retire một D1 0-table, không còn Worker
binding bằng command fail-closed sau; hai giá trị phải giống hệt tên đã duyệt:

```bash
bun run cloudflare:d1:retire-empty-unbound \
  --profile=default \
  --name=<exact-database-name> \
  --confirm=<exact-database-name>
```

Command đọc lại inventory, table count và binding của toàn bộ Worker trong cùng
operation rồi mới xóa. Nó dừng nếu tên không unique, confirmation lệch, table
count không đúng `0` hoặc còn bất kỳ D1 binding nào. Xóa D1 là không phục hồi;
sau đó bắt buộc chạy lại cả capacity audit và reference audit. Không dùng command
này để thay thế owner review hoặc backup cho database có dữ liệu.

## Bootstrap Owner đầu tiên

Public sign-up luôn bị tắt. Sau khi D1 staging đã được tạo, đặt mật khẩu tạm thời
ít nhất 12 ký tự trong `CMS_BOOTSTRAP_PASSWORD` và bảo đảm email Owner nằm trong
`ADMIN_EMAILS`, sau đó chạy:

```bash
bun run site:admin:create --site=acme --stage=staging --dry-run
bun run site:admin:create --site=acme --stage=staging
```

Command lấy token Cloudflare từ `CLOUDFLARE_API_TOKEN` hoặc
`CLOUDFLARE_D1_TOKEN`, hash mật khẩu bằng chính Better Auth, tạo credential Owner
và ghi audit event `staff.bootstrap`. Chạy lại là no-op nếu Owner đã hoàn chỉnh;
nó không reset tài khoản tồn tại hoặc ghi đè auth data một phần. Không truyền mật
khẩu qua argument vì command line có thể bị process monitor/history ghi lại.

Sau khi đăng nhập thành công, xóa `CMS_BOOTSTRAP_PASSWORD` khỏi private `.env` và
operator shell, nhưng chỉ sau khi đã lưu mật khẩu Owner vào password manager của
khách. Workflow sau xóa đúng một binding, từ chối duplicate/file không được Git
ignore và không in giá trị; `--credential-stored` là xác nhận bắt buộc:

```bash
bun run site:env:finalize --site=<site-id> --dry-run
bun run site:env:finalize --site=<site-id> --apply \
  --confirm-site=<site-id> --credential-stored
```

Tạo Admin/Editor tiếp theo trong `/admin/staff`.
Màn hình đăng nhập cố ý không hiển thị đăng ký công khai hoặc OAuth chưa cấu
hình. Luồng **Quên mật khẩu** hiện yêu cầu liên hệ Owner/agency để xác minh và
khôi phục; nó không gửi hoặc tuyên bố đã gửi email reset tự động.

### Identity riêng cho staging E2E

Không dùng TOTP hoặc session của Owner thật để chạy Playwright. Provisioner dưới
đây chỉ chấp nhận `staging`, một email tổng hợp cố định
`cms-e2e-<site>-staging@example.com`, origin HTTPS được confirm chính xác và một
checkout sạch có commit trùng `/api/health`. Nó tạo đúng một Admin có audit event,
đăng nhập qua Better Auth thật, enroll + verify TOTP qua API thật và lưu
`CMS_E2E_EMAIL`, `CMS_E2E_PASSWORD`, `CMS_E2E_TOTP_SECRET` vào private env đã
được Git ignore. Secret, mã TOTP và backup codes không được in hoặc ghi vào
receipt; backup codes của identity tự động này không được giữ.

```bash
bun run site:e2e:identity --site=<site-id> --stage=staging \
  --origin=https://<staging-origin> --dry-run

bun run site:e2e:identity --site=<site-id> --stage=staging \
  --origin=https://<staging-origin> \
  --confirm-site=<site-id> \
  --confirm-origin=https://<staging-origin> \
  --confirm-email=cms-e2e-<site-id>-staging@example.com --apply
```

Command chạy lại phải xác minh cùng role, credential, TOTP và session thay vì tạo
identity thứ hai hay reset secret. Hai secret E2E là server-only và được bundle
secret audit quét cùng các credential khác. TOTP của Owner/Admin con người vẫn
phải do chính người đó enroll và giữ recovery codes; identity tự động này không
thay thế onboarding hoặc MFA evidence của người thật.

## Migration production

1. Chốt maintenance window và kiểm tra `/api/health`.
2. Export D1 trước migration:

   ```bash
   bun run site:backup --site=<site-id> --stage=production --remote
   ```

   Command lấy đúng tên D1 từ manifest/stage, không overwrite artifact, ẩn signed
   URL của provider khỏi log, restore sang SQLite tạm cô lập, chạy integrity/table/
   row-count checks, rồi ghi SHA-256 + metadata cạnh file SQL. Metadata luôn ghi
   `immutable=false` vì file local chưa phải bản lưu bền vững.

3. Archive SQL vào R2 riêng của client bằng quy trình khóa/verify bên dưới, rồi
   dùng `releaseEvidence` mà command trả về; không commit backup hoặc evidence
   local chứa locator vận hành.
4. Apply migrations trên staging, chạy smoke, sau đó mới production.
5. Kiểm tra migration table, homepage, admin login, preview, publish, media, lead,
   sitemap và health. Theo dõi Worker logs ít nhất 15 phút.

## Backup/restore drill local

```bash
bun run cms:backup:local --store=wrangler
bun run cms:restore:drill --file=backups/<artifact>.sqlite
```

Backup local dùng SQLite serialization nên bao gồm WAL nhất quán. Mỗi drill tạo
một database tạm duy nhất, chạy `PRAGMA integrity_check`, kiểm tra bảng bắt buộc
và row counts, không ghi vào nguồn. Production restore luôn vào D1 staging mới
trước; tuyệt đối không restore thẳng production khi chưa xác nhận artifact.

Command chỉ chọn database vượt qua chính restore contract; một Miniflare file
mới hơn nhưng thiếu migration sẽ bị bỏ qua thay vì tạo backup giả-pass. Nếu có
nhiều local runtime, chỉ định file trong repository và vẫn giữ fail-closed check:

```bash
bun run cms:backup:local --store=wrangler --source=<relative-path-to-d1.sqlite>
```

Nếu không có database đầy đủ, chạy current migrations trên local runtime trước;
không hạ thấp danh sách bảng bắt buộc và không dùng artifact bị verifier từ chối.

## Archive backup bất biến trên R2

Mỗi manifest có `backupBucketName` riêng, khác media bucket và không thuộc
Alchemy stack. Vì vậy destroy/recreate app không được phép xóa archive. Bucket R2
mặc định private; command không bật `r2.dev` hay custom domain. Cả prepare và
archive đều đọc hai API public-domain, fail closed nếu managed `r2.dev` hoặc bất
kỳ custom domain nào đang bật, và không tự động disable domain vì đó là thay đổi
vận hành cần owner review; xem
[R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).
Cloudflare tự mã hóa toàn bộ object/metadata at rest bằng AES-256-GCM và API đi
qua TLS; xem
[R2 data security](https://developers.cloudflare.com/r2/reference/data-security/).

Chuẩn bị bucket một lần. Dry-run không gọi mạng; apply yêu cầu tên bucket khớp
manifest tuyệt đối, dùng Alchemy OAuth thay vì token môi trường yếu hơn, tạo
bucket APAC nếu thiếu, xác nhận bucket vẫn private, giữ nguyên lock rule có sẵn
và thêm lock `d1/` 365 ngày:

```bash
bun run site:backup:archive:prepare --site=<site-id> --dry-run
bun run site:backup:archive:prepare --site=<site-id> \
  --confirm-bucket=<backup-bucket-from-manifest> --apply
```

Sau `site:backup`, validate plan rồi archive. Apply chạy fresh local restore,
audit private access + lock qua Cloudflare API, từ chối bucket dùng chung,
bucket public hoặc lock dưới 90 ngày và không overwrite evidence. Object key
chứa stage, thời điểm export và SHA-256:

```bash
bun run site:backup:archive --site=<site-id> --stage=production \
  --file=backups/<artifact>.sql --dry-run

bun run site:backup:archive --site=<site-id> --stage=production \
  --file=backups/<artifact>.sql \
  --confirm-bucket=<backup-bucket-from-manifest> --apply
```

Command upload tối đa 300 MiB qua authenticated R2 Object API, download object
vào thư mục tạm, so lại size + SHA-256, rồi mới ghi `.immutable.json` với
`immutable=true`, retention và object locator. File lớn hơn phải dùng S3 API/
multipart transport đã được agency phê duyệt; không hạ gate hoặc gắn nhãn
immutable thủ công. Bucket lock chặn overwrite/delete trong retention window;
không remove lock trước khi hợp đồng lưu trữ cho phép.

### Backup định kỳ qua GitHub Actions

Workflow `.github/workflows/scheduled-cms-backup.yml` chạy mỗi Chủ nhật lúc
02:17 UTC và hỗ trợ `workflow_dispatch`. GitHub chạy schedule từ commit mới nhất
trên default branch; xem
[workflow schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule).
Trước khi bật cho repo client, cấu hình:

- Repository variable `CMS_BACKUP_SITE`: đúng manifest ID.
- Repository variable `CMS_BACKUP_STAGE`: stage đang phục vụ cần bảo vệ; sau
  launch thường là `production`, không để `staging` chỉ vì workflow đang xanh.
- Repository variable `CLOUDFLARE_ACCOUNT_ID`: account của đúng client.
- Actions secret `CMS_BACKUP_CLOUDFLARE_API_TOKEN`: token riêng cho backup, giới
  hạn vào đúng account và chỉ đủ quyền export D1, đọc/sửa bucket config, đọc/ghi
  object R2. Không dùng Global API Key hoặc token deploy dùng chung. Tham khảo
  [D1 export](https://developers.cloudflare.com/d1/wrangler-commands/#d1-export)
  và
  [R2 bucket-lock prerequisites](https://developers.cloudflare.com/r2/buckets/bucket-locks/).

Workflow fail trước network nếu variable/secret sai shape. Mỗi run xác nhận
bucket private + lock, export remote D1, restore cô lập tại runner, upload object
content-addressed, download và so SHA-256/size. SQL không được upload vào GitHub
Artifacts; chỉ hai JSON evidence không chứa secret được giữ 90 ngày. Child output
bị suppress khi lỗi để signed URL/token không vào Actions log.

Audit trạng thái GitHub chỉ-đọc trước và sau khi bật workflow:

```bash
bun run site:backup:github:audit --site=<site-id> --stage=production
bun run site:backup:github:audit --site=<site-id> --stage=production --json
```

Audit không in giá trị variable/secret. Nó yêu cầu workflow trên default branch
khớp byte với contract local, đúng site/stage/account và dedicated secret, rồi
download hai JSON artifact của run manual và schedule mới nhất. Receipt chỉ hợp
lệ khi tên export bind đúng run ID/attempt, restore drill `ok`, hash/size archive
khớp export, R2 locator thuộc bucket trong manifest, lock còn ít nhất 365 ngày,
và scheduled run hoàn tất sau manual dispatch bằng object khác. Workflow xanh
nhưng artifact hết hạn, thiếu hoặc sai contract vẫn fail.

Có thể smoke cùng orchestration bằng OAuth của operator trước khi cấu hình CI:

```bash
bun run site:backup:scheduled --site=<site-id> --stage=staging \
  --output=backups/<unique-smoke-name>.sql \
  --auth-source=alchemy --dry-run

bun run site:backup:scheduled --site=<site-id> --stage=staging \
  --output=backups/<unique-smoke-name>.sql \
  --auth-source=alchemy --confirm-site=<site-id> \
  --confirm-bucket=<backup-bucket-from-manifest> --apply
```

Không ghi “backup định kỳ active” chỉ vì workflow đã tồn tại. Sau khi push,
chạy manual dispatch, xác nhận run xanh, object R2 mới có lock, evidence artifact
được giữ và schedule tuần kế tiếp thực sự chạy; sau mỗi mốc chạy lại
`site:backup:github:audit`. Scheduled backup bổ sung vận
hành thường kỳ; nó không thay thế backup production tạo ngay trước migration.

## Backup/restore drill remote

Sau khi capacity audit xác nhận còn slot và owner duyệt target, tạo một D1 trống
có prefix cô lập. Không dùng database đang bind với Worker staging/production:

```bash
bun x wrangler d1 create <site-id>-restore-drill-YYYYMMDD --location=apac
```

Validate artifact, manifest, stage, SHA-256, size và local restore trước khi chạm
Cloudflare:

```bash
bun run site:restore:remote --site=<site-id> --stage=staging \
  --file=backups/<artifact>.sql \
  --target=<site-id>-restore-drill-YYYYMMDD --dry-run
```

Apply chỉ khi target trên đã tồn tại, còn trống và tên confirm khớp tuyệt đối:

```bash
bun run site:restore:remote --site=<site-id> --stage=staging \
  --file=backups/<artifact>.sql \
  --target=<site-id>-restore-drill-YYYYMMDD \
  --confirm-target=<site-id>-restore-drill-YYYYMMDD --apply
```

Command kiểm tra target trống ngay trước import và không tự create resource. Nó
tạo một bản import tạm trong OS temp, chuyển toàn bộ `CREATE TABLE` lên trước và
sắp data theo dependency cha -> con vì D1 remote không chấp nhận dump export
interleaved; artifact gốc và SHA-256 không bị thay đổi. Sau import, command chạy
D1 `PRAGMA quick_check`, rồi yêu cầu table count và row counts của sáu bảng
release-critical khớp metadata. Import lỗi giữ nguyên target có thể partial để
điều tra; không reuse.

Nếu provider đã import thành công nhưng local wrapper lỗi trước receipt, không
import lần hai. Verify target hiện hữu với thời điểm bắt đầu thật:

```bash
bun run site:restore:remote --site=<site-id> --stage=staging \
  --file=backups/<artifact>.sql \
  --target=<site-id>-restore-drill-YYYYMMDD \
  --restore-started-at=<ISO-8601> \
  --confirm-target=<site-id>-restore-drill-YYYYMMDD --verify-only
```

Sau khi receipt chứng minh `quick_check=ok`, exact table/row parity và operator
đã review, cleanup reverify toàn bộ parity ngay trước khi xóa đúng target:

```bash
bun run site:restore:remote --site=<site-id> --stage=staging \
  --file=backups/<artifact>.sql \
  --target=<site-id>-restore-drill-YYYYMMDD \
  --confirm-target=<site-id>-restore-drill-YYYYMMDD --cleanup
```

Giữ cả restore receipt và cleanup receipt. Chỉ sau khi capacity audit xác nhận
slot đã trở lại mới deploy site thứ hai.

Media R2 dùng UUID immutable keys. Backup R2 dùng content-addressed keys cộng
bucket lock; inventory định kỳ và retention theo hợp đồng khách.

## Scheduler và alerts

- Cron `* * * * *`; SLA publish <= 2 phút, target sản phẩm <= 10 giây chỉ đạt khi
  chuyển sang event/alarm hoặc cron có granularity phù hợp. UI không hứa dưới một
  phút.
- Job lỗi giữ nguyên lịch để retry và phát structured log
  `event=cms.operational_incident`. Dùng `fingerprint` ổn định để group/alert;
  không match theo message tự do.
- Notification email (Resend) là adapter chuẩn; Telegram tùy chọn. Cấu hình
  `RESEND_API_KEY`, `LEAD_NOTIFICATION_EMAIL` và `EMAIL_FROM` trong private env
  của đúng site, rồi deploy lại. `EMAIL_FROM` phải dùng domain/sender đã verify
  ở Resend.
- Alchemy tự đặt `NOTIFICATIONS_REQUIRED=1` cho staging/production và `0` cho
  local/dev. Nếu form active bật email mà thiếu credential Resend tương ứng,
  staging/production fail closed; local/E2E chỉ đánh dấu adapter `skipped` để
  không gửi ra provider thật. Telegram vẫn là adapter tùy chọn: thiếu credential
  thì `skipped`, còn provider đã cấu hình mà trả lỗi thì vẫn ghi failure/incident.
- Mỗi email dùng provider idempotency key ổn định
  `lead/<submission-id>/email-v1`. Cron retry sau 1, 5, 15, 60 và 240 phút, tối
  đa 6 lần tính cả lần đầu và chỉ trong 23 giờ để luôn nằm trong cửa sổ
  deduplication 24 giờ của Resend. Attempt còn `pending` quá 10 phút cũng được
  cron thử lại bằng cùng idempotency key để phục hồi trường hợp Worker dừng sau
  khi provider đã nhận request.
- Không auto-retry Telegram vì API gửi tin không có idempotency/deduplication.
  Nếu Telegram lỗi, kiểm tra provider và đối chiếu chat thủ công trước khi gửi
  lại để tránh duplicate.
- Owner/Admin có capability `leads.manage` có thể bấm **Gửi lại email** trong
  `/admin/leads` sau khi sửa credential. Kết quả provider, attempt count,
  `nextRetryAt` và audit event được lưu cùng lead; payload không mất khi provider
  lỗi.
- `/api/health` trả 503 khi provider bắt buộc chưa được cấu hình, có notification
  `failed`, hoặc `pending` quá 10 phút. Response chỉ nêu tên provider thiếu,
  không chứa credential, recipient hay payload. Monitor endpoint mỗi phút và
  alert khi 503 hoặc latency tăng.
- Workers Observability query dùng `event=cms.operational_incident`; alert theo
  `category` (`publish`, `upload`, `notification`, `migration`) hoặc fingerprint
  cụ thể như `publish:page.publish.scheduled`,
  `upload:media.upload.persistence`,
  `notification:lead.notification.retry.automatic` và
  `migration:d1.migration.apply`. Event không chứa actor, lead payload hay stack;
  error text được bound và redact trước khi log.

### Audit Cloudflare alert routing

Audit dùng account từ Alchemy profile và credential chỉ-đọc từ private env/profile;
không in token, account ID, email nhận, webhook URL, policy ID, filter hay alert
body:

```bash
bun run cloudflare:alerts:audit
bun run cloudflare:alerts:audit --days=30 --json
```

Command kiểm tra alert type mà account được dùng, delivery mechanism, policy đã
bật và dispatch history. Nó chỉ pass khi email delivery sẵn sàng, có policy
Health Check hoặc Workers Observability đang bật và có receipt tương ứng trong
history; account chỉ có capability vẫn fail. Dùng OAuth profile `alerts` riêng
cho read audit; dedicated `CLOUDFLARE_ALERT_API_TOKEN` bên dưới dùng cho write.
Không mở rộng profile deploy mặc định chỉ để quản lý alert.

Trên staging `workers.dev`, ưu tiên Workers Observability alert cho structured
incident query ở trên. Khi đã có custom domain/zone, có thể thêm Health Check
vào `/api/health` để bắt cả downtime và notification/configuration state 503.
Notification policy không tự tạo monitor/query: phải cấu hình nguồn alert,
trigger một failure staging có kiểm soát, xác nhận email thật đến inbox rồi chạy
audit lại. Capability audit không thay thế Resend lead smoke hoặc bằng chứng
người vận hành đã nhận alert.

### Chuẩn bị policy alert có kiểm soát

Tạo profile Alchemy least-privilege từ account identity của profile deploy. Hai
lệnh đầu không đọc hoặc thay đổi credential; apply chỉ thêm profile mới và từ
chối overwrite profile khác cấu hình:

```bash
bun run cloudflare:alerts:profile --dry-run \
  --source-profile=default --target-profile=alerts
bun run cloudflare:alerts:profile --apply \
  --source-profile=default --target-profile=alerts \
  --confirm-profile=alerts
```

Với Alchemy beta được pin trong repo, chạy configure rõ ràng từ
`packages/infra` (plain `alchemy login` có thể chỉ in profile mà không tạo
credential):

```bash
cd packages/infra
bunx alchemy login --profile alerts --configure
```

Chọn OAuth, customize scope và chỉ giữ `account:read`, `user:read`,
`notification:read`, `notification:write`. Không paste authorization code hoặc
token vào log/chat. Sau callback, quay về root và chạy lại dry-run; chỉ tiếp tục
khi receipt có `status=unchanged`, `credentialsReady=true`, đúng bốn scope và
`credentialsPrinted=false`. OAuth token thực tế còn có `offline_access` để
Alchemy refresh, nhưng live provider evidence xác nhận Alchemy OAuth chỉ nên dùng
để đọc/verify endpoint này: Cloudflare vẫn từ chối policy POST với HTTP 403.

Tạo **Account API Token** riêng trong Cloudflare Dashboard tại **Manage Account →
Account API Tokens**. Dùng custom token, giới hạn resource vào đúng account này,
và chỉ cấp Account → **Notifications Read** cùng **Notifications Edit/Write**.
Cloudflare UI gọi quyền CRUD là `Edit`, trong khi API contract gọi nó là
`Notifications Write`. Không dùng `Account Settings Write` dù endpoint chấp nhận,
vì quyền đó rộng hơn cần thiết. Lưu secret một lần vào private root `.env`; không
paste vào chat/log và không reuse deploy token:

```bash
CLOUDFLARE_ALERT_API_TOKEN=<dedicated-account-token>
```

Đặt email nhận trong private env, không truyền trên command line và không commit:

```bash
CLOUDFLARE_ALERT_EMAIL=<operations-inbox>
```

Chạy dry-run chỉ đọc. Command kiểm tra live provider contract, email eligibility,
same-name collision và chỉ in boolean/count; recipient, account ID, policy ID,
filter payload và dispatch body không xuất hiện. Generic
`CLOUDFLARE_API_TOKEN` cố ý bị ignore; nếu cần tạo policy, dry-run chỉ báo
`writeAuthenticationReady=true` khi dedicated alert token ở trên hiện diện:

```bash
bun run cloudflare:alerts:policy --site=rem-viet --stage=staging \
  --origin=https://rem-viet-web-staging.terasumi.workers.dev \
  --profile=alerts
```

Nếu plan là `create`, apply cần xác nhận cả origin và deterministic policy name:

```bash
bun run cloudflare:alerts:policy --site=rem-viet --stage=staging \
  --origin=https://rem-viet-web-staging.terasumi.workers.dev \
  --profile=alerts \
  --confirm-origin=https://rem-viet-web-staging.terasumi.workers.dev \
  --confirm-policy=rem-viet-staging-operational-failures \
  --apply --json
```

Apply chỉ tạo tối đa một policy `workers_observability_alert`, email mechanism,
filter `status=FIRING_FAILED`. Nó không update/delete policy trùng tên bị drift.
Dedicated token cần **Notifications: Read** cho dry-run/verify và
**Notifications: Write** cho apply. Một token active hoặc đọc thành công chưa
chứng minh quyền write; HTTP POST chính là provider proof cuối cùng. API
Notification policy công khai không tạo Workers Observability query/threshold,
vì vậy output vẫn ghi
`underlyingAlertThresholdConfigured=false`.

Trong Cloudflare Dashboard, tạo threshold cho
`event=cms.operational_incident` và `category=notification`. Sau đó dùng một
staging credential Resend sai có kiểm soát để phát đúng một notification failure,
khôi phục credential ngay, xác nhận email Cloudflare thật đã đến inbox và ghi
timestamp ISO. Verify chỉ chấp nhận dispatch có `policy_id` đúng với deterministic
policy và có thời gian sau lúc policy được tạo:

```bash
bun run cloudflare:alerts:policy --site=rem-viet --stage=staging \
  --origin=https://rem-viet-web-staging.terasumi.workers.dev \
  --profile=alerts --verify \
  --receipt-confirmed-at=<ISO-timestamp> --json
```

Chỉ verify có human receipt mới xuất `releaseEvidence` chứa dispatch receipt ID.
Dry-run/apply và provider history không có xác nhận inbox luôn giữ evidence null.

### Smoke notification sau khi cấu hình

1. Deploy staging với ba binding Resend, mở `/api/health` và xác nhận HTTP 200.
   Chạy dry-run chỉ đọc; command trả một UUID ổn định và không gửi form/email:

   ```bash
   bun run site:notification:smoke --site=rem-viet --stage=staging \
     --origin=https://<staging-host> --profile=default
   ```

   Nếu output báo health contract chưa expose provider configuration, deploy
   build hiện tại trước; không được suy diễn health cũ là provider đã sẵn sàng.

2. Copy UUID từ dry-run rồi apply với origin xác nhận chính xác:

   ```bash
   bun run site:notification:smoke --site=rem-viet --stage=staging \
     --origin=https://<staging-host> --profile=default \
     --run-id=<dry-run-uuid> --confirm-origin=https://<staging-host> --apply --json
   ```

   Apply chỉ chạy khi form active bật email và health chứng minh provider đã cấu
   hình. Nó tạo đúng một lead synthetic trong inbox, request một email thật, gửi
   lại cùng public idempotency key và đối chiếu D1: một row, response duplicate,
   một email adapter `sent`, một provider ID và `attemptCount=1`. Output vẫn giữ
   `releaseEvidence=null` vì provider accept không chứng minh inbox đã nhận.

3. Người nhận xác nhận nhìn thấy đúng một email, ghi timestamp ISO, rồi verify:

   ```bash
   bun run site:notification:smoke --site=rem-viet --stage=staging \
     --origin=https://<staging-host> --profile=default \
     --run-id=<same-uuid> --verify \
     --receipt-confirmed-at=<ISO-timestamp> --json
   ```

   Verify chỉ replay một key đã tồn tại, sau đó chứng minh ID/provider state và
   attempt count không đổi. Chỉ output này được copy phần `releaseEvidence` vào
   `notification` của release record; không ghi recipient hay email body.

4. Tạm dùng API key staging không hợp lệ với một run ID khác, gửi lead thứ hai,
   xác nhận lead
   `failed`, `/api/health` trả 503 và scheduler log có retry. Khôi phục key, bấm
   **Gửi lại email**, xác nhận đúng một email được gửi và health trở về 200.
5. Chỉ xóa lead smoke sau khi evidence/ảnh receipt đã được lưu trong kho agency;
   không ghi API key, email body hoặc dữ
   liệu cá nhân vào log/ticket.

## Real-user Web Vitals

- Đặt `RUM_SAMPLE_RATE` trong private env của từng site (`1` để thu 100% session,
  `0` để tắt), rồi deploy bằng Alchemy. Đây không phải secret. Site traffic cao
  nên giảm dần sample rate sau khi đã có đủ evidence.
- Collector chỉ chạy ở route public, bỏ qua `navigator.webdriver`, không thu IP,
  user-agent, cookie, account, query string hay DOM selector. Endpoint
  `/api/vitals` chỉ nhận JSON same-origin tối đa 2 KiB; D1 tự deduplicate metric
  ID và cron xóa dữ liệu quá 90 ngày.
- Mở `/admin/performance` bằng Owner/Admin để xem p75 theo 7/28/90 ngày, pathname
  và nhóm thiết bị. `Chưa đủ mẫu` không phải pass: từng CLS/LCP/INP phải có ít
  nhất 75 mẫu trong slice đang xét.
- Trước release, chạy audit D1 chỉ-đọc từ root; origin staging phải truyền rõ:

  ```bash
  bun run site:vitals:audit --site=rem-viet --stage=staging --origin=https://rem-viet-web-staging.terasumi.workers.dev --profile=default
  bun run site:vitals:audit --site=rem-viet --stage=staging --origin=https://rem-viet-web-staging.terasumi.workers.dev --profile=default --json
  ```

  Command dùng đúng cửa sổ 28 ngày, loại `/__synthetic__/`, tính nearest-rank
  p75 trực tiếp từ D1 và cố ý trả nonzero khi chưa đủ/không đạt. Nó chỉ phát
  `releaseEvidence` khi cả ba metric có >= 75 mẫu và p75 CLS <= 0.1, LCP <=
  2.500 ms, INP <= 200 ms; copy object đó vào release record. Output không chứa
  account/database ID hoặc credential. Ghi thêm sample rate, Worker version và
  traffic context vào hồ sơ vận hành.

- UI `/admin/performance` vẫn dùng để phân tích theo path/device; JSON tải từ UI
  là bằng chứng đối chiếu, không thay cho fail-closed CLI ở release gate.
- Request smoke dùng pathname `/__synthetic__/<ticket>`; summary luôn loại prefix
  này. Không tạo hàng loạt dữ liệu giả để làm đủ ngưỡng mẫu.
- Nếu endpoint trả 429, kiểm tra bot/abuse và giảm sampling; service cap ở 1.000
  report/metric/phút. Nếu metric fail, giữ release gate đóng, phân đoạn theo path
  và device, sửa regression, deploy lại rồi chờ cửa sổ field data đại diện mới.

## Incident tối thiểu

1. Dừng publish/deploy mới; ghi request id, entity id và thời điểm.
2. Public vẫn đọc immutable revision. Restore revision chỉ tạo draft; kiểm tra
   preview rồi publish.
3. Nếu DB hỏng, provision staging D1, import backup, chạy migrations còn thiếu và
   smoke. Chỉ đổi binding/domain sau khi owner xác nhận.
4. Ghi postmortem và bổ sung regression test.
