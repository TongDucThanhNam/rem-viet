# GOAL V2 — CMS dễ dùng, bền vững và có visual hierarchy rõ ràng

> Ngày lập goal: 2026-09-01  
> Trạng thái: Active — CMS-V2-P0-01 complete  
> Kế thừa: [`perfect-cms-plugin-goal.vi.md`](./perfect-cms-plugin-goal.vi.md)  
> Verification hậu kỳ:
> [`perfect-cms-plugin-v2-verification-index.vi.md`](./perfect-cms-plugin-v2-verification-index.vi.md)

## 1. Kết luận ngắn

V1 đã hoàn thành chiều rộng của CMS nhưng Admin hiện chưa đạt chất lượng sản
phẩm để giao cho người dùng không viết code. V2 không bổ sung thêm một danh sách
feature lớn. V2 tập trung sửa ba vấn đề nền tảng:

1. Admin shell phải là **TanStack Router layout thật**, không được tạo lại trong
   từng page.
2. Homepage phải là **canvas-first visual editor**: click nội dung đang nhìn thấy,
   sửa đúng chỗ đó, chỉ mở inspector khi cần.
3. Post phải là **writing-first editor**: một bề mặt soạn thảo liên tục, Markdown
   shortcuts/import-export và asset picker tích hợp; metadata, SEO, workflow và
   revision được progressive disclosure.

Đồng thời, toàn bộ Admin phải dùng chung một hệ thống visual hierarchy dựa trên
Refactoring UI và Progressive Disclosure. Tailwind tiếp tục là implementation
layer của developer, không phải giao diện authoring trực tiếp của client.

## 2. Ranh giới code-only

Goal này chỉ hoàn thành khi source code, route architecture, editor packages,
schema adapter, migration và documentation tương ứng đã tồn tại trong
repository. Goal không bị block bởi:

- browser/E2E/visual regression;
- user verification, usability pilot hoặc human acceptance;
- deploy staging/production, release receipt hoặc paid entitlement;
- performance/a11y measurement chạy sau implementation freeze.

Những việc trên được index riêng tại
[`perfect-cms-plugin-v2-verification-index.vi.md`](./perfect-cms-plugin-v2-verification-index.vi.md)
và không được dùng để block `/goal resume`, commit hoặc code completion của V2.

## 3. Chẩn đoán từ code hiện tại

### 3.1 Admin shell đang remount theo page

Đây là lỗi kiến trúc, không chỉ là cảm giác animation:

- repository chưa có `apps/web/src/routes/admin.tsx` hoặc
  `apps/web/src/routes/admin/route.tsx` làm layout cho toàn bộ `/admin/*`;
- generated route tree hiện gắn `/admin/home`, `/admin/dashboard`,
  `/admin/performance` và nhiều route Admin khác trực tiếp vào root route;
- có **26 source files** import `AdminShell`, phần lớn page tự render
  `<AdminShell>...</AdminShell>`;
- vì shell là con của từng page, đổi route làm sidebar/header/command center
  unmount rồi mount lại; state thu gọn sidebar, disclosure và focus bị reset;
- một số internal action vẫn dùng `<a href>` thay cho typed TanStack `<Link>`,
  tạo nguy cơ document navigation thật.

TanStack Router đã có đúng primitive cần dùng: layout route render một lần và
child route render qua `<Outlet />`. V2 phải chuyển authentication, MFA gate,
sidebar, header, command center, route title và content boundary vào layout này.

### 3.2 Homepage editor có đủ capability nhưng sai default hierarchy

UI map sinh từ `generate-ui-map.ts` cho thấy workspace desktop hiện có ba cột:

```text
AdminHomeRoute
└─ RemVietEditorShell
   ├─ Structure (17rem)
   │  ├─ page metadata / SEO
   │  └─ outline + block composer
   ├─ Production preview (minmax(0, 1fr))
   │  ├─ device / undo / redo / focus toolbar
   │  └─ status + revisions
   └─ Inspector (26rem)
      ├─ selected block status
      ├─ all controls for the selected block
      └─ sticky save action
```

