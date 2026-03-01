import JSZip from "jszip";

// ── Blob থেকে cover inject করে নতুন Blob return করা ─────────────────────
export const injectCoverIntoBlob = async (
  epubBlob: Blob,
  newCoverBlob: Blob,
): Promise<Blob> => {
  const zip = new JSZip();
  const content = await zip.loadAsync(await epubBlob.arrayBuffer());

  // OPF খোঁজা
  const opfPath = Object.keys(content.files).find((p) => p.endsWith(".opf"));
  if (!opfPath) throw new Error("OPF file not found!");

  const opfDir = opfPath.split("/").slice(0, -1).join("/"); // e.g. "OEBPS"
  let opfContent = await content.file(opfPath)!.async("string");

  // ── Cover image path নির্ধারণ ────────────────────────────────────────
  const existingCoverPath = Object.keys(content.files).find((p) => {
    const lp = p.toLowerCase();
    return (
      lp.includes("cover") &&
      (lp.endsWith(".jpg") || lp.endsWith(".jpeg") || lp.endsWith(".png"))
    );
  });
  const internalImgPath = existingCoverPath || `${opfDir}/Images/cover.jpg`;
  const coverHrefFromOpf = internalImgPath.replace(`${opfDir}/`, "");

  // Cover image inject
  zip.file(internalImgPath, newCoverBlob);

  // ── Cover XHTML তৈরি ─────────────────────────────────────────────────
  const coverXhtmlPath = `${opfDir}/Text/cover.xhtml`;
  const xhtmlDir = `${opfDir}/Text`;

  const imgRelativeFromXhtml = (() => {
    const from = xhtmlDir.split("/");
    const to = internalImgPath.split("/");
    while (from.length && to.length && from[0] === to[0]) {
      from.shift();
      to.shift();
    }
    return "../".repeat(from.length) + to.join("/");
  })();

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
  </div>
</body>
</html>`;

  zip.file(coverXhtmlPath, coverXhtml);

  // ── OPF Manifest আপডেট ───────────────────────────────────────────────
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

  // ── OPF Metadata ─────────────────────────────────────────────────────
  if (!opfContent.includes('name="cover"')) {
    opfContent = opfContent.replace(
      /<metadata[^>]*>/,
      (match) => `${match}\n    <meta name="cover" content="cover-image"/>`,
    );
  }

  // ── OPF Spine ────────────────────────────────────────────────────────
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

// ── Final download ────────────────────────────────────────────────────────
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

// ── Backward compatibility ────────────────────────────────────────────────
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
