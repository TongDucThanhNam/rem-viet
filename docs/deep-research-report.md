# CMS cho TanStack Start + Cloudflare: kiến trúc để biến nó thành một “plugin” tái sử dụng

## Kết luận trước

Với bài toán của mày, tao **không khuyên build một CMS từ đầu**, và cũng không khuyên chọn CMS chỉ dựa trên việc “có REST/GraphQL API”. Thứ mày thực sự cần productize là một **Content Platform Integration Layer** nằm giữa React design system và CMS.

Stack hiện tại của mày rất hợp với hướng này: TanStack Start hỗ trợ SSR, streaming và server functions, có đường deploy chính thức lên Cloudflare Workers; Alchemy có thể deploy full-stack Vite/TanStack Start đồng thời khai báo các resource Cloudflare như D1, R2, KV, Durable Objects dưới dạng TypeScript bindings. TanStack Start hiện vẫn được TanStack gắn nhãn **RC**, nên càng có lý do để giữ CMS boundary tương đối độc lập thay vì nhét quá nhiều runtime-specific code vào app. citeturn15search2turn15search12turn15search0turn15search13

**Recommendation của tao ở thời điểm ngày 14/08/2026:**

| Lựa chọn | Tao dùng khi nào | Verdict |
|---|---|---|
| **Sanity** | Muốn ship nhanh ngay bây giờ, React-friendly, schema-as-code, preview trực quan, user sửa landing page tốt | **Lựa chọn mặc định tốt nhất hiện tại** |
| **Payload CMS** | Muốn self-host, data/control thuộc về mình, Cloudflare D1 + R2, muốn CMS trở thành một phần platform của mình | **Lựa chọn chiến lược dài hạn tốt nhất** |
| **Storyblok** | UX của marketer/client là ưu tiên số một; muốn add/reorder React blocks trực tiếp trên page | **Visual editor tốt nhất cho use case landing page** |
| **TinaCMS** | Muốn Git vẫn là source of truth | **Git-based option tốt nhất trong shortlist** |
| **Builder.io** | Muốn trải nghiệm gần Webflow/page builder và chấp nhận phụ thuộc sâu hơn vào vendor/editor model | **Rất mạnh về visual building, nhưng không phải lựa chọn đầu tiên cho abstraction layer** |
| **DatoCMS / Prismic** | Muốn SaaS headless polished nhưng không thích ba option trên | **Đều tốt, nhưng không tạo lợi thế đủ lớn cho stack của mày** |
| **Directus** | Nội dung thực chất là relational/business data cần admin UI | **Tốt cho data backend hơn là landing-page CMS** |

Nếu tao đang build platform của mày, tao sẽ làm:

> **TanStack Start + Cloudflare frontend → `@yourorg/cms-core` → Sanity adapter ở phiên bản đầu tiên.**

Sau đó:

> **Payload adapter trở thành target self-hosted**, đặc biệt khi Payload 4 + TanStack adapter ổn định.

Đây là điểm cực kỳ đáng chú ý ở năm 2026: Payload đã công bố kiến trúc framework adapter cho Payload 4 để tách core khỏi framework-specific code, và **TanStack chính là proof point đầu tiên**. Tuy nhiên implementation TanStack hiện vẫn đang ở giai đoạn thử nghiệm; official demo cảnh báo không dành cho production. Stable Payload hiện vẫn thuộc dòng v3, và Payload 3 vẫn gắn chặt với Next.js. Vì vậy, **đừng thiết kế production architecture hôm nay với giả định Payload 4/TanStack đã stable**. citeturn20search0turn11search3turn11search1turn12search1turn12search2

Nếu bắt buộc self-host ngay hôm nay, tao vẫn chọn Payload, nhưng:

```text
Không:

TanStack Start Worker
└── Payload Admin + Payload API + frontend cùng runtime


Nên:

┌─────────────────────────────┐
│ TanStack Start              │
│ app.example.com             │
│ Cloudflare Worker           │
└──────────────┬──────────────┘
               │ REST / GraphQL
               ▼
┌─────────────────────────────┐
│ Payload CMS                 │
│ cms.example.com             │
│ Cloudflare Worker           │
├─────────────────────────────┤
│ D1                          │
│ R2                          │
└─────────────────────────────┘
```

Payload có first-party Cloudflare deployment support, D1 database adapter và R2 storage adapter, nên đây không phải một kiến trúc “hack”; vấn đề hiện tại chủ yếu là **framework coupling của Payload 3**, không phải Cloudflare itself. citeturn2view0turn10search1turn1search7

Còn nếu mục tiêu là **“user mở CMS, nhìn đúng landing page, click Hero, sửa title, kéo FAQ lên trên Testimonials, publish”**, thì shortlist thực tế của mày nên chỉ còn:

**Sanity ↔ Storyblok ↔ Payload**, với TinaCMS/Builder.io là những nhánh chuyên biệt.

---

## Bài toán thật sự không phải “cần một CMS”

CMS là một từ quá rộng. Hai sản phẩm đều gọi là “headless CMS” nhưng UX và kiến trúc có thể hoàn toàn khác nhau.

Điều mày đang mô tả không đơn thuần là:

> “User cần form để sửa một string trong database.”

Nó gần hơn với:

> “Developer sở hữu React component/design system; client sở hữu content và một phần composition của page.”

Đó là một **component-driven visual CMS**.

Ví dụ landing page hiện tại:

```tsx
export function LandingPage() {
  return (
    <>
      <Hero />
      <LogoCloud />
      <FeatureGrid />
      <Testimonials />
      <Pricing />
      <FAQ />
      <CTA />
    </>
  )
}
```

Sai lầm phổ biến là biến CMS thành nơi user nhập một cục HTML hoặc JSON khổng lồ.

Tao sẽ đổi nó thành:

```tsx
export function LandingPage({ page }: { page: CmsPage }) {
  return (
    <CmsPageRenderer
      page={page}
      registry={landingPageRegistry}
    />
  )
}
```

Trong khi content trở thành đại loại:

```ts
type PageSection =
  | HeroSection
  | LogoCloudSection
  | FeatureGridSection
  | TestimonialSection
  | PricingSection
  | FAQSection
  | CTASection

interface CmsPage {
  id: string
  slug: string
  title: string
  seo: SeoMetadata
  sections: PageSection[]
}
```

CMS chỉ quản lý:

```text
Hero
 ├─ eyebrow
 ├─ heading
 ├─ description
 ├─ primaryCTA
 ├─ secondaryCTA
 ├─ image
 └─ variant: "centered" | "split"

FeatureGrid
 ├─ heading
 ├─ description
 ├─ items[]
 └─ columns: 2 | 3 | 4
```

React vẫn quản lý:

```text
DOM structure
responsive design
typography
animations
accessibility
Tailwind classes
component behavior
loading strategy
SEO rendering
performance
business logic
```

**Đây là boundary quan trọng nhất của toàn bộ hệ thống.**

Mày không nên cho client nhập:

```ts
className
style
arbitrary HTML
JS
Tailwind class
component import
raw CSS
```

Trừ khi mục tiêu thật sự là xây một website builder.

Thay vào đó, expose những thứ như:

```ts
variant: "primary" | "secondary" | "minimal"
alignment: "left" | "center"
theme: "light" | "dark"
columns: 2 | 3 | 4
```

Như vậy user có tự do chỉnh content/composition nhưng **không thể phá design system**.

Storyblok đã áp dụng chính xác mental model “CMS block → frontend component”: React SDK của họ đăng ký React components rồi render block tương ứng; schema có thể whitelist những component được phép nằm trong một Blocks field và role thậm chí có thể giới hạn component nào editor được phép add/manage. citeturn20search8turn20search10turn20search14

Sanity hiện cũng hỗ trợ cùng một kiểu page-building bằng array of sections: visual editing có live preview, click-to-edit và drag-and-drop các section, trong khi việc reorder thực tế cập nhật structured content rồi frontend React render lại chứ không thao tác DOM thành một page-builder proprietary document. citeturn19search10turn19search7

Đó chính là thứ tao nghĩ phù hợp với mày nhất.

### Những capability mày thực sự cần

Không phải tất cả đều phải có ngay phiên bản đầu, nhưng CMS integration reusable của mày cuối cùng sẽ đụng tới:

| Capability | Tại sao cần |
|---|---|
| Structured content | Hero, CTA, FAQ... có schema rõ ràng |
| Component composition | Add/remove/reorder section |
| Draft / Published | Client sửa mà production chưa thay đổi |
| Live preview | Client biết mình đang sửa cái gì |
| Click-to-edit | Click text trên website → đúng field |
| Asset management | Ảnh/video không nằm tùm lum trong repo |
| SEO metadata | title, description, OG image, canonical |
| Global settings | navbar, footer, social links |
| Role/access | client không sửa schema/system |
| Webhooks | publish → purge/revalidate |
| Localization | nếu sau này ship multi-language |
| Version/history | cứu client khi sửa hỏng |
| Schema evolution | component v1 → v2 mà content cũ không chết |

Sanity visual editing hiện đã cung cấp live draft preview, click-to-edit và page-building drag/drop trên một protocol không khóa vào một framework cụ thể; Presentation Tool chạy frontend trong iframe và có framework-agnostic implementation path. citeturn19search4turn19search5turn19search6

Đó cũng là lý do tao **không khuyên build CMS admin từ đầu**. Viết CRUD form là phần dễ. Preview protocol, draft/published state, permissions, assets, versioning, editor UX, schema migrations và content lifecycle mới là phần sẽ ăn thời gian sản phẩm.

Mày nên build **CMS integration platform**, không build lại **CMS product**.

---

## Lọc toàn bộ danh sách CMS của mày

Danh sách mày tìm được thực ra trộn nhiều loại sản phẩm rất khác nhau. Thay vì benchmark 43 CMS bằng một bảng 43 × 30 feature rồi cuối cùng chẳng rút ra được gì, cách tốt hơn là eliminate theo architecture.

### Nhóm đáng nghiên cứu sâu cho bài toán này

| CMS | Lý do giữ lại |
|---|---|
| **Sanity** | Code-first schema + React Studio + mạnh về visual editing |
| **Payload CMS** | TypeScript/code-first + self-host + Cloudflare D1/R2 |
| **Storyblok** | Component-based visual editor rất khớp landing page |
| **TinaCMS** | Git-based nhưng vẫn có React visual editing |
| **Builder.io** | Custom React components + rất mạnh về visual page building |
| **DatoCMS** | Structured CMS + visual editing/live preview tốt |
| **Prismic** | Slice/page-builder model khớp component sections |
| **Directus** | Giữ lại cho trường hợp content gần với application/database data hơn marketing content |

DatoCMS có visual editing với draft mode, real-time updates và click-to-edit bằng metadata/source mapping; họ cũng có plugin SDK cho React/Vite. Prismic dùng **Slices** làm reusable page components và tập trung rõ vào page builder/live preview. citeturn13search1turn13search15turn14search9turn14search0

### SaaS headless tốt nhưng không tạo lợi thế rõ ràng cho stack của mày

**ButterCMS, Caisy, Contentful, Cosmic, Craft Cross CMS, Flotiq, Hygraph, Kontent.ai, microCMS, Prepr CMS** đều có thể cung cấp content qua API cho một TanStack Start frontend. Về mặt headless architecture thì chẳng có gì ngăn mày dùng chúng.

Nhưng “có API” không phải bottleneck của mày. Một Cloudflare Worker có thể gọi API HTTP bình thường; TanStack Start có SSR/server functions nên consume headless CMS rất tự nhiên. citeturn15search2turn15search13

Contentful thậm chí hiện có Studio Experiences để các editor compose page từ design-system components; React SDK cũng có sẵn. Hygraph mạnh ở GraphQL/structured component modeling. Craft Cross CMS là một API-based headless CMS trong hệ sinh thái KARTE. citeturn14search3turn14search6turn13search2turn16search16

Vấn đề là chúng không mang lại cho use case của mày một combination đủ vượt trội so với Sanity/Storyblok/Payload để tao chấp nhận thêm một ecosystem phải học.

### Nhóm self-host/backend-first

**ApostropheCMS, Directus, KeystoneJS, Strapi** đáng dùng trong nhiều hệ thống khác, nhưng với requirement “React landing page → client visual editing → reusable module → Cloudflare” thì chúng không phải điểm khởi đầu hấp dẫn nhất.

Directus đặc biệt tốt nếu content model thực chất là **database schema + admin/data studio**: nó kết nối SQL và tạo REST/GraphQL API, đồng thời có extension system cho custom interfaces/modules/panels. citeturn1search5turn6search2

Tao sẽ chọn Directus thay Sanity khi requirement chuyển thành kiểu:

```text
Products
Customers
Locations
Jobs
Partners
Orders
Events
Members
Inventory
```

và client cần một database admin UX.

Còn:

```text
Hero
FeatureGrid
Testimonials
FAQ
CTA
Landing pages
SEO
```

thì Sanity/Storyblok hợp mental model hơn.

Strapi cũng là generic headless CMS rất ổn, nhưng backend của nó thuộc Node/server ecosystem; tài liệu tích hợp Cloudflare thường dùng Workers như edge layer, trong khi database support chính xoay quanh PostgreSQL/MySQL/MariaDB/SQLite. Nó không cho mày lợi thế Cloudflare-native tương đương hướng Payload + D1/R2. citeturn6search3turn6search25

### Nhóm Git/file-based

Danh sách của mày có khá nhiều:

**CloudCannon, Decap CMS, Front Matter CMS, GitCMS, JekyllPad, Keystatic, Pages CMS, Sitepins, Spinal.**

Các sản phẩm này có một triết lý rất hấp dẫn:

```text
Git repository = content database
```

Decap lưu content trong Git và có editorial workflow dựa trên Git/PR. Keystatic GitHub mode cũng dùng repository làm storage và yêu cầu GitHub write access. Pages CMS không cần database/API backend mà sửa trực tiếp các file trong GitHub. citeturn5search20turn5search2turn5search0turn5search3

Các CMS nhỏ hơn trong danh sách của mày cũng cùng hướng: GitCMS biến GitHub thành CMS cho Markdown; JekyllPad là browser-based editor kết nối GitHub; Sitepins và Spinal đều Git-based. citeturn16search5turn16search6turn16search3turn17search4

Đây là model tuyệt vời cho:

```text
blog
documentation
changelog
developer portal
marketing site chủ yếu static
```

Nhưng nó không phải default tao chọn cho mô hình **“ship product cho client hàng loạt”**.

Vì khi content update gắn vào Git, mày thường đưa thêm những concept này vào editorial flow:

```text
GitHub
commit
branch
PR
build
deployment
repository permission
```

Đó là các abstraction mà developer thích nhưng client không nhất thiết phải biết.

Điều này đặc biệt quan trọng nếu sau này mày có:

```text
Project A — Client A
Project B — Client B
Project C — Client C
...
Project N — Client N
```

Mày có thể làm Git-based rất ngon, nhưng lúc đó **Git trở thành một phần của CMS product model**, không còn chỉ là implementation detail.

### TinaCMS là ngoại lệ đáng chú ý

Tina vẫn Git-first nhưng có visual editing cho React và cho phép content update được preview trực tiếp. Tina cũng có tài liệu chính thức để chạy SSR/API/visual editing trên Cloudflare Workers và có self-hosted backend architecture với Git provider, database adapter và authentication provider. citeturn5search13turn6search8turn5search1

Do đó nếu mày nói:

> “Tao bắt buộc muốn content cuối cùng nằm trong repo.”

thì **TinaCMS nhảy thẳng lên top shortlist**.

Nếu không có requirement đó, tao vẫn chọn runtime headless CMS.

### Các CMS/platform còn lại

**Craft CMS, Drupal, Ghost, Optimizely CMS, Sitecore XM, Statamic, Umbraco, WordPress** đều có use case riêng và một số có headless mode/API, nhưng tao không ưu tiên chúng cho một reusable TypeScript + TanStack + Workers content layer. Mày sẽ kéo thêm một ecosystem/runtime/admin architecture lớn hơn trong khi frontend đã được mày quyết định là React/TanStack.

**Crystallize** mang tính specialized hơn; **Hashnode** nghiêng về publishing platform hơn một general-purpose component CMS.

Ba cái trong list đặc biệt không đáng cân nhắc cho project này vì chúng gắn vào Astro thay vì TanStack:

**StudioCMS** được xây như một Astro-native headless CMS; **Vault CMS** kết hợp Obsidian + Git để publish vào Astro; **Zero** cũng tự định vị là AI-native Git CMS build specifically for Astro và dùng Astro/Zod schemas/components. citeturn17search1turn17search5turn17search2turn18search0

Không có nghĩa là chúng tệ. Chỉ là mày sẽ chọn một CMS vì integration với framework **mày không dùng**.

Tóm lại, sau vòng architecture filtering:

```text
43 CMS
   │
   ├─ framework mismatch / platform mismatch
   ├─ Git workflow không phải requirement
   ├─ enterprise/legacy overhead
   ├─ generic API nhưng UX không nổi trội
   └─ specialized use case
       ↓
Sanity
Payload
Storyblok
TinaCMS
Builder.io
DatoCMS
Prismic
       ↓
Sanity / Payload / Storyblok
```

---

## So sánh shortlist theo đúng stack TanStack + Cloudflare

Đây là scoring mang tính **engineering judgement cho use case của mày**, không phải điểm “CMS nào tốt hơn tuyệt đối”.

| | Sanity | Payload | Storyblok | Tina | Builder.io |
|---|---:|---:|---:|---:|---:|
| React/component fit | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ | ★★★★★ |
| TanStack fit hôm nay | ★★★★★ | ★★★ | ★★★★★ | ★★★★ | ★★★★ |
| Cloudflare friction | ★★★★★ | ★★★★ | ★★★★★ | ★★★★ | ★★★★★ |
| Visual editing | ★★★★★ | ★★★★ | ★★★★★ | ★★★★ | ★★★★★ |
| Component page building | ★★★★★ | ★★★★ | ★★★★★ | ★★★★ | ★★★★★ |
| Schema-as-code/dev DX | ★★★★★ | ★★★★★ | ★★★★ | ★★★★★ | ★★★★ |
| Data/infra ownership | ★★ | ★★★★★ | ★★ | ★★★★★ | ★★ |
| Git as source of truth | ★ | ★ | ★ | ★★★★★ | ★ |
| Adapter/plugin friendliness | ★★★★★ | ★★★★★ | ★★★★ | ★★★★ | ★★★ |
| Ship-fast cho client | ★★★★★ | ★★★ | ★★★★★ | ★★★★ | ★★★★★ |

### Sanity: lựa chọn cân bằng nhất ngay bây giờ

Sanity Studio là một React application. Nó có thể được deploy riêng hoặc embedded vào một existing React app. Content schema được định nghĩa bằng code, trong khi actual content nằm trong Sanity Content Lake. citeturn2view2turn1search12

Kiến trúc rất đẹp cho project của mày:

```text
repo/
├─ apps/
│  ├─ web/                 # TanStack Start
│  └─ studio/              # Sanity Studio
│
└─ packages/
   ├─ ui/
   ├─ cms-core/
   └─ content-schema/
```

Deploy:

```text
app.customer.com    -> TanStack Start / Cloudflare Worker
studio.customer.com -> Sanity Studio
Content             -> Sanity Content Lake
```

Hoặc Studio có thể nằm ở:

```text
app.customer.com/studio
```

nhưng tao thích tách deployment boundary hơn.

Frontend Cloudflare của mày khi đó gần như không quan tâm CMS chạy ở đâu:

```text
TanStack route/server code
        │
        ▼
@sanity/client
        │
        ▼
Sanity Content Lake
```

Sanity hiện có một framework-agnostic Visual Editing architecture: Content Source Maps, stega metadata, overlays, live updates, preview mode và Presentation Tool. Presentation Tool render frontend trong iframe, cho phép user click trên rendered content để nhảy đúng field trong Studio. citeturn19search6turn19search5turn19search9

Quan trọng hơn: từ góc nhìn của TanStack Start, mày **không cần Sanity có một official `@sanity/tanstack-start` package** mới làm được integration. Sanity hiện cung cấp framework-agnostic path, và có guide React Router hiện đại rất gần với architecture của TanStack về mặt React/SSR routing integration. citeturn19search4turn19search2

Sanity còn vừa mở rộng page-building drag/drop: array trong schema có thể chứa `hero`, `features`, `callToAction`..., editor có thể reorder trực tiếp trên preview; operation cập nhật structured content rồi frontend re-render. citeturn19search7

Đây chính xác là model:

```ts
sections: [
  Hero,
  FeatureGrid,
  Testimonials,
  CTA,
]
```

mà tao đề xuất.

Một caveat hiện tại: visual drag-and-drop mới của Sanity yêu cầu `@sanity/visual-editing` đủ mới và **React 19.2+**, nên cần check React version trong Better-T-Stack project của mày trước khi coi drag/drop là baseline capability. citeturn19search7

Về cost hiện tại, Sanity Free có 20 included seats; Growth là **$15/seat/tháng**, tối đa 50 seats trên plan đó. Điều này khá hấp dẫn khi mày đang prototype/productize integration, mặc dù economics cần được tính lại khi số client/project tăng lớn. citeturn19search1

**Điểm yếu:** backend content vẫn là Sanity SaaS. `GROQ`, Portable Text, Sanity document IDs, preview metadata... đều tạo switching cost.

Nhưng đó chính là lý do tao muốn mày có `cms-core` adapter layer.

### Payload: kiến trúc đẹp nhất nếu mày muốn sở hữu platform

Payload đi theo mental model gần với SWE nhất trong cả list:

```ts
export const Pages: CollectionConfig = {
  slug: 'pages',
  fields: [
    // ...
  ],
}
```

Config/code/type system là trung tâm của CMS; data có thể được query bằng Local API, REST hoặc GraphQL. citeturn1search20turn1search13turn12search4

Nó cũng đặc biệt hấp dẫn cho Cloudflare stack vì có:

```text
Cloudflare Worker
D1
R2
```

Payload có official Cloudflare deployment template, D1 adapter `@payloadcms/db-d1-sqlite`, và R2 storage integration. citeturn2view0turn10search1turn1search7

Về lý thuyết đây chính là dream architecture của mày:

```text
Alchemy
│
├─ TanStack Start Worker
│
├─ CMS Worker
│   └─ Payload
│
├─ D1
└─ R2
```

Alchemy bản thân có thể khai báo Worker, D1, R2 và các Cloudflare resources/bindings trong TypeScript, nên infrastructure philosophy của hai bên rất phù hợp nhau. citeturn15search0turn15search15

Nhưng có một vấn đề thời điểm.

**Payload 3 stable vẫn là Next.js-based.** Tài liệu cài đặt hiện tại yêu cầu Next.js và Node runtime requirements. citeturn12search2

Payload team đang giải quyết chính vấn đề này trong Payload 4:

> framework adapter sẽ tách admin rendering, loaders, API mounting và các phần framework-specific khỏi Payload core; TanStack là proof point đầu tiên. citeturn20search0

Official TanStack demo hiện vẫn experimental và sử dụng canary integration, nên tao sẽ không lấy nó làm foundation cho hàng loạt production customer sites vào ngày 14/08/2026. citeturn11search3turn11search1

Điều tao sẽ làm là:

```text
2026 hiện tại

TanStack Worker
        │
        │ HTTP
        ▼
Payload Worker / service
        │
     ┌──┴───┐
     ▼      ▼
     D1     R2
```

Sau này khi Payload 4/TanStack stable:

```text
Evaluate lại:

TanStack Start
└─ Payload framework adapter
   ├─ Admin
   ├─ API
   ├─ D1
   └─ R2
```

Điểm mạnh khác là Payload có Live Preview: frontend được render trong iframe của Admin và preview integration giao tiếp với frontend; docs cũng hỗ trợ framework-agnostic/custom integrations. citeturn3search2turn3search5

**Tao xem Payload là lựa chọn tốt hơn Sanity nếu mày có một trong các requirement sau:**

```text
CMS infrastructure phải thuộc Cloudflare account của mình
data phải nằm trong database của mình
không muốn SaaS CMS dependency
muốn customize backend deeply
muốn CMS trở thành platform/IP của business
muốn bundle CMS + app infra thành một product template
```

Tức là:

**Sanity thắng “ship today”.<br>
Payload thắng “own the platform”.**

### Storyblok: editor UX rất sát với thứ client nghĩ là CMS

Storyblok có một lợi thế cực lớn: mental model của nó gần như map thẳng vào React component library.

Mày định nghĩa:

```text
Hero
Feature
FAQ
CTA
Testimonials
```

Storyblok định nghĩa blocks tương ứng.

Sau đó React SDK mapping:

```text
CMS block type
       │
       ▼
React component
```

Official React integration đăng ký component rồi `StoryblokComponent` dựa vào content type để render component tương ứng. citeturn20search13turn20search8

Bridge kết nối frontend với Visual Editor và cung cấp context/click-edit behavior. citeturn20search4turn20search6

Với client, experience có thể gần:

```text
[ Hero ]
  click heading → edit

[ Feature Grid ]
  click item → edit

[ Testimonials ]
  drag

[ CTA ]
  drag
```