Canvas đã có secure preview, selection, outline, move/insert/duplicate/delete,
responsive profiles và inline targeting. Vấn đề là UI hiển thị quá nhiều hệ
thống ngang hàng. Người dùng phải hiểu block schema, panel structure và workflow
trước khi thực hiện tác vụ đơn giản như đổi một dòng chữ hoặc một ảnh.

Tailwind không tự biến React thành canvas editor. Tailwind chỉ tạo CSS utility
ở build time. Muốn client chỉnh UI an toàn cần một lớp authoring mapping:

```text
visual control → design token / variant → typed block data → production React
```

Client không được nhập class Tailwind tùy ý. Developer khai báo variant hợp lệ
như spacing, alignment, tone, crop, density và visibility; editor chỉ chọn qua
control có preview. Cách này giữ responsive design và tránh phá layout.

### 3.3 Post editor đang là form builder chứ chưa phải writing tool

UI map của `CmsRichTextEditor` cho thấy mỗi paragraph/heading/list được phân rã
thành card, input/textarea, mark checkbox, link input và nút quản lý block. Toàn
screen còn xếp thêm review panel, preview, metadata, cover, SEO, save bar và
revision history. Data model an toàn nhưng interaction cost quá cao.

V2 chọn hướng sau:

- dùng **Tiptap core** làm interaction engine cho một editing surface liên tục;
- giữ `RichTextDocument` có type và ID ổn định làm persistence/source of truth;
- thêm adapter hai chiều giữa Tiptap JSON và `RichTextDocument`;
- hỗ trợ Markdown shortcuts và import/export Markdown;
- image/media là custom node nối trực tiếp DAM picker, upload progress, alt,
  caption, replace và usage tracking;
- slash command thêm heading, list, quote, image, video, code và các block được
  template cho phép;
- không lưu HTML tùy ý và không chạy JSX do client nhập.

Không chọn raw MDX làm source of truth. MDX cho phép JSX/component execution nên
không phải boundary phù hợp cho untrusted client content. Có thể bổ sung
Markdown/MDX-compatible import-export với component whitelist, nhưng runtime
luôn parse về schema an toàn trước khi lưu hoặc render.

### 3.4 Visual hierarchy chưa có source of truth

`generate-ui-map.ts` đã chạy được trực tiếp trên codebase và xác nhận các cây
component/layout trên. Tuy nhiên tool đang nằm ngoài repository, chưa có command
chuẩn, output snapshot hoặc rule phát hiện hierarchy regression.

V2 phải đưa một bản phù hợp vào repo và biến UI map thành artifact kiến trúc:

- map được toàn Admin shell và focus theo route/component;
- output deterministic, loại bỏ style signal không liên quan khi dùng
  `--layoutOnly`;
- có summary về depth, số interactive controls, số persistent/disclosed region,
  duplicate shell và internal raw anchor;
- có checked-in baseline map cho shell, homepage và post editor;
- map phục vụ refactor code, không phải acceptance test của người dùng.

## 4. Nguyên tắc sản phẩm V2

### 4.1 Refactoring UI

- hierarchy đến từ size, weight, contrast và spacing trước khi dùng border/card;
- mỗi viewport có một primary action rõ ràng;
- label phụ và chrome giảm contrast, content đang làm việc có contrast cao nhất;
- card chỉ dùng khi cần group có boundary thật; không bọc mọi section vào card;
- content width theo loại việc: writing hẹp, data table rộng, canvas dùng tối đa;
- spacing dùng token có nhịp, không dùng chuỗi gap/padding tùy ý giữa các route;
- destructive/rare action không cạnh tranh với save/publish;
- empty, loading, error và conflict state dùng chung hierarchy với success state.

### 4.2 Progressive Disclosure

Mặc định chỉ hiển thị thông tin cần để hoàn thành tác vụ hiện tại:

