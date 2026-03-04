import JSZip from "jszip";

// ── Blob থেকে cover inject করে নতুন Blob return করা ─────────────────────
export const injectCoverIntoBlob = async (
  epubBlob: Blob,
  newCoverBlob: Blob,
  bookTitle: string = "",
  authorName: string = "",
): Promise<Blob> => {
  const zip = new JSZip();
  const content = await zip.loadAsync(await epubBlob.arrayBuffer());

  // সব ফাইল copy
  for (const [filePath, file] of Object.entries(content.files)) {
    if (file.dir) continue;
    zip.file(filePath, await file.async("uint8array"));
  }

  const opfPath = Object.keys(content.files).find((p) => p.endsWith(".opf"));
  if (!opfPath) throw new Error("OPF file not found!");

  const opfDir = opfPath.split("/").slice(0, -1).join("/");
  let opfContent = await content.file(opfPath)!.async("string");

  // ── Cover image path ──────────────────────────────────────────────────
  const existingCoverPath = Object.keys(content.files).find((p) => {
    const lp = p.toLowerCase();
    return lp.includes("cover") && (lp.endsWith(".jpg") || lp.endsWith(".jpeg") || lp.endsWith(".png"));
  });
  const internalImgPath = existingCoverPath || `${opfDir}/Images/cover.jpg`;
  const coverHrefFromOpf = internalImgPath.replace(`${opfDir}/`, "");

  zip.file(internalImgPath, newCoverBlob);

  // ── Cover XHTML relative path ─────────────────────────────────────────
  const coverXhtmlPath = `${opfDir}/Text/cover.xhtml`;
  const xhtmlDir = `${opfDir}/Text`;

  const imgRelativeFromXhtml = (() => {
    const from = xhtmlDir.split("/");
    const to = internalImgPath.split("/");
    while (from.length && to.length && from[0] === to[0]) { from.shift(); to.shift(); }
    return "../".repeat(from.length) + to.join("/");
  })();

  // ── Cover XHTML — title + author থাকলে যোগ হবে ───────────────────────
  const titleLine = bookTitle.trim()
    ? `\n<h1 style="text-align: center;">${bookTitle.trim()}</h1>`
    : "";
  const authorLine = authorName.trim()
    ? `\n<h3 style="text-align: center;">${authorName.trim()}</h3>`
    : "";
  const endingBr = (titleLine || authorLine) ? `\n<br />` : "";

  const coverXhtml = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN"
"http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Cover</title>
</head>
<body>
  <div style="text-align: center; padding: 0pt; margin: 0pt;">
    <svg xmlns="http://www.w3.org/2000/svg" height="100%" preserveAspectRatio="xMidYMid meet" version="1.1" viewBox="0 0 395 632" width="100%" xmlns:xlink="http://www.w3.org/1999/xlink">
      <image width="395" height="632" xlink:href="${imgRelativeFromXhtml}"/>
    </svg>
  </div>${titleLine}${authorLine}${endingBr}
</body>
</html>`;

  zip.file(coverXhtmlPath, coverXhtml);

  // ── OPF Manifest ──────────────────────────────────────────────────────
  if (!opfContent.includes(`href="${coverHrefFromOpf}"`)) {
    opfContent = opfContent.replace(
      "<manifest>",
      `<manifest>\n    <item id="cover-image" href="${coverHrefFromOpf}" media-type="image/jpeg" properties="cover-image"/>`,
    );
  }

  const coverXhtmlHref = "Text/cover.xhtml";
  if (!opfContent.includes(`href="${coverXhtmlHref}"`)) {
    opfContent = opfContent.replace(
      "<manifest>",
      `<manifest>\n    <item id="cover-xhtml" href="${coverXhtmlHref}" media-type="application/xhtml+xml"/>`,
    );
  }

  // ── OPF Metadata ──────────────────────────────────────────────────────
  if (!opfContent.includes('name="cover"')) {
    opfContent = opfContent.replace(
      /<metadata[^>]*>/,
      (match) => `${match}\n    <meta name="cover" content="cover-image"/>`,
    );
  }

  // ── OPF Spine ─────────────────────────────────────────────────────────
  if (!opfContent.includes('idref="cover-xhtml"')) {
    opfContent = opfContent.replace(
      /<spine[^>]*>/,
      (match) => `${match}\n    <itemref idref="cover-xhtml" linear="yes"/>`,
    );
  }

  zip.file(opfPath, opfContent);

  return await zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
};

// ── Cover XHTML এ শুধু title + author update (নতুন cover image ছাড়া) ─────
export const updateCoverXhtmlMetadata = async (
  epubBlob: Blob,
  bookTitle: string,
  authorName: string,
): Promise<Blob> => {
  const zip = new JSZip();
  const content = await zip.loadAsync(await epubBlob.arrayBuffer());

  // সব ফাইল copy
  for (const [filePath, file] of Object.entries(content.files)) {
    if (file.dir) continue;
    zip.file(filePath, await file.async("uint8array"));
  }

  // cover.xhtml খোঁজা
  const coverXhtmlPath = Object.keys(content.files).find(
    (p) => p.toLowerCase().includes("cover") && p.endsWith(".xhtml"),
  );
  if (!coverXhtmlPath) {
    // cover.xhtml নেই — unchanged return
    return epubBlob;
  }

  let coverXhtml = await content.file(coverXhtmlPath)!.async("string");

  // আগের title/author সরানো
  coverXhtml = coverXhtml.replace(/<h1[^>]*>.*?<\/h1>\n?/gs, "");
  coverXhtml = coverXhtml.replace(/<h3[^>]*>.*?<\/h3>\n?/gs, "");
  coverXhtml = coverXhtml.replace(/<br\s*\/>\s*\n?(?=\s*<\/body>)/g, "");

  // নতুন title + author + br যোগ করা
  const titleLine = bookTitle.trim()
    ? `\n<h1 style="text-align: center;">${bookTitle.trim()}</h1>`
    : "";
  const authorLine = authorName.trim()
    ? `\n<h3 style="text-align: center;">${authorName.trim()}</h3>`
    : "";
  const endingBr = (titleLine || authorLine) ? `\n<br />` : "";

  coverXhtml = coverXhtml.replace(
    "</body>",
    `${titleLine}${authorLine}${endingBr}\n</body>`,
  );

  zip.file(coverXhtmlPath, coverXhtml);

  return await zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
};

// ── Preview EPUB generate ─────────────────────────────────────────────────
// - শুধু Section0001.xhtml রাখে (text অর্ধেক + শেষে ......)
// - cover.xhtml + cover image বাদ দেয়
// - NCX এ সব navPoints রাখে কিন্তু Section0001 ছাড়া src="toc#missing"
// - OPF manifest/spine এ শুধু Section0001
export const generatePreviewEpub = async (
  epubBlob: Blob,
  _bookTitle: string = "book",
): Promise<Blob> => {
  const srcZip = new JSZip();
  const content = await srcZip.loadAsync(await epubBlob.arrayBuffer());

  const opfPath = Object.keys(content.files).find((p) => p.endsWith(".opf"));
  if (!opfPath) throw new Error("OPF file not found!");

  const opfDir = opfPath.split("/").slice(0, -1).join("/");
  const opfContent = await content.file(opfPath)!.async("string");

  // ── Section0001 খোঁজা ────────────────────────────────────────────────
  const section0001Path = Object.keys(content.files).find((p) =>
    p.includes("Section0001.xhtml") || p.includes("section0001.xhtml")
  );
  if (!section0001Path) throw new Error("Section0001.xhtml not found!");

  // ── Section0001 text অর্ধেক করা ─────────────────────────────────────
  const originalXhtml = await content.file(section0001Path)!.async("string");

  // <p> tags গুলো বের করো
  const pMatches = [...originalXhtml.matchAll(/<p[\s\S]*?<\/p>/gi)];
  const halfCount = Math.ceil(pMatches.length / 2);
  const keptParagraphs = pMatches.slice(0, halfCount);

  // body content rebuild করো — শেষ paragraph এ ...... যোগ
  const lastP = keptParagraphs[keptParagraphs.length - 1];
  const truncatedLastP = lastP
    ? lastP[0].replace(
        // </p> এর আগের trailing punctuation সরিয়ে ...... যোগ
        /([।,!?'"'"'""…\s]+)(<\/p>)$/,
        "......$2"
      )
    : "<p>......</p>";

  const rebuiltParagraphs = [
    ...keptParagraphs.slice(0, -1).map((m) => m[0]),
    truncatedLastP,
  ].join("\n");

  // original body content replace
  const previewXhtml = originalXhtml.replace(
    /<body>([\s\S]*?)<\/body>/i,
    (_match, originalBody) => {
      // original body থেকে <h2> heading বের করো
      const h2Match = originalBody.match(/<h2[^>]*>[\s\S]*?<\/h2>/i);
      const h2Tag = h2Match ? h2Match[0] : "";

      return `<body>\n${h2Tag ? h2Tag + "\n" : ""}${rebuiltParagraphs}\n<br/>\n</body>`;
    },
  );

  // ── NCX parse করা ────────────────────────────────────────────────────
  const ncxPath = Object.keys(content.files).find((p) => p.endsWith(".ncx"));
  let previewNcx = "";

  if (ncxPath) {
    const ncxContent = await content.file(ncxPath)!.async("string");

    // সব navPoint এর src — Section0001 ছাড়া toc#missing
    previewNcx = ncxContent.replace(
      /<content\s+src="([^"]+)"/g,
      (match, src) => {
        if (src.includes("Section0001") || src.includes("section0001")) {
          return match; // Section0001 এর src ঠিক রাখো
        }
        return `<content src="toc#missing"`;
      },
    );
  }

  // ── OPF — শুধু Section0001 manifest + spine ──────────────────────────
  // manifest এ cover-image, cover-xhtml, Section0001 ছাড়া সব item বাদ
  const section0001Href = section0001Path.replace(`${opfDir}/`, "");

  // manifest items — শুধু ncx আর Section0001 রাখো
  let previewOpf = opfContent.replace(
    /<manifest>([\s\S]*?)<\/manifest>/i,
    (_match, manifestContent) => {
      const items = [...manifestContent.matchAll(/<item[^>]+>/gi)];
      const kept = items.filter((item) => {
        const href = item[0].match(/href="([^"]+)"/)?.[1] || "";
        const id = item[0].match(/id="([^"]+)"/)?.[1] || "";
        return (
          id === "ncx" ||
          href === section0001Href ||
          href.includes("Section0001")
        );
      });
      return `<manifest>\n${kept.map((i) => `    ${i[0]}`).join("\n")}\n  </manifest>`;
    },
  );

  // spine — শুধু Section0001
  previewOpf = previewOpf.replace(
    /<spine[^>]*>([\s\S]*?)<\/spine>/i,
    (match) => {
      const spineOpen = match.match(/<spine[^>]*>/)?.[0] || "<spine>";
      const itemrefs = [...match.matchAll(/<itemref[^>]+>/gi)];
      const kept = itemrefs.filter((ir) => {
        const idref = ir[0].match(/idref="([^"]+)"/)?.[1] || "";
        return idref.includes("Section0001") || idref.includes("section0001");
      });
      return `${spineOpen}\n${kept.map((i) => `    ${i[0]}`).join("\n")}\n  </spine>`;
    },
  );

  // ── নতুন ZIP বানানো ──────────────────────────────────────────────────
  const previewZip = new JSZip();

  // mimetype
  previewZip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // সব ফাইল copy — cover, extra sections, cover image বাদ দিয়ে
  for (const [filePath, file] of Object.entries(content.files)) {
    if (file.dir) continue;

    const lp = filePath.toLowerCase();

    // বাদ দেওয়া files:
    // 1. cover.xhtml
    // 2. cover image (Images/cover.*)
    // 3. Section0001 ছাড়া অন্য সব Section*.xhtml
    const isCoverXhtml = lp.includes("cover") && lp.endsWith(".xhtml");
    const isCoverImage = lp.includes("images/cover.");
    const isSectionFile = /section\d+\.xhtml$/i.test(filePath);
    const isSection0001 = /section0001\.xhtml$/i.test(filePath);

    if (isCoverXhtml) continue;
    if (isCoverImage) continue;
    if (isSectionFile && !isSection0001) continue;

    // OPF, NCX, Section0001 — modified version
    if (filePath === opfPath) {
      previewZip.file(filePath, previewOpf);
    } else if (ncxPath && filePath === ncxPath) {
      previewZip.file(filePath, previewNcx);
    } else if (filePath === section0001Path) {
      previewZip.file(filePath, previewXhtml);
    } else {
      previewZip.file(filePath, await file.async("uint8array"));
    }
  }

  return await previewZip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
};

// ── Preview download ──────────────────────────────────────────────────────
export const downloadPreviewBlob = (blob: Blob, bookTitle: string = "book") => {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `${bookTitle.replace(/\s+/g, "_") || "boitoi_book"}.preview.epub`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
};
export const downloadBlob = (blob: Blob, bookTitle: string = "book") => {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `${bookTitle.replace(/\s+/g, "_") || "boitoi_book"}.epub`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

export const injectCoverAndDownload = async (
  originalFile: File,
  newCoverBlob: Blob,
  bookTitle: string = "book",
) => {
  try {
    const blob = await injectCoverIntoBlob(
      new Blob([await originalFile.arrayBuffer()]),
      newCoverBlob,
    );
    downloadBlob(blob, bookTitle);
    return true;
  } catch (error) {
    console.error("EPUB Injection failed:", error);
    return false;
  }
};
