# 📚 Epub Studio

**Epub Studio** is a browser-based EPUB processing tool built for [Boitoi](https://boitoi.com.bd) — a Bangladeshi digital publishing platform. It allows editors and publishers to clean, split, add covers, and update metadata of EPUB files entirely in the browser — no server, no installation required.

---

## ✨ Features

### 📤 Step 1 — Upload & Clean
- Drag & drop or click to upload `.epub` or `.docx` files
- **DOCX support** — automatically converts Word documents to EPUB before processing
- Auto-detects Bengali split points (e.g. `১.`, `২.`, `৩.`)
- Automatically splits EPUB into multiple sections based on detected points
- Converts curly double quotes (`"..."`) inside paragraph text to Bengali-style single quotes (`'...'`)
- If no split points found, two options available:
  - **Word Count** — manual split count input (suggested based on ~1500 words/split)
  - **`##` Heading** — split by custom heading identifier (see below)
- If some split points are missing, warns the user and allows continuing anyway

### 🖼️ Step 2 — Cover & Logo
- Drag & drop cover image (JPG, PNG, WEBP)
- Live preview with logo overlay
- Logo style: **Blue** or **White**
- Logo position: **Top Right** or **Bottom Right**
- Adjustable logo size (10%–40%) and margin offset (0–100px)
- **Add Background** option — adds a colored background behind the logo for better contrast
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
- **Form validation** — required fields highlighted before download is allowed
- Modification date auto-set to today
- On download, metadata is written into the OPF file before generating the final EPUB
- **State resets** after successful download — ready for the next book immediately
- **Download Preview** — generates a `.preview.epub` file alongside the final download (see below)

---

## 🛠️ Tools (Settings Menu)

### 🖼️ Create Cover
Standalone cover generator — upload any image and generate:
- **Cover** — plain image (no logo), 395×632px, for EPUB injection
- **Thumbnail** — branded image with logo overlay, for social media / store listings
- Full logo customization: color, position, size, margin, background

### 🗜️ Compress EPUB
Reduces EPUB file size by:
- Converting PNG images (except cover) to JPG using MozJPEG
- Recompressing large JPG/WEBP images (100KB+) at quality 82
- Updating all internal references automatically
- Shows compression stats: files converted, size saved

### 📄 DOCX → EPUB
Standalone Word document to EPUB converter:
- Upload any `.docx` file
- Detects H1/H2 headings as chapter split points
- Preserves bold, italic, and paragraph formatting
- Outputs a valid EPUB 2.0 file with proper OPF, NCX, and XHTML structure
- Fully configurable metadata: title, author, publisher, language

---

## 📖 How It Works

### Split Modes

**Mode 1 — Auto (`১.` `২.` `৩.` pattern)**
The default mode. The system scans the EPUB for Bengali numeric patterns and splits automatically.

**Mode 2 — Word Count**
When no split points are found, manually set how many sections to create. The system divides the content equally by word count.

**Mode 3 — `##` Custom Heading**
For books that already have their own chapter titles. Add `##` before the chapter name directly in the EPUB's xhtml file:

```xml
<p>##এইটা একটা অধ্যায়</p>
<p>অধ্যায়ের content এখানে...</p>

<p>##এইটা আরো একটা অধ্যায়</p>
<p>আরো content এখানে...</p>
```

The `##` identifier is stripped from the output — the text becomes the `<h2>` heading for that section. Each book can have completely unique chapter names without any numbering convention.

---

### Preview EPUB

The **Download Preview** button (Step 3) generates a `bookname.preview.epub` file automatically:

| What happens | Details |
|---|---|
| Keeps only `Section0001.xhtml` | First chapter only |
| Truncates text to half | First 50% of `<p>` tags kept |
| Adds `......` at the end | Trailing punctuation removed, `......` appended |
| Removes cover | `cover.xhtml` and cover image removed |
| NCX preserved | All chapter entries kept, non-preview chapters point to `toc#missing` |
| OPF cleaned | Manifest and spine contain only `Section0001` |
| File name | `bookname.preview.epub` |

State does **not** reset after preview download — only the final download triggers a reset.

---

### EPUB Processing Flow

```
Upload EPUB or DOCX
    ↓
[DOCX only] mammoth → HTML → EPUB conversion
    ↓
Detect split points:
  Auto: ১. ২. ৩. pattern
  Manual: word count
  Custom: ## heading identifier
    ↓
Clean quotes in <p> tags (" " → ' ')
    ↓
Split into Section0000.xhtml, Section0001.xhtml, ...
    ↓
Update OPF manifest + spine
Update NCX table of contents
    ↓
[Optional] Inject plain cover image + title/author into cover.xhtml
    ↓
[Optional] Update metadata in OPF
    ↓
Download Preview EPUB (optional) → bookname.preview.epub
    ↓
Download final EPUB → state resets
```

### Section Naming Convention
- `Section0000.xhtml` — Intro/title page (if content exists before first split point). No `<h2>` heading, not included in TOC.
- `Section0001.xhtml` onwards — Regular chapters. Each gets a `<h2>` heading and TOC entry.

### Cover Images
- **EPUB cover** — Plain resized image (395×632px), no logo, injected as `Images/cover.jpg`
- **Thumbnail** — Same image with logo overlay, encoded with MozJPEG at quality 80 for small file size

---

## 🔐 Authentication & Roles

Role-based access control powered by Supabase:

| Role | Permissions |
|------|-------------|
| `super_admin` | Full access — can add admins and editors, manage all users |
| `admin` | Can add editors only, manage user passwords |
| `editor` | Access to all EPUB processing tools only |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| EPUB Processing | JSZip |
| DOCX Parsing | mammoth |
| Image Encoding | @jsquash/jpeg (MozJPEG WASM) |
| File Upload | react-dropzone |
| Icons | lucide-react |
| Auth & Database | Supabase |
| State Management | React Context + useReducer |
| Deployment | Vercel |
| PWA | vite-plugin-pwa |

---

## 🗂️ Project Structure

```
src/
├── Components/
│   ├── Steps/
│   │   ├── UploadStep.tsx       # Step 1 — file upload, DOCX conversion, split detection
│   │   ├── CoverStep.tsx        # Step 2 — cover image, logo overlay
│   │   └── MetadataStep.tsx     # Step 3 — metadata form + OPF update
│   └── Modals/
│       ├── CoverToolModal.tsx   # Standalone cover/thumbnail generator
│       ├── CompressEpubModal.tsx # EPUB image compression tool
│       ├── DocxToEpubModal.tsx  # DOCX to EPUB converter
│       ├── AddUserModal.tsx     # Add new user (admin/editor)
│       ├── UserControlModal.tsx # Manage existing users
│       └── ChangePasswordModal.tsx
├── Store/
│   ├── EpubContext.tsx          # Global state provider
│   ├── EpubReducer.ts           # State reducer + initial state
│   ├── ThemeContext.tsx         # Light/dark theme + color tokens
│   └── Types.ts                 # TypeScript interfaces
├── Utils/
│   ├── EpubProcessor.ts         # Split point detection & validation
│   ├── EpubSplit.ts             # EPUB splitting logic + quote cleaning + ## mode
│   ├── EpubDownloader.ts        # Cover injection, preview generation
│   ├── CoverProcessor.ts        # Cover/thumbnail generation utility
│   └── supabaseClient.ts        # Supabase auth client
└── MainContainer.tsx            # App shell — header, stepper, footer nav
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
| Add Background | Off |

---

## 📄 License

This project is proprietary software owned by [Boitoi](https://boitoi.com.bd). All rights reserved.

---

## 👨‍💻 Author

**Nayan Islam**  
GitHub: [@IamNayanIslam](https://github.com/IamNayanIslam)

