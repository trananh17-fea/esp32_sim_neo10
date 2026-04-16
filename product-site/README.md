# BA.SEW Web Landing

Landing page BA.SEW — React + TypeScript + Webpack + Tailwind CSS.

## Cấu trúc thư mục

```
├── public/            # Static assets (index.html, favicon, videos)
├── src/
│   ├── assets/        # Images
│   ├── components/    # React components (Navbar, Footer, BrandLogo, ErrorBoundary)
│   │   └── sections/  # Page sections (Hero, Overview, Demo, Conversion, OrderForm)
│   ├── config/        # Environment variables config
│   ├── hooks/         # Custom React hooks (useTheme, useScrolled, useAnchorFocus)
│   ├── i18n/          # Internationalization (vi/en)
│   ├── lib/           # Utilities (cn)
│   ├── pages/         # Page components
│   ├── services/      # Analytics & form services
│   └── types/         # TypeScript type definitions
├── .env.example       # Environment variables template
├── check-image-dims.js # Image size checker
├── package.json
├── README.md
├── tailwind.config.js
├── tsconfig.json
└── webpack.config.cjs
```

## Chạy local

```bash
npm install
npm run dev
```

Webpack Dev Server chạy tại:

```text
http://localhost:8082
```

## Build production

```bash
npm run build
```

Output nằm trong thư mục `dist/`.

## Kiểm tra

```bash
npm run type-check       # TypeScript type checking
npm run check-images     # Kiểm tra kích thước ảnh
```

## Biến môi trường

Tạo file `.env` từ `.env.example`:

```env
VITE_TRACKING_WEB_URL=https://<github-user>.github.io/<tracking-repo>/
VITE_DEMO_VIDEO_EMBED_URL=videos/basew-demo.mp4
VITE_LEAD_FORM_DEMO_MODE=false
VITE_ENABLE_ANALYTICS=false
VITE_GA_MEASUREMENT_ID=
VITE_META_PIXEL_ID=
VITE_GOOGLE_SHEET_WEBHOOK_URL=
```

## Deploy GitHub Pages

1. Tạo repo GitHub riêng cho landing.
2. Push code lên `main` hoặc `master`.
3. Vào `Settings -> Pages`, chọn `Source: GitHub Actions`.
4. Thêm biến môi trường vào `Settings -> Secrets and variables -> Actions`.

Không upload `node_modules` hoặc `dist`; CI sẽ tự cài dependencies và build lại.