Hơn nữa, schema có whitelist/denylist blocks, và role có thể giới hạn component nào editor được add/manage. Đây là cực kỳ useful khi mày muốn:

> Cho client compose page nhưng không cho họ phá hệ thống. citeturn20search10turn20search14

Storyblok hiện có React SDK chính thức; JS SDK dùng Fetch API nên về integration boundary khá phù hợp với Workers/web-standard runtime. citeturn20search2turn20search6

Điểm yếu lớn nhất cho mô hình “ship rất nhiều client sites” là economics/vendor ownership. Current pricing cho Growth là **$99/tháng**, 5 seats, 1 space; Starter có 1 included seat, giới hạn 100k API requests/tháng và 2 locales. Khi mày triển khai nhiều independent customer spaces, chi phí cần được model cẩn thận. citeturn20search3turn20search7

Nếu client nói:

> “Tao không quan tâm code-first hay self-host gì hết. Nhân viên marketing phải sửa site cực dễ.”

tao có thể chọn **Storyblok trước Sanity**.

### Builder.io: mạnh nhưng abstraction có xu hướng lan vào renderer

Builder.io cho phép mày đăng ký custom React components vào Visual Editor và khai báo editable inputs. Components-only mode còn có thể khóa editor chỉ sử dụng design-system components mà developer cung cấp. citeturn3search0turn3search3turn3search6

Về UX landing page, đây là solution rất mạnh.

Ví dụ:

```ts
Builder.registerComponent(Hero, {
  name: 'Hero',
  inputs: [
    { name: 'heading', type: 'string' },
    { name: 'description', type: 'longText' },
    { name: 'variant', type: 'string', enum: [...] },
  ],
})
```

Nhưng tao đặt nó thấp hơn Sanity/Storyblok trong trường hợp của mày bởi vì goal của mày không chỉ là:

> “Tích hợp visual editor vào một project.”

Goal là:

> “Tạo một reusable CMS layer mình sở hữu và mang sang nhiều product.”

Builder có xu hướng đưa nhiều concept của Builder editor/content model vào component registration/rendering layer hơn. Điều đó không phải vấn đề nếu mày **commit với Builder như platform**, nhưng kém hấp dẫn hơn nếu abstraction/provider portability là mục tiêu.

### TinaCMS: lựa chọn khi Git là feature, không phải accident

Tina có React visual editing và content trong Git workflow; TinaCloud giữ repository làm source of truth. citeturn5search13turn6search11

Tina còn hỗ trợ Cloudflare Workers cho backend/SSR/visual editing route. citeturn6search8

Tao chọn Tina khi architecture requirement là:

```text
Content change
    ↓
Git
    ↓
version history / PR / deploy
```

Tao không chọn Tina nếu:

```text
Client changes phone number
    ↓
should immediately become published content
```

mà mày không muốn build/deploy semantics dính vào flow đó.

---

## Kiến trúc “CMS plugin” tao sẽ build

Đây mới là phần quan trọng nhất.

**Đừng build `sanity.ts` rồi import khắp application.**

Nếu làm vậy thì sau sáu tháng project của mày sẽ thành:

```tsx
import { groq } from 'next-sanity-ish-whatever'

const data = await sanity.fetch(...)
```

rải ở 40 route/components.

Khi muốn dùng Payload hoặc Storyblok, migration sẽ khủng khiếp.

Tao sẽ tạo architecture đại khái như này:

```text
packages/
│
├─ cms-core/
│  ├─ types.ts
│  ├─ schemas.ts
│  ├─ provider.ts
│  ├─ capabilities.ts
│  └─ errors.ts
│
├─ cms-react/
│  ├─ CmsPage.tsx
│  ├─ CmsSection.tsx
│  ├─ CmsLink.tsx
│  ├─ CmsImage.tsx
│  └─ preview/
│
├─ cms-blocks/
│  ├─ hero.ts
│  ├─ feature-grid.ts
│  ├─ testimonials.ts
│  ├─ faq.ts
│  ├─ cta.ts
│  └─ index.ts
│
├─ cms-sanity/
│  ├─ client.ts
│  ├─ mapper.ts
│  ├─ queries.ts
│  ├─ schemas/
│  └─ preview/
│
├─ cms-payload/
│  ├─ client.ts
│  ├─ mapper.ts
│  ├─ collections/
│  └─ preview/
│
├─ cms-storyblok/
│  └─ ...
│
├─ cms-alchemy/
│  └─ ...
│
└─ cms-cli/
   └─ ...
```

### `cms-core` mới là tài sản quan trọng

Provider interface nên nhỏ.

Ví dụ:

```ts
export interface CmsProvider {
  pages: {
    findBySlug(input: {
      slug: string
      locale?: string
      draft?: boolean
    }): Promise<CmsPage | null>
  }

  site: {
    getSettings(input?: {
      locale?: string
      draft?: boolean
    }): Promise<SiteSettings>
  }

  navigation: {
    get(input: {
      key: string
      locale?: string
      draft?: boolean
    }): Promise<Navigation | null>
  }
}
```

**Không nên** viết kiểu:

```ts
interface CmsProvider {
  query(query: string): Promise<any>
}
```

Vì lúc đó abstraction chẳng có ý nghĩa gì.

Cũng đừng leak:

```text
Sanity:
_id
_type
_key
PortableTextBlock

Storyblok:
_uid
component
story

Payload:
collection
depth
relationship objects
```

ra application layer.

Application chỉ nên biết:

```ts
type CmsPage = {
  id: string
  slug: string
  seo: Seo
  sections: CmsSection[]
}
```

Provider adapter chịu trách nhiệm normalize.

### Nhưng cũng đừng over-abstract CMS

Đây là chỗ nhiều SWE dễ over-engineer.

Không thể cleanly normalize mọi feature của Sanity, Payload và Storyblok.

Ví dụ:

```text
Sanity Content Source Maps
Storyblok Bridge
Payload Live Preview
```

là ba cơ chế khác nhau.

Do đó core nên có capabilities:

```ts
interface CmsCapabilities {
  draftMode: boolean
  livePreview: boolean
  clickToEdit: boolean
  sectionReorder: boolean
  webhooks: boolean
  localization: boolean
}
```

Và provider-specific preview adapter:

```ts
interface CmsPreviewAdapter {
  enable(): Promise<void>
  disable(): Promise<void>

  decorate?(
    document: unknown,
    path: string
  ): Record<string, string>
}
```

Tức là:

```text
Normalize business-domain data         YES
Normalize every CMS implementation     NO
```

Đây là design decision quan trọng.

### Component registry

Application cần một registry:

```ts
export const landingPageRegistry = {
  hero: HeroSection,
  featureGrid: FeatureGridSection,
  logoCloud: LogoCloudSection,
  testimonials: TestimonialsSection,
  pricing: PricingSection,
  faq: FAQSection,
  cta: CTASection,
} satisfies CmsComponentRegistry
```

Renderer:

```tsx
export function CmsPageRenderer({
  page,
  registry,
}: {
  page: CmsPage
  registry: CmsComponentRegistry
}) {
  return (
    <>
      {page.sections.map((section) => {
        const Component = registry[section.type]

        if (!Component) {
          return null
        }

        return (
          <Component
            key={section.id}
            section={section}
          />
        )
      })}
    </>
  )
}
```

Tuyệt đối không để CMS gửi:

```json
{
  "component": "../../components/Foo.tsx"
}
```

hoặc:

```json
{
  "component": "eval(...)"
}
```

CMS gửi **semantic component IDs**, application quyết định implementation.

### Canonical schema

Ví dụ:

```ts
export type CmsSection =
  | {
      id: string
      type: 'hero'
      variant: 'centered' | 'split'
      heading: string
      description?: string
      image?: CmsImage
      primaryAction?: CmsAction
      secondaryAction?: CmsAction
    }
  | {
      id: string
      type: 'featureGrid'
      heading?: string
      description?: string
      columns: 2 | 3 | 4
      items: FeatureItem[]
    }
  | {
      id: string
      type: 'faq'
      heading?: string
      items: FAQItem[]
    }
  | {
      id: string
      type: 'cta'
      variant: 'default' | 'banner'
      heading: string
      description?: string
      action: CmsAction
    }
```

Sanity schema:

```text
CMS canonical model
      ↓
Sanity schema definitions
```

Payload:

```text
CMS canonical model
      ↓
Payload blocks/collections
```

Storyblok:

```text
CMS canonical model
      ↓
Storyblok components
```

Đây mới là thứ khiến mày có thể ship site mới nhanh.

### Đừng quên global content

Landing page chỉ là phần đầu.

Core nên có:

```text
Page
SiteSettings
Navigation
Footer
SEO
Redirect
Asset
ReusableContent
```

Ví dụ:

```ts
type SiteSettings = {
  siteName: string
  logo: CmsImage
  contactEmail?: string
  socialLinks: SocialLink[]
  defaultSeo: Seo
}
```

Và navigation:

```ts
type Navigation = {
  items: NavigationItem[]
}
```

Sau này thêm:

```text
BlogPost
Author
Category
LegalPage
Product
CaseStudy
```

mà không làm hỏng primitive ban đầu.

---

## Luồng runtime, preview và deployment trên Cloudflare

### Published request

Một request bình thường nên đơn giản:

```text
Browser
   │
   ▼
Cloudflare
   │
   ▼
TanStack Start Worker
   │
   ├─ route / loader / server function
   │
   ▼
cms.pages.findBySlug()
   │
   ▼
CMS Provider
   │
   ├─ Sanity
   ├─ Storyblok
   └─ Payload
```

TanStack Start hỗ trợ server-side rendering và typed server work; deployment trực tiếp lên Workers đã có đường chính thức. citeturn15search2turn15search13

Ở v1 tao **không cache quá thông minh**.

SaaS CMS như Sanity/Storyblok đã có delivery infrastructure riêng. Hãy ship correctness trước.

Khi traffic đáng kể mới thêm:

```text
CMS
 ↓
Cloudflare cache
 ↓
Worker
```

hoặc event-driven invalidation.

TanStack Start cũng đang có ISR support cho việc serve cached static content rồi regenerate theo thời gian, nên đây có thể trở thành optimization sau này thay vì requirement của CMS core. citeturn15search25

### Preview request

Preview phải là một path khác về semantics:

```text
Production:
visitor
  ↓
published content


Preview:
authenticated editor
  ↓
preview session
  ↓
draft content
  ↓
no normal public cache
```

Đừng viết:

```ts
?draft=true
```

rồi cho bất kỳ ai access unpublished content.

Nên có:

```text
CMS Studio
    │
    │ signed preview request
    ▼
/api/cms/preview/enable
    │
    ├─ verify secret
    ├─ set secure preview session
    └─ redirect to page
```

Sau đó provider biết:

```ts
context.preview === true
```

thì query draft perspective/content.

Sanity Presentation Tool chính thức dùng cùng loại architecture: Studio load frontend trong iframe, gọi preview/draft activation endpoint và sau đó live-preview integration kết nối frontend với editor. citeturn19search3turn19search5

Sanity có framework-agnostic core loader hỗ trợ SSR initial data rồi live updates, nên mày hoàn toàn có thể implement TanStack adapter thay vì chờ một package riêng. citeturn19search8

### Publish

Ideal lifecycle:

```text
Editor
  │
  ▼
Publish
  │
  ├── CMS updates published dataset
  │
  └── webhook
        │
        ▼
      /api/cms/revalidate
        │
        ├─ verify webhook signature
        └─ invalidate affected page
```

Ban đầu:

```text
publish
→ API content immediately changes
```

là đủ.

Đừng build distributed cache invalidation engine trước khi có traffic cần nó.

### Media

Tao cũng không normalize media storage quá sâu.

Canonical type:

```ts
type CmsImage = {
  id: string
  src: string
  alt: string
  width?: number
  height?: number
  hotspot?: {
    x: number
    y: number
  }
}
```

Sanity/Storyblok:

```text
CMS asset pipeline
      ↓
normalized CmsImage
```

Payload:

```text
Payload Media collection
      ↓
R2
      ↓
normalized CmsImage
```

Payload có native R2 integration dành cho Cloudflare environments, vì vậy đây là một strong point nếu mày muốn customer media nằm trong infrastructure của mình. citeturn1search7

### Alchemy

Ở project hiện tại:

```ts
// conceptual only

const app = TanStackStart(...)
```

Sau này nếu dùng Payload self-hosted:

```ts
const cmsDatabase = D1(...)
const cmsAssets = R2(...)
const cmsWorker = Worker(...)
const appWorker = TanStackStart(...)
```

Alchemy phù hợp với model này vì resource graph Cloudflare của nó bao gồm Worker + database/object storage/queues và các bindings giữa chúng, tất cả declarative từ TypeScript. citeturn15search0turn15search3