- **primary:** content/canvas đang sửa;
- **secondary:** inspector cho selection hiện tại;
- **tertiary:** SEO, advanced URL, workflow, scheduling, revisions, debug;
- tertiary content mở bằng tab/sheet/disclosure và giữ state khi đổi selection;
- lỗi liên quan field phải mở đúng disclosure và focus đúng control;
- quyền không có phải ẩn action; quyền bị khóa nhưng cần giải thích thì hiển thị
  disabled kèm lý do ngắn.

### 4.3 Production component là canvas

- preview phải render component production và cùng token/theme/breakpoint;
- click target map tới schema field hoặc block ID ổn định;
- inline text dành cho thay đổi ngắn; inspector dành cho cấu trúc, media và
  advanced options;
- drag/drop có indicator rõ, keyboard path và constraint fail closed;
- canvas không expose raw JSON, raw Tailwind hoặc arbitrary CSS cho client.

## 5. Milestone code theo độ ưu tiên

### CMS-V2-P0-01 — Persistent TanStack Admin layout

Tạo route layout `/admin` và di chuyển toàn bộ shell ownership vào đó:

- layout `beforeLoad` lấy session/capability một lần theo route lifecycle;
- MFA redirect, error boundary, pending boundary và Admin context nằm tại layout;
- `AdminShell` render `<Outlet />`, không nhận `children` từ từng page;
- page khai báo typed route handle/meta cho title, description, section, actions,
  content width và workspace mode;
- action động được publish qua route context/portal registry, cleanup khi child
  route unmount;
- sidebar expanded state, open group, command palette state và scroll container
  sống qua child navigation; preference có thể persist local storage;
- xóa 26 page-level imports/wrappers sau migration;
- tất cả internal Admin navigation dùng `Link`, `useNavigate` hoặc router API;
- preview/download/external URLs mới được phép dùng `<a>` và phải được annotate.

Completion code:

- [x] Có một Admin layout route làm parent của mọi interactive `/admin/*` route.
- [x] Preview routes bypass Admin chrome rõ ràng nhưng vẫn dùng shared auth context.
- [x] Không còn page tự mount `AdminShell`.
- [x] Route meta/action API có type và shared documentation.
- [x] Không còn raw anchor cho internal Admin navigation.

### CMS-V2-P0-02 — Admin information architecture và design primitives

Tạo shared Admin design layer thay cho mỗi route tự ghép Tailwind:

- `AdminPage`, `AdminPageHeader`, `AdminToolbar`, `AdminContent`,
  `AdminSplitView`, `AdminInspector`, `AdminDisclosure`, `AdminStatus`;
- content width presets: `reading`, `form`, `table`, `workspace`, `full`;
- semantic tokens cho surface, raised surface, muted text, divider, focus,
  success/warning/destructive và density;
- typography ladder tối đa 4 cấp trên một page;
- action priority contract: primary, secondary, quiet, destructive-overflow;
- mobile shell dùng sheet navigation nhưng giữ cùng information architecture;
- route inventory map mỗi page vào một task archetype thay vì style riêng.

Code inventory: [`admin-route-inventory.v2.vi.md`](./admin-route-inventory.v2.vi.md).

Completion code:

- [x] Mọi active Admin route dùng shared page primitive.
- [x] Không còn heading/description bị lặp giữa shell và page body.
- [ ] Advanced/destructive controls không nằm cùng cấp primary content.
- [ ] Loading/empty/error/conflict dùng shared state primitive.

### CMS-V2-P0-03 — Homepage canvas-first authoring

Refactor homepage thành application workspace:

- canvas là vùng chính và chiếm phần lớn viewport ngay khi mở;
- top toolbar chỉ giữ Back, page status, device, undo/redo, preview và Save/Publish;
- outline là left rail có thể đóng, có search và hierarchy; không chứa SEO/form;
- inspector là right rail theo selection, có tab `Nội dung`, `Thiết kế`, `Nâng cao`;
- click text trên canvas cho phép sửa inline khi field contract cho phép;
- click image mở media quick actions và DAM picker, không bắt tìm field thủ công;
- block inserter là searchable command/pattern library với preview;
- drag/reorder hoạt động trên canvas và outline qua cùng composition command;
- responsive control dùng token/variant constraints, có scope desktop/tablet/mobile;
- page settings, SEO, revisions và workflow chuyển sang sheet riêng;
- autosave là default; explicit Save là recovery/assurance, không phải thao tác bắt buộc;
- preserve selection, scroll, inspector tab và focused mode khi data refresh.

