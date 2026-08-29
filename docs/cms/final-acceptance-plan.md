# Final E2E and human acceptance plan

> Trạng thái: Deferred cho đến khi implementation freeze<br>
> Phạm vi: Final acceptance của `perfect-cms-plugin-goal.vi.md`, không phải
> implementation blocker và không yêu cầu paid upgrade

## 1. Phase boundary

Trong lúc CMS còn được implement, mỗi thay đổi vẫn phải chạy targeted tests,
typecheck, build và security checks tương xứng với phạm vi thay đổi. Ba evidence
sau được chạy một lần trên final candidate thay vì chặn từng increment:

1. full desktop/mobile browser E2E;
2. non-developer staging pilot với signed handover receipt;
3. independent documentation walkthrough với operator-approved receipt.

Thiếu ba evidence này không được block `/goal resume` khi implementation vẫn
đang tiếp tục. Chúng chỉ được phép block tuyên bố goal hoàn thành sau khi exact
implementation-freeze commit đã được chốt.

## 2. Điều kiện bắt đầu final acceptance

- Tất cả implementation gate trong Section 10.1 có authoritative evidence.
- Worktree clean, `main` đồng bộ remote và candidate là full Git SHA.
- Không còn code/schema/docs change dự kiến cho candidate.
- Staging deploy được chính candidate, báo đúng site/stage, `sourceState=clean`
  và deploy-input SHA-256.
- Không dùng production credentials, client personal data hoặc paid entitlement
  để thay cho fixture/free/self-hosted acceptance path.

Nếu code hoặc tài liệu đổi sau thời điểm này, hủy freeze và chạy lại phase trên
commit mới. Receipt từ commit cũ không chứng minh candidate mới.

## 3. Track A — automated final E2E

Trên exact clean candidate:

```bash
bun install --frozen-lockfile
bun run quality
```

Giữ kết quả full Desktop Chrome/Mobile Chrome, clean-checkout portability,
provider conformance, migration/upgrade/rollback và security audit. Targeted
test đã chạy trong implementation là feedback sớm; final acceptance vẫn phải
chạy lại toàn bộ matrix sau freeze.

## 4. Track B — non-developer staging pilot

Deploy exact candidate lên staging, sau đó một người không viết implementation
thực hiện `docs/pilot-handover-script.md`. Project owner/AI chỉ quan sát, không
thao tác hoặc hướng dẫn ngoài manual. Tester phê duyệt receipt sau khi hoàn tất.

```bash
bun run release:pilot:verify \
  --evidence=docs/releases/pilot-evidence.json \
  --site=rem-viet \
  --origin=<final-staging-origin> \
  --commit=<full-final-deployed-git-sha>
```

Không reuse receipt của staging commit cũ nếu final candidate đã thay đổi.

## 5. Track C — independent documentation walkthrough

Một operator khác project owner và khác người tự xác nhận implementation dùng
fresh clone/isolated clean checkout, chỉ làm theo
`docs/cms/documentation-walkthrough.md`, rồi phê duyệt evidence sau khi chín task
đều pass.

```bash
bun run release:docs:verify \
  --evidence=docs/releases/documentation-walkthrough-evidence.json \
  --repository=TongDucThanhNam/rem-viet \
  --commit=<full-final-documentation-git-sha>
```

Finding P2/P3 phải được remediate và rerun trên clean checkout mới. P0/P1 hoặc
undocumented developer intervention làm final acceptance fail.

## 6. Exit gate

Goal chỉ được đánh dấu complete khi:

- Track A pass trên exact final candidate;
- Track B và C có receipt thật, verifier pass và không self-attestation;
- mọi receipt bind cùng final code/docs boundary;
- không còn P0/P1 hoặc cleanup failure;
- completion audit được cập nhật từ evidence thật.

Cho đến khi implementation freeze được chốt, trạng thái đúng là **active
implementation**, không phải **blocked by final testing**.