Tuy nhiên tao **không viết một Alchemy abstraction cho Payload ngay trong iteration đầu**.

Trước hết validate:

```text
Payload official Cloudflare deployment
        +
D1
        +
R2
        +
your content model
```

sau đó mới đóng gói thành IaC module.

Đừng đồng thời debug:

```text
Payload
TanStack
Cloudflare
Alchemy
CMS abstraction
preview
D1
R2
```

trong proof-of-concept đầu tiên.

### Testing

Vì Cloudflare Workers có Node compatibility rộng nhưng không hoàn toàn giống một Node server, CMS/provider code phải được test trong Workers-compatible runtime chứ không chỉ chạy thành công bằng Node/Bun trên máy local. Cloudflare có tài liệu riêng về Node API compatibility và worker-aware testing tooling cho việc bắt unsupported APIs/bindings. citeturn0search3turn0search31

Đặc biệt project của mày còn đang đứng trên TanStack Start RC, nên package versions nên được pin thay vì:

```json
"@tanstack/react-start": "latest"
```

cho các production templates. TanStack hiện vẫn công khai đánh dấu Start là RC. citeturn15search13

---

## Cách tao sẽ productize thành reusable package

Target experience lý tưởng không phải:

> “Clone project cũ rồi copy 28 file.”

Nó nên gần:

```bash
bunx @yourorg/cms init
```

CLI hỏi:

```text
CMS provider?
> Sanity
  Payload
  Storyblok

Features?
[x] Landing pages
[x] SEO
[x] Global navigation
[x] Visual preview
[x] Media
[ ] Blog
[ ] Localization
```

Rồi generate:

```text
src/
├─ cms/
│  ├─ config.ts
│  ├─ registry.ts
│  └─ blocks.ts
│
├─ components/
│  └─ cms/
│
└─ routes/
   └─ api/
      └─ cms/
         ├─ preview-enable.ts
         ├─ preview-disable.ts
         └─ webhook.ts
```

Nếu Sanity:

```text
studio/
├─ sanity.config.ts
└─ schemaTypes/
   ├─ page.ts
   ├─ siteSettings.ts
   └─ sections/
```

Nếu Payload:

```text
cms/
├─ payload.config.ts
├─ collections/
├─ blocks/
└─ migrations/
```

Payload có first-party migration system bằng TypeScript, nên schema deployment cũng có thể trở thành một phần installation/deploy workflow của adapter. citeturn20search1

### API public của package nên cực nhỏ

Ví dụ application:

```ts
import { cms } from '@/cms'

const page = await cms.pages.findBySlug({
  slug: '/',
})
```

Render:

```tsx
<CmsPage page={page} />
```

Preview infrastructure:

```tsx
<CmsPreview>
  <CmsPage page={page} />
</CmsPreview>
```

Đổi provider:

```ts
export const cms = createCms({
  provider: sanityProvider({
    projectId: env.SANITY_PROJECT_ID,
    dataset: env.SANITY_DATASET,
  }),
})
```

sang:

```ts
export const cms = createCms({
  provider: payloadProvider({
    endpoint: env.PAYLOAD_API_URL,
  }),
})
```

UI component không đổi.

### Config component registry theo product

Mỗi vertical/template có registry riêng:

```text
@yourorg/cms-core
@yourorg/cms-react

@yourorg/template-saas
├─ Hero
├─ Features
├─ Pricing
├─ Testimonials
├─ FAQ
└─ CTA

@yourorg/template-agency
├─ Hero
├─ Services
├─ Portfolio
├─ Process
├─ Team
└─ Contact

@yourorg/template-product
├─ Hero
├─ Benefits
├─ Screenshots
├─ Integrations
├─ Pricing
└─ FAQ
```

Đây mới là nơi leverage bắt đầu tăng mạnh.

Một customer website mới không còn là:

```text
build landing
build CMS integration
build schemas
build preview
build admin model
build SEO
...
```

mà trở thành:

```text
create project
   ↓
select template
   ↓
install CMS adapter
   ↓
provision CMS project
   ↓
seed Page + SiteSettings
   ↓
client edits content
```

### Schema nên thuộc codebase của mày, không thuộc client

Client sửa **instance data**:

```text
"Build faster with..."
"Contact us"
image
FAQ answer
section order
```

Mày sửa **schema/design capabilities**:

```text
Hero supports video
FeatureGrid gets variant C
new Pricing component
CTA gains background image
```

Đó là cách SaaS/product engineering nên nhìn CMS.

Sanity rất hợp model này vì schema được code-defined trong Studio; Payload còn mạnh hơn về code-first config; Storyblok có component schema nhưng schema administration có phần gắn nhiều hơn vào Storyblok space/model. citeturn1search12turn1search20turn20search10

### Versioning content contract

Ngay từ đầu nên có version:

```ts
type HeroSectionV1 = {
  type: 'hero'
  version: 1
  // ...
}
```

hoặc ít nhất support migrations trong mapper.

Ví dụ sau này:

```text
v1
heading: string

v2
heading:
  prefix
  highlighted
  suffix
```

Adapter có thể normalize:

```ts
function normalizeHero(
  input: SanityHeroV1 | SanityHeroV2
): HeroSection {
  // ...
}
```

Không làm vậy thì reusable CMS platform sau vài chục site sẽ gặp vấn đề:

> “Component code mới nhưng customer content vẫn schema cũ.”

Đó mới là loại complexity đáng để mày tự build tooling.

---

## Quyết định cuối cùng cho trường hợp của mày

Nếu bỏ hết marketing của các CMS ra và chỉ nhìn engineering constraints của mày:

```text
Frontend:
React
TanStack Start

Runtime:
Cloudflare Workers

Infra:
Alchemy

Developer:
Full-stack SWE
muốn schema/code/types
không muốn CMS chi phối frontend

User:
non-technical
cần sửa landing page

Business:
muốn reusable module
ship nhiều product/customer nhanh
```

thì tao sẽ đưa ra quyết định như sau.

### Default architecture tao chọn

