// @ts-check
import {defineConfig} from 'astro/config';

import react from '@astrojs/react';

import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
    integrations: [react(), tailwind(), sitemap()],
    output: 'static', // SSG
    compressHTML: true,
    site: "https://trangchu.luoichongmuoi.shop",
    redirects: {
        "/bai-viet": "https://luoichongmuoi.shop/bai-viet",
        "/san-pham": "https://luoichongmuoi.shop/san-pham",
        "/danh-sach-san-pham": "https://luoichongmuoi.shop/danh-sach-san-pham",
        "/gio-hang": "https://luoichongmuoi.shop/gio-hang",

    }
});