Completion code:

- [x] Tác vụ đổi text/ảnh không yêu cầu mở structure tree hoặc tìm schema field.
- [x] Canvas, outline và inspector dùng cùng selection/composition state machine.
- [x] Design controls ghi typed variants, không ghi raw Tailwind/CSS.
- [x] Page settings/SEO/revisions không chiếm canvas mặc định.
- [ ] Homepage implementation tách khỏi route file lớn thành workspace modules.

### CMS-V2-P0-04 — Writing-first post editor

Thay custom form-per-span bằng editor surface liên tục:

- package/editor adapter dựa trên Tiptap core;
- schema/serializer giữ tương thích với `RichTextDocument` hiện tại;
- toolbar context cho strong/emphasis/link/code và block type;
- Markdown shortcuts, paste từ Google Docs/Markdown và clean normalization;
- slash command và keyboard block movement;
- media node tích hợp DAM, alt/caption, replace, focal/crop metadata;
- upload không làm mất selection hoặc draft khi thất bại;
- title + writing surface là primary column;
- document settings là right sheet/rail có summary trạng thái;
- SEO, canonical, robots và social preview là disclosure riêng;
- review, schedule, publish và revision history mở theo action từ top bar;
- preview là optional split view, không đẩy writing surface xuống dưới;
- import/export Markdown có deterministic round trip trong supported schema;
- unknown/unsupported legacy block có read-only fallback và migration path.

Completion code:

- [x] Paragraph/heading/list không còn được soạn qua chuỗi textarea/card/checkbox.
- [x] Persistence vẫn là safe structured document, không lưu arbitrary HTML/JSX.
- [x] Markdown và media có adapter chính thức, không phải route-level hack.
- [x] Metadata/SEO/workflow/revisions được disclose theo intent.
- [ ] New/edit post dùng chung editor shell và draft state machine.

### CMS-V2-P1-01 — UI map tool và hierarchy budget

Đưa logic từ `generate-ui-map.ts` vào repository dưới command được maintain:

```bash
bun run ui-map --entry apps/web/src/components/admin-shell.tsx \
  --rootComponent AdminShell --layoutOnly
```

Tool phải:

- giữ AST traversal, alias, focus và scope hiện có;
- hiểu TanStack layout route, `Outlet`, route meta và shared Admin primitives;
- tạo ASCII map và machine-readable JSON;
- phát hiện duplicate shell ownership và raw internal navigation;
- tạo summary metrics nhưng không biến số node đơn thuần thành quality score;
- có baseline artifacts cho shell/home/post để reviewer thấy hierarchy trước/sau.

Completion code:

- [x] Script và dependency nằm trong monorepo, command chạy từ root.
- [x] ASCII/JSON output deterministic và path portable.
- [x] Baseline maps được index trong docs V2.
- [x] Map chỉ là architecture signal; browser/human quality vẫn ở verification index.

### CMS-V2-P1-02 — Route decomposition và reusable editor platform

- route chỉ điều phối loader/mutation/workflow, không chứa hàng nghìn dòng UI;
- homepage/post workspace state machine nằm trong reusable package hoặc feature module;
- inspector registry map schema field → control → canvas target;
- shared command system cho select/insert/move/duplicate/delete/undo/redo;
- shared document settings, SEO, publish, revision và conflict surfaces;
- Rèm Việt template adapter cung cấp block-specific renderer/control nhưng không
  fork shell algorithm.

Completion code:

- [ ] `admin/home.tsx` và post edit route không còn là monolithic UI owner.
- [ ] Editor shell/selection/history/asset contracts có public type.
- [ ] Template-specific code không import app route internals.

## 6. Migration và backward compatibility