```text
                     ┌──────────────────────────┐
                     │      Sanity Studio       │
                     │                          │
                     │ Forms                    │
                     │ Live preview             │
                     │ Click to edit            │
                     │ Drag/reorder sections    │
                     └────────────┬─────────────┘
                                  │
                                  │ content
                                  ▼
                     ┌──────────────────────────┐
                     │   Sanity Content Lake    │
                     └────────────┬─────────────┘
                                  │
                              API / CDN
                                  │
                                  ▼
┌───────────────────────────────────────────────────────────┐
│                Cloudflare / TanStack Start                │
│                                                           │
│ route                                                     │
│   ↓                                                       │
│ @yourorg/cms-core                                         │
│   ↓                                                       │
│ @yourorg/cms-sanity                                       │
│   ↓                                                       │
│ normalized Page                                           │
│   ↓                                                       │
│ CmsPageRenderer                                           │
│   ↓                                                       │
│ React component registry                                  │
│                                                           │
│ Hero / Features / Testimonials / Pricing / FAQ / CTA      │
└───────────────────────────────────────────────────────────┘
```

Sanity hiện cho visual editor live preview, click-to-edit và drag/drop page sections trên modern frontend stacks; integration core không bắt buộc framework-specific adapter, khiến nó đặc biệt thích hợp để mày tự viết TanStack integration mà không phải thay framework hoặc runtime. citeturn19search10turn19search7turn19search8

### Repo tao sẽ bắt đầu

```text
apps/
├─ web/
│  └─ TanStack Start
│
└─ studio/
   └─ Sanity Studio

packages/
├─ ui/
├─ cms-core/
├─ cms-react/
├─ cms-blocks/
├─ cms-sanity/
└─ cms-cli/
```

V1 chỉ implement khoảng:

```text
Page
SiteSettings
Navigation
SEO

Hero
FeatureGrid
LogoCloud
Stats
Testimonials
Pricing
FAQ
CTA
RichText
```

Đừng làm 40 blocks ngay.

### Quyền cho editor

Editor được:

```text
✓ sửa text
✓ đổi image
✓ sửa URL
✓ add/remove/reorder approved sections
✓ chọn variant predefined
✓ sửa SEO
✓ preview
✓ publish
```

Editor không được:

```text
✗ arbitrary HTML
✗ arbitrary CSS
✗ Tailwind classes
✗ JS
✗ React component names
✗ system schema
✗ CMS secrets
```

Sanity drag/drop hoạt động tốt với array-based structured sections; Storyblok cũng cho phép whitelist block types và giới hạn block operations theo role, nên cả hai đều support triết lý “bounded composition” này. citeturn19search7turn20search10turn20search14

### Khi nào tao đổi recommendation sang Storyblok

Chọn **Storyblok** thay Sanity khi tiêu chí quan trọng nhất là:

> “Marketing/client phải cảm thấy đang trực tiếp chỉnh website, và page composition UX phải ngon ngay từ đầu.”

Component/block mapping của Storyblok rất tự nhiên với React và Visual Editor/Bridge được xây cho workflow này. citeturn20search13turn20search4

Tradeoff là mày chấp nhận SaaS dependency sâu hơn và phải quan tâm economics của space/seats khi scale sang nhiều khách hàng; current Growth tier là $99/tháng cho một space với năm seats. citeturn20search3

### Khi nào tao đổi recommendation sang Payload

Chọn **Payload** thay Sanity khi requirement là:

> “Tao muốn toàn bộ CMS, database và assets nằm trong infrastructure do tao/customer kiểm soát.”

Lúc đó Cloudflare Worker + D1 + R2 là một architecture rất hấp dẫn vì Payload có upstream support cho cả ba thành phần. citeturn2view0turn10search1turn1search7

Nhưng **hôm nay**, production architecture nên tách CMS service khỏi TanStack frontend. Payload 4 đang đi đúng hướng với framework adapter + TanStack, nhưng official implementation vẫn chưa phải baseline stable để mày đóng gói thành universal plugin cho customer production workloads. citeturn20search0turn11search3

Vì vậy roadmap tự nhiên là:

```text
                 NOW
                  │
                  ▼
        Sanity provider adapter
                  │
                  ▼
          CMS core stabilizes
                  │
                  ▼
      5–10 real customer sites
                  │
                  ▼
Learn what abstraction is actually common
                  │
                  ▼
      Payload 4 maturity check
                  │
             ┌────┴─────┐
             │          │
           stable     not yet
             │          │
             ▼          ▼
      Payload adapter  Keep separate
      + Alchemy        Payload service
             │
             ▼
      self-hosted CMS option
```

Đây tốt hơn rất nhiều so với việc build `CmsProvider` cho mười CMS trước khi mày có một customer production site.

### Ranking cuối cùng

| Rank theo bài toán của mày | CMS | Nhận định |
|---|---|---|
| **Top choice hiện tại** | **Sanity** | Cân bằng tốt nhất giữa SWE DX, visual editing, React và zero Cloudflare backend friction |
| **Top strategic choice** | **Payload CMS** | Tốt nhất nếu sau này CMS trở thành infrastructure/product IP của mày |
| **Top editor UX** | **Storyblok** | Rất hợp component-driven landing page và marketer editing |
| **Top Git-based** | **TinaCMS** | Chọn khi Git source-of-truth là requirement có chủ đích |
| **Top free-form builder** | **Builder.io** | Chọn khi Webflow-like visual authoring quan trọng hơn provider abstraction |
| **Alternatives** | **DatoCMS / Prismic** | Đều solid nhưng không có decisive advantage cho stack này |
| **Data-centric alternative** | **Directus** | Chọn khi “CMS” bắt đầu trở thành relational application backend |

Và quan trọng nhất, **thứ mày nên build không phải là một CMS**.

Nó là:

```text
              Your reusable product layer
                         │
            ┌────────────┴────────────┐
            │                         │
      Content contract         React design system
            │                         │
            ├────────────┬────────────┤
            │            │            │
          Sanity       Payload    Storyblok
          adapter      adapter     adapter
```

Ở architecture này, **Hero vẫn là component của mày, design vẫn là của mày, TanStack Start vẫn là app của mày, Cloudflare vẫn là runtime của mày**. CMS chỉ là nơi editor quản lý structured content và composition.

Sanity là provider tao sẽ ship trước. Payload là provider tao sẽ theo dõi và đưa vào sau khi TanStack adapter của Payload 4 đạt production maturity. Storyblok là option tao sẽ bật cho những project mà client-facing visual authoring quan trọng hơn infrastructure ownership. Hướng này tận dụng đúng thế mạnh hiện tại của TanStack Start/Workers/Alchemy mà không để CMS choice trở thành architectural lock-in của toàn bộ product stack. citeturn15search2turn15search0turn19search10turn20search0
