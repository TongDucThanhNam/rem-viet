# Rèm Vina — Facebook launch pack

Open **`index.html`** to view every post, play both videos, download files, and copy the Vietnamese captions. The gallery works locally without an account or an internet connection; outbound Facebook/Shopee links need internet access.

The campaign leads with **made-to-measure mosquito mesh**, as requested. Its line is **“Vừa khung cửa. Hợp nếp nhà.”** The visual direction uses the supplied cream interior reference, navy and restrained warm gold, Playfair Display headings, and Montserrat text.

## Included

| Item | Files | Format |
|---|---|---|
| Current light avatar | `images/00-avatar-light.png` | 2048 × 2048 PNG |
| Facebook cover | `images/00-facebook-cover-1640x624.jpg` | 1640 × 624 JPG |
| Six feed posts | `images/01-*` through `images/06-*` | 1080 × 1350 JPG, plus PNG masters in the working folder |
| Two finished Reels | `videos/01-breeze-reel-1080x1920.mp4`, `videos/02-mesh-reel-1080x1920.mp4` | 1080 × 1920, 30 fps, H.264, 11 seconds each |
| Two Reel covers | `images/reel-cover-*` | 1080 × 1920 JPG |
| Subtitle text | The two `.srt` files beside the videos | Vietnamese UTF-8 |
| Captions | `copy/facebook-captions-vi.md` and eight individual `caption-*.txt` files | Six posts and two Reels, plus Story ideas |
| Publishing sequence | `copy/14-day-launch-calendar-vi.md` | A relative 14-day calendar and a results table |
| Page identity and replies | `copy/page-identity-and-replies-vi.md` | Suggested name, bio, and customer replies |

The videos already have Vietnamese titles burned in. They are **silent exports**. The `.srt` files are editable text references; adding them again as visible subtitles can duplicate the text. Use each matching Reel cover when uploading. If adding audio, select a track permitted for the business account in the publishing tool.

## Start posting

1. The Rèm Vina avatar and cover are already applied. Review the suggested display name and bio in the identity file when ready.
2. The introduction post and mesh Reel are already published; see `publication-record.json` to avoid duplicates. The introduction can be pinned separately.
3. Follow the calendar. Each post has one main next step: send a window photo, record measurements, or ask about the appropriate model.
4. Use the sizing guide to start a conversation. The diagram is a general illustration; the shop should confirm measurement positions for the selected installation type.

## Generation and editing

All three new photographic stills were generated through **Cici Studio / Cici / Seedream 5.0 Pro**. Both new moving clips were generated through **Cici Studio / Flow / Omni 1.1 Flash** after the Cici and Doubao video paths failed to return usable footage. This provider change stays inside the requested Cici Studio workflow.

Both generated video sources are 720 × 1280, 24 fps, eight seconds. The final edits upscale them to 1080 × 1920, convert to 30 fps, add exact Vietnamese typography, and append a three-second brand/contact card. Upscaling does not create native 1080p detail. Existing provider markings in the generated footage are retained.

The logo icon was extracted from the primary mark in the user's `images/logo.png`. The icon shape was retained, recolored to navy/cream, and paired with typeset brand lettering for legible exports. This is a practical social lockup, not a new vector logo master. The light avatar variant was adapted from the dark avatar through Cici Studio / Seedream 5.0 Pro on 2026-09-15.

Typography, the measurement diagram, image layouts, and video assembly were rendered locally. The working `source/` folder preserves prompts, raw generated media, rebuild scripts, and validation results. Moving-photo alternatives prepared during video recovery are retained there but are **not** used in the final Reels.

## Product information and sources

- User-supplied Facebook screenshots: existing Mart24vn identity, curtains and mosquito mesh, and made-to-order wording. These are historical page snapshots, not a live verification of all business details.
- The provided Shopee product screenshot and visible storefront at [Shopee Rèm Vina](https://shopee.vn/remvina.vn) were inspected on 2026-09-14. They show flexible window mesh, black/white edging, made-to-measure products, and multiple product/material variants.
- Brand reference: `images/logo.png` in the repository.
- Art direction: `images/ChatGPT Image 22_06_52 2 thg 7, 2026.png` in the repository.
- Existing Facebook URL: [Mart24vn](https://www.facebook.com/mart24vn/). The tab mention referred to an earlier browser session; the Facebook audit used the user's supplied screenshots.

The copy intentionally uses the visible made-to-measure offering without inventing current prices, discounts, delivery promises, warranties, certifications, installation services, or measured protection percentages. The AI imagery is labeled as illustration and should not be presented as customer installation photography or evidence of product performance. Actual materials, edging, accessories, and fit depend on the chosen listing.

At the owner's request, the introductory image post and mosquito-mesh Reel were published publicly to Mart24vn on 2026-09-14, with Vietnamese captions, Shopee links, and Facebook AI labels. Both were verified live. The Rèm Vina avatar and cover were subsequently applied and verified in the page header. On 2026-09-15, the avatar was changed to the light cream/navy variant at the owner’s request. See `publication-record.json` for direct URLs and the exact assets used. The other feed posts and breeze Reel remain local and unscheduled. The display name remains Mart24vn.

## Rebuild in this workspace

From the repository root:

```powershell
node social/facebook-launch-2026-09-14/source/build-pack.mjs
python social/facebook-launch-2026-09-14/source/render-videos.py
node social/facebook-launch-2026-09-14/source/build-video-previews.mjs
node social/facebook-launch-2026-09-14/source/build-gallery.mjs
```

The renderers use the existing local `sharp`, fonts, Python, OpenCV, and `imageio_ffmpeg` installation. They do not modify the web application. The ready-to-post ZIP includes the gallery, final upload files, captions, calendar, and source attribution; it excludes temporary provider job records and working files.
