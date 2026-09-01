# UI map baseline cho CMS Goal V2

Các artifact trong thư mục này được sinh từ source code bằng:

```bash
bun run ui-map --layoutOnly --format json --summaryOnly
```

Mục tiêu là làm component/layout hierarchy nhìn thấy được trước khi refactor.
Metrics không phải quality score: nhiều node có thể hợp lý với một workspace phức
tạp, còn ít node không tự động tạo UX tốt. Chúng chỉ giúp phát hiện ownership sai,
depth bất thường, quá nhiều control mặc định và regression kiến trúc.

## Baseline 2026-09-01

| Surface                | Nodes | Components | Interactive | Disclosures | Max depth |
| ---------------------- | ----: | ---------: | ----------: | ----------: | --------: |
| Persistent Admin shell |   160 |          7 |          13 |           3 |        16 |
| Homepage authoring     |   932 |         15 |          68 |           9 |        33 |
| Full post editor       |   955 |         21 |          91 |           9 |        35 |
| Post sau decomposition |   851 |         25 |          70 |           9 |        41 |
| Rich-text trước Tiptap |   250 |          5 |          35 |           3 |        30 |
| Rich-text sau Tiptap   |   258 |         12 |          30 |           3 |        21 |

Hierarchy chính được đọc từ ASCII output:

```text
AdminShell
├─ desktop sidebar
├─ mobile navigation sheet
├─ route header + command launcher
├─ child page slot
└─ command center

AdminHomeRoute
└─ AdminPage
   ├─ conflict/status notices
   └─ RemVietEditorShell
      ├─ structure + composer + page metadata
      ├─ production preview + status + revisions
      └─ selected-block inspector + save

EditPostRoute
└─ AdminPage
   ├─ publish/schedule/review actions
   ├─ PostEditorWorkspace
   │  ├─ PostResponsivePreview
   │  └─ CmsPostForm → CmsRichTextEditor
   └─ PostRevisionHistory
```

## Artifact index

- [`admin-shell.v2-p0.json`](./admin-shell.v2-p0.json)
- [`homepage.before-canvas-refactor.json`](./homepage.before-canvas-refactor.json)
- [`post-editor.before-writing-refactor.json`](./post-editor.before-writing-refactor.json)
- [`post-editor.after-route-decomposition.json`](./post-editor.after-route-decomposition.json)
- [`rich-text-editor.after-writing-refactor.json`](./rich-text-editor.after-writing-refactor.json)

Full trees không được commit vì output của homepage/post dài hàng nghìn dòng và
che khuất thay đổi hữu ích. Reviewer có thể tạo full ASCII hoặc JSON tree bằng
cách bỏ `--summaryOnly`, hoặc dùng `--focus` và `--scope` để zoom vào component.

Generator còn report hai diagnostics ở toàn source directory:

- `duplicate-admin-shell`: child page tự mount lại persistent shell;
- `raw-admin-anchor`: internal `/admin` navigation dùng `<a>` mà không mở preview
  window mới.

Baseline hiện tại có zero diagnostic cho cả hai rule.
