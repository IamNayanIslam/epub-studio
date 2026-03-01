# 📚 Epub Studio

**Epub Studio** is a browser-based EPUB processing tool built for [Boitoi](https://boitoi.com.bd) — a Bangladeshi digital publishing platform. It allows editors and publishers to clean, split, add covers, and update metadata of EPUB files entirely in the browser — no server, no installation required.

---

## ✨ Features

### 📤 Step 1 — Upload & Clean
- Drag & drop or click to upload `.epub` files
- Auto-detects Bengali split points (e.g. `১.`, `২.`, `৩.`)
- Automatically splits EPUB into multiple sections based on detected points
- Converts curly double quotes (`"..."`) inside paragraph text to Bengali-style single quotes (`'...'`)
- If no split points found, allows manual split count input (suggested based on word count ~1500 words/split)
- If some split points are missing, warns the user and allows continuing anyway

### 🖼️ Step 2 — Cover & Logo
- Drag & drop cover image (JPG, PNG, WEBP)
- Live preview with logo overlay
- Logo style: **Blue** or **White**
- Logo position: **Top Right** or **Bottom Right**
- Adjustable logo size (10%–40%) and margin offset (0–100px)
- Injects a **plain cover** (no logo) into the EPUB for clean ebook display
- Generates a **branded thumbnail** (with logo) for download — for social media / store listings
- Uses **MozJPEG** (`@jsquash/jpeg`) encoder for Sharp-like quality at small file sizes (~50–80kb)

### 📝 Step 3 — Metadata & Final Download
- Edit all key EPUB metadata:
  - **বইয়ের নাম** (Book Title) → `dc:title`
  - **লেখকের নাম** (Author in Bengali) → `dc:creator`
  - **লেখকের নাম ইংরেজিতে** (File-As for sorting) → `opf:file-as`
  - **Genre / Subject** (comma-separated, multiple supported) → `dc:subject`
  - **Publisher** → `dc:publisher` (default: Boitoi)
  - **Language** → `dc:language` (default: `bn`)
- Modification date auto-set to today
- On download, metadata is written into the OPF file before generating the final EPUB

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| EPUB Processing | JSZip |
| Image Encoding | @jsquash/jpeg (MozJPEG WASM) |
| File Upload | react-dropzone |
| Icons | lucide-react |
| State Management | React Context + useReducer |
| Deployment | Vercel |
| PWA | vite-plugin-pwa |

---

## 🗂️ Project Structure

```
src/
├── Steps/
│   ├── UploadStep.tsx       # Step 1 — file upload, split detection
│   ├── CoverStep.tsx        # Step 2 — cover image, logo overlay
│   └── MetadataStep.tsx     # Step 3 — metadata form + OPF update
├── Store/
│   ├── EpubContext.tsx      # Global state provider
│   ├── EpubReducer.ts       # State reducer
│   ├── ThemeContext.tsx      # Light/dark theme + color tokens
│   └── Types.ts             # TypeScript interfaces
├── Utils/
│   ├── EpubProcessor.ts     # Split point detection & validation
│   ├── EpubSplit.ts         # EPUB splitting logic + quote cleaning
│   ├── EpubDownloader.ts    # Cover injection into EPUB blob
│   └── CoverProcessor.ts   # Cover/thumbnail generation utility
└── MainContainer.tsx        # App shell — header, stepper, footer nav
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/IamNayanIslam/epub-studio.git
cd epub-studio
npm install
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

---

## 📖 How It Works

### EPUB Processing Flow

```
Upload EPUB
    ↓
Detect split points (১. ২. ৩. ...)
    ↓
Clean quotes in <p> tags (" " → ' ')
    ↓
Split into Section0000.xhtml, Section0001.xhtml, ...
    ↓
Update OPF manifest + spine
Update NCX table of contents
    ↓
[Optional] Inject plain cover image
    ↓
[Optional] Update metadata in OPF
    ↓
Download final EPUB
```

### Section Naming Convention
- `Section0000.xhtml` — Intro/title page (if exists before first split point). No `<h2>` heading, not included in TOC.
- `Section0001.xhtml` onwards — Regular chapters. Each gets a `<h2>` heading and TOC entry.

### Cover Images
- **EPUB cover** — Plain resized image (395×632px), no logo, injected as `Images/cover.jpg`
- **Thumbnail** — Same image with logo overlay, encoded with MozJPEG at quality 80 for small file size

---

## 🎨 Theme

Supports **Light** and **Dark** mode:
- Toggle via Sun/Moon button in the header
- Preference saved to `localStorage`
- Auto-detects system preference on first load

---

## 📱 PWA Support

Epub Studio is a Progressive Web App:
- Installable on desktop and mobile (Add to Home Screen)
- Works offline after first load (all processing is client-side)
- No data ever leaves your browser

---

## 🔧 Configuration

### Default Values
| Setting | Default |
|---------|---------|
| Publisher | Boitoi |
| Language | Bengali (bn) |
| Logo Position | Bottom Right |
| Logo Size | 18% |
| Logo Margin | 18px |
| JPEG Quality | 80 |
| Words per split (suggestion) | 1500 |

---

## 📄 License

This project is proprietary software owned by [Boitoi](https://boitoi.com.bd). All rights reserved.

---

## 👨‍💻 Author

**Nayan Islam**  
GitHub: [@IamNayanIslam](https://github.com/IamNayanIslam)