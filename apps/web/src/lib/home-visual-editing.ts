import type { HomeBlock } from "@rem-viet/cms";

export type HomeVisualFieldTarget = {
  controlId: string;
  label: string;
  path: string;
  selector: string;
};

const target = (
  path: string,
  controlId: string,
  label: string,
  selector: string,
): HomeVisualFieldTarget => ({ controlId, label, path, selector });

export function getHomeVisualFieldTargets(
  block: HomeBlock,
): HomeVisualFieldTarget[] {
  switch (block.type) {
    case "hero":
      return [
        target("kicker", "hero-kicker", "Nhãn nhỏ", ".hero-new-kicker"),
        target(
          "title.prefix",
          "hero-title-prefix",
          "Tiêu đề chính",
          ".hero-title-word:first-child",
        ),
        target(
          "title.accent",
          "hero-title-accent",
          "Chữ nhấn italic",
          ".hero-title-word.text-brand",
        ),
        target(
          "description",
          "hero-description",
          "Mô tả",
          ".hero-new-content > p:nth-of-type(2)",
        ),
        target(
          "background.src",
          "hero-background-src",
          "Ảnh nền Hero",
          ".hero-new-bg",
        ),
        target(
          "primaryCta.href",
          "hero-primary-href",
          "Đường dẫn nút chính",
          ".hero-new-actions a:nth-child(1)",
        ),
        target(
          "primaryCta.cursorLabel",
          "hero-primary-cursor",
          "Con trỏ nút chính",
          ".hero-new-actions a:nth-child(1) svg",
        ),
        target(
          "primaryCta.label",
          "hero-primary-label",
          "Nút chính",
          ".hero-new-actions a:nth-child(1) span:last-child",
        ),
        target(
          "secondaryCta.href",
          "hero-secondary-href",
          "Đường dẫn nút phụ",
          ".hero-new-actions a:nth-child(2)",
        ),
        target(
          "secondaryCta.cursorLabel",
          "hero-secondary-cursor",
          "Con trỏ nút phụ",
          ".hero-new-actions a:nth-child(2) svg",
        ),
        target(
          "secondaryCta.label",
          "hero-secondary-label",
          "Nút phụ",
          ".hero-new-actions a:nth-child(2) span:last-child",
        ),
        ...block.features.flatMap((feature, index) => [
          target(
            `features.${feature.id}.label`,
            `hero-feature-${feature.id}-label`,
            `Đặc điểm ${index + 1}`,
            `.hero-feature:nth-child(${index + 1}) span`,
          ),
          target(
            `features.${feature.id}.value`,
            `hero-feature-${feature.id}-value`,
            `Nội dung đặc điểm ${index + 1}`,
            `.hero-feature:nth-child(${index + 1}) strong`,
          ),
        ]),
        target(
          "scrollLabel",
          "hero-scroll-label",
          "Nhãn cuộn",
          ".hero-scroll-cue > span:first-child",
        ),
      ];
    case "threatNarrative":
      return [
        target(
          "scrollLabel",
          "threat-scroll",
          "Nhãn cuộn",
          ".threat-motion > p:last-child",
        ),
        ...block.steps.flatMap((step, index) => [
          target(
            `steps.${step.id}.image.src`,
            `threat-${step.id}-src`,
            `Ảnh chương ${index + 1}`,
            `.threat-backdrop-item:nth-child(${index + 1}), .threat-static-card:nth-child(${index + 1})`,
          ),
          target(
            `steps.${step.id}.eyebrow`,
            `threat-${step.id}-eyebrow`,
            `Nhãn chương ${index + 1}`,
            `.threat-step:nth-child(${index + 1}) .threat-step-copy > p:first-child, .threat-static-card:nth-child(${index + 1}) div > p:first-child, .threat-progress-item:nth-child(${index + 1}) > span:nth-child(2)`,
          ),
          target(
            `steps.${step.id}.title`,
            `threat-${step.id}-title`,
            `Tiêu đề bước ${index + 1}`,
            `.threat-step:nth-child(${index + 1}) h2, .threat-static-card:nth-child(${index + 1}) h2`,
          ),
          target(
            `steps.${step.id}.description`,
            `threat-${step.id}-description`,
            `Mô tả bước ${index + 1}`,
            `.threat-step:nth-child(${index + 1}) .threat-step-copy > p:last-child, .threat-static-card:nth-child(${index + 1}) div > p:last-child`,
          ),
        ]),
      ];
    case "marquee":
      return [
        target(
          "ariaLabel",
          "marquee-aria",
          "Mô tả accessibility",
          ".marquee-inner",
        ),
        target(
          "text",
          "marquee-text",
          "Nội dung marquee",
          ".marquee-inner > span:first-child",
        ),
      ];
    case "benefits":
      return [
        target("eyebrow", "benefits-eyebrow", "Nhãn nhỏ", ".benefits-eyebrow"),
        target("title", "benefits-title", "Tiêu đề", ".benefits-header h2"),
        target("intro", "benefits-intro", "Giới thiệu", ".benefits-intro"),
        target(
          "cardKicker",
          "benefits-kicker",
          "Nhãn trên thẻ",
          ".benefit-card-kicker",
        ),
        target(
          "cursorLabel",
          "benefits-cursor",
          "Nhãn con trỏ",
          ".benefit-card",
        ),
        ...block.items.flatMap((item, index) => [
          target(
            `items.${item.id}.image.src`,
            `benefit-${item.id}-src`,
            `Ảnh lợi ích ${index + 1}`,
            `.benefit-card:nth-child(${index + 1}) .benefit-card-media`,
          ),
          target(
            `items.${item.id}.iconKey`,
            `benefit-${item.id}-icon`,
            `Icon lợi ích ${index + 1}`,
            `.benefit-card:nth-child(${index + 1}) .benefit-card-icon`,
          ),
          target(
            `items.${item.id}.title`,
            `benefit-${item.id}-title`,
            `Tiêu đề lợi ích ${index + 1}`,
            `.benefit-card:nth-child(${index + 1}) h3`,
          ),
          target(
            `items.${item.id}.description`,
            `benefit-${item.id}-description`,
            `Mô tả lợi ích ${index + 1}`,
            `.benefit-card:nth-child(${index + 1}) .benefit-card-description`,
          ),
        ]),
      ];
    case "craftProcess":
      return [
        target(
          "eyebrow",
          "craft-eyebrow",
          "Nhãn nhỏ",
          ".process-intro > p:first-child",
        ),
        target("title", "craft-title", "Tiêu đề", ".process-intro h2"),
        target("intro", "craft-intro", "Giới thiệu", ".process-intro h2 + p"),
        ...block.steps.flatMap((step, index) => [
          target(
            `steps.${step.id}.image.src`,
            `craft-${step.id}-src`,
            `Ảnh bước ${index + 1}`,
            `.process-step:nth-child(${index + 1}) .process-mobile-media, .process-panel:nth-child(${index + 1})`,
          ),
          target(
            `steps.${step.id}.eyebrow`,
            `craft-${step.id}-eyebrow`,
            `Nhãn bước ${index + 1}`,
            `.process-step:nth-child(${index + 1}) > div:first-child > span:nth-child(2), .process-panel:nth-child(${index + 1}) figcaption > span:last-child`,
          ),
          target(
            `steps.${step.id}.title`,
            `craft-${step.id}-title`,
            `Tiêu đề bước ${index + 1}`,
            `.process-step:nth-child(${index + 1}) h3`,
          ),
          target(
            `steps.${step.id}.description`,
            `craft-${step.id}-description`,
            `Mô tả bước ${index + 1}`,
            `.process-step:nth-child(${index + 1}) h3 + p`,
          ),
        ]),
      ];
    case "bentoDetails":
      return [
        target(
          "eyebrow",
          "bento-eyebrow",
          "Nhãn nhỏ",
          ".bento-details .section-eyebrow",
        ),
        target("title", "bento-title", "Tiêu đề", ".bento-details h2"),
        target(
          "material.image.src",
          "bento-material-src",
          "Ảnh vật liệu",
          ".bento-large .bento-bg",
        ),
        target(
          "material.title",
          "bento-material-title",
          "Tiêu đề vật liệu",
          ".bento-large h3",
        ),
        target(
          "material.description",
          "bento-material-description",
          "Mô tả vật liệu",
          ".bento-large p",
        ),
        ...block.stats.flatMap((stat, index) => [
          target(
            `stats.${stat.id}.${stat.value === null ? "fallback" : "value"}`,
            `bento-stat-${stat.id}-${stat.value === null ? "fallback" : "value"}`,
            `Giá trị thông số ${index + 1}`,
            `.bento-stat:nth-child(${index + 2}) .stat-num`,
          ),
          target(
            `stats.${stat.id}.label`,
            `bento-stat-${stat.id}-label`,
            `Nhãn thông số ${index + 1}`,
            `.bento-stat:nth-child(${index + 2}) .stat-lbl`,
          ),
        ]),
        ...block.features.flatMap((feature, index) => [
          target(
            `features.${feature.id}.title`,
            `bento-feature-${feature.id}-title`,
            `Tiêu đề tính năng ${index + 1}`,
            `.bento-small:nth-child(${index + 6}) h3`,
          ),
          target(
            `features.${feature.id}.description`,
            `bento-feature-${feature.id}-description`,
            `Mô tả tính năng ${index + 1}`,
            `.bento-small:nth-child(${index + 6}) p`,
          ),
        ]),
        target(
          "standards.title",
          "bento-standard-title",
          "Tiêu đề tiêu chuẩn",
          ".bento-wide h3",
        ),
        target(
          "standards.description",
          "bento-standard-description",
          "Mô tả tiêu chuẩn",
          ".bento-wide p",
        ),
        target(
          "standards.image.src",
          "bento-standard-src",
          "Ảnh tiêu chuẩn",
          ".bento-wide .bento-bg",
        ),
      ];
    case "horizontalGallery":
      return [
        target("eyebrow", "gallery-eyebrow", "Nhãn nhỏ", ".section-eyebrow"),
        target(
          "cursorLabel",
          "gallery-cursor",
          "Nhãn con trỏ",
          ".gallery-item",
        ),
        ...block.titleLines.map((_, index) =>
          target(
            `titleLines.${index}`,
            `gallery-title-line-${index}`,
            `Dòng tiêu đề ${index + 1}`,
            `.gallery-title-line:nth-of-type(${index + 1})`,
          ),
        ),
        ...block.items.flatMap((item, index) => [
          target(
            `items.${item.id}.image.src`,
            `gallery-${item.id}-src`,
            `Ảnh slide ${index + 1}`,
            `.gallery-item:nth-of-type(${index + 1}) > img`,
          ),
          target(
            `items.${item.id}.title`,
            `gallery-${item.id}-title`,
            `Tiêu đề ảnh ${index + 1}`,
            `.gallery-item:nth-of-type(${index + 1}) strong`,
          ),
          target(
            `items.${item.id}.meta`,
            `gallery-${item.id}-meta`,
            `Nhãn ảnh ${index + 1}`,
            `.gallery-item:nth-of-type(${index + 1}) figcaption > span`,
          ),
        ]),
      ];
    case "measurementGuide":
      return [
        target(
          "eyebrow",
          "measure-eyebrow",
          "Nhãn nhỏ",
          ".measure-heading .section-eyebrow",
        ),
        target("title", "measure-title", "Tiêu đề", ".measure-heading h2"),
        target("intro", "measure-intro", "Giới thiệu", ".measure-intro"),
        target(
          "image.src",
          "measure-main-src",
          "Ảnh minh họa",
          ".measure-media-shell",
        ),
        target(
          "figureEyebrow",
          "measure-figure-eyebrow",
          "Nhãn trên ảnh",
          ".measure-figure-eyebrow",
        ),
        target(
          "contentEyebrow",
          "measure-content-eyebrow",
          "Nhãn nội dung",
          ".measure-step-label",
        ),
        target(
          "contentTitle",
          "measure-content-title",
          "Tiêu đề hướng dẫn",
          ".measure-content > h3",
        ),
        target(
          "contentDescription",
          "measure-content-description",
          "Mô tả hướng dẫn",
          ".measure-content > h3 + p",
        ),
        ...block.steps.flatMap((step, index) => [
          target(
            `steps.${step.id}.code`,
            `measure-${step.id}-code`,
            `Mã bước ${index + 1}`,
            `.acc-item:nth-child(${index + 1}) .acc-head > span:first-child`,
          ),
          target(
            `steps.${step.id}.overlayLabel`,
            `measure-${step.id}-overlay`,
            `Nhãn overlay ${index + 1}`,
            `.measure-overlay:nth-of-type(${index + 1}) .measure-overlay-label`,
          ),
          target(
            `steps.${step.id}.title`,
            `measure-${step.id}-title`,
            `Tiêu đề bước ${index + 1}`,
            `.acc-item:nth-child(${index + 1}) .acc-head > span:nth-child(2)`,
          ),
          target(
            `steps.${step.id}.description`,
            `measure-${step.id}-description`,
            `Mô tả bước ${index + 1}`,
            `.acc-item:nth-child(${index + 1}) .acc-body p`,
          ),
        ]),
      ];
    case "faq":
      return [
        target("eyebrow", "faq-eyebrow", "Nhãn nhỏ", ".faq-eyebrow"),
        target(
          "backdropLabel",
          "faq-backdrop",
          "Chữ nền",
          ".faq-backdrop-label",
        ),
        target("title", "faq-title", "Tiêu đề", ".faq-aside h2"),
        target("intro", "faq-intro", "Giới thiệu", ".faq-intro"),
        target("cta.href", "faq-cta-href", "Đường dẫn nút tư vấn", ".faq-cta"),
        target(
          "cta.cursorLabel",
          "faq-cta-cursor",
          "Con trỏ nút tư vấn",
          ".faq-cta svg",
        ),
        target("cta.label", "faq-cta-label", "Nút tư vấn", ".faq-cta-label"),
        ...block.items.flatMap((item, index) => [
          target(
            `items.${item.id}.question`,
            `faq-${item.id}-question`,
            `Câu hỏi ${index + 1}`,
            `.faq-item:nth-child(${index + 1}) .faq-head`,
          ),
          target(
            `items.${item.id}.answer`,
            `faq-${item.id}-answer`,
            `Câu trả lời ${index + 1}`,
            `.faq-item:nth-child(${index + 1}) .faq-body p`,
          ),
        ]),
      ];
    case "footerCta":
      return [
        target(
          "eyebrow",
          "footer-eyebrow",
          "Nhãn tiến độ",
          ".footer-progress > div:first-child > span:first-child",
        ),
        target("kicker", "footer-kicker", "Nhãn nhỏ", ".footer-kicker"),
        target(
          "title.prefix",
          "footer-title-prefix",
          "Tiêu đề",
          ".footer-title-prefix",
        ),
        target(
          "title.accent",
          "footer-title-accent",
          "Phần nhấn",
          ".footer-title-accent",
        ),
        target("email", "footer-email", "Email nhận liên hệ", ".massive-link"),
        target(
          "emailLabel",
          "footer-email-label",
          "Nhãn email",
          ".massive-link > span:first-child",
        ),
        target(
          "cursorLabel",
          "footer-cursor",
          "Nhãn con trỏ CTA",
          ".footer-link-arrow",
        ),
        target(
          "copyright",
          "footer-copyright",
          "Bản quyền",
          ".footer-bottom > p",
        ),
        target(
          "socialLabels.facebook",
          "footer-facebook",
          "Nhãn Facebook",
          ".footer-socials a:nth-child(1) .footer-social-label",
        ),
        target(
          "socialLabels.shopee",
          "footer-shopee",
          "Nhãn Shopee",
          ".footer-socials a:nth-child(2) .footer-social-label",
        ),
        target(
          "socialCursorLabel",
          "footer-social-cursor",
          "Nhãn con trỏ mạng xã hội",
          ".footer-socials a",
        ),
        target(
          "backToTopCursorLabel",
          "footer-back-cursor",
          "Con trỏ lên đầu trang",
          ".footer-back-to-top",
        ),
        target(
          "backToTopLabel",
          "footer-back-label",
          "Nhãn lên đầu trang",
          ".footer-back-label",
        ),
      ];
  }
}

export function getHomeVisualFieldTarget(block: HomeBlock, path: string) {
  return getHomeVisualFieldTargets(block).find(
    (candidate) => candidate.path === path,
  );
}