- Không đổi published document shape nếu chưa có migration versioned.
- Tiptap chỉ là interaction engine; serializer phải round-trip dữ liệu v1.
- Legacy rich-text block không hỗ trợ phải render được và có migration receipt.
- Existing preview channel, optimistic conflict, autosave, revisions, workflow,
  permission và audit không bị bỏ khi đổi UI.
- Route URL công khai giữ nguyên; chỉ route ownership/layout tree thay đổi.
- Standalone preview phải tiếp tục không render Admin chrome.
- Design variant mới có default tương thích block cũ.

## 7. Non-goals của V2

- Không thay CMS bằng WordPress, Payload, Sanity hoặc một SaaS editor.
- Không clone toàn bộ Gutenberg hoặc cho cài arbitrary WordPress plugin.
- Không cho client nhập arbitrary Tailwind, CSS, HTML, JavaScript hoặc JSX.
- Không dùng raw MDX runtime cho untrusted content.
- Không thêm field/provider/workflow mới nếu không trực tiếp giảm interaction cost.
- Không coi “thêm card/border/màu” là sửa visual hierarchy.
- Không block code goal bằng browser screenshot, human pilot hoặc release gate.

## 8. Thứ tự implementation bắt buộc

1. Persistent Admin layout và route meta/action contract.
2. Shared Admin page primitives + hierarchy tokens.
3. UI map command/baseline để giữ kiến trúc nhìn thấy được.
4. Homepage canvas-first workspace.
5. Post writing-first workspace + Markdown/media adapter.
6. Route decomposition và cleanup legacy wrappers/editor controls.
7. Freeze code scope rồi chuyển sang V2 verification index.

Không làm homepage/post redesign trên shell cũ vì sẽ phải sửa lại lifecycle,
state persistence và responsive layout lần thứ hai.

## 9. Code completion checklist V2

- [x] Một TanStack `/admin` layout sở hữu shell, auth context và child `<Outlet />`.
- [x] Sidebar/header/command center không còn thuộc từng page component.
- [x] Admin navigation nội bộ dùng router primitives.
- [ ] Shared hierarchy/page/workspace primitives được dùng toàn Admin.
- [ ] Homepage mở ở canvas-first mode và sửa trực tiếp text/media được.
- [x] Homepage design controls map vào typed variants/tokens.
- [x] Post editor là một writing surface, có Markdown workflow và DAM node.
- [x] Raw MDX/HTML/JSX không đi qua persistence/render boundary.
- [x] SEO/workflow/scheduling/revisions/debug đều progressive disclosure.
- [x] UI map ASCII/JSON và baseline artifacts nằm trong repository.
- [ ] Monolithic homepage/post route được tách thành reusable modules.
- [ ] V1 data, preview, autosave, conflict, permission và audit contracts được giữ.
- [ ] Testing/human/release tasks chỉ được index ở V2 verification document.

## 10. Tài liệu kỹ thuật nền

- [TanStack Router — Routing Concepts](https://tanstack.com/router/latest/docs/routing/routing-concepts)
- [TanStack Router — File-based routing](https://tanstack.com/router/latest/docs/routing/file-based-routing)
- [Tiptap — Custom node API](https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node)
- [Tiptap — Image extension](https://tiptap.dev/docs/editor/extensions/nodes/image)
- [Tiptap — Markdown basic usage](https://tiptap.dev/docs/editor/markdown/getting-started/basic-usage)
- [WordPress — Site Editor](https://wordpress.org/documentation/article/site-editor/)
- [WordPress — Adding blocks and patterns](https://wordpress.org/documentation/article/adding-a-new-block/)

## 11. Quyết định cuối cùng

V2 không cần thêm nhiều capability hơn WordPress/Payload. V2 cần làm các
capability đã có trở nên hiển nhiên và nhẹ đầu:

> Admin shell không nhấp nháy, canvas là nơi sửa trang, editor là nơi viết bài,
> advanced controls chỉ xuất hiện khi cần, còn Tailwind/schema/workflow phức tạp
> nằm phía dưới product surface.
