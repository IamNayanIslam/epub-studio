import JSZip from "jszip";

const BENGALI_NUM_WORDS = [
  "",
  "এক", "দুই", "তিন", "চার", "পাঁচ",
  "ছয়", "সাত", "আট", "নয়", "দশ",
  "এগারো", "বারো", "তেরো", "চৌদ্দ", "পনেরো",
  "ষোলো", "সতেরো", "আঠারো", "উনিশ", "বিশ",
  "একুশ", "বাইশ", "তেইশ", "চব্বিশ", "পঁচিশ",
  "ছাব্বিশ", "সাতাশ", "আটাশ", "ঊনত্রিশ", "ত্রিশ",
  "একত্রিশ", "বত্রিশ", "তেত্রিশ", "চৌত্রিশ", "পঁয়ত্রিশ",
  "ছত্রিশ", "সাতত্রিশ", "আটত্রিশ", "ঊনচল্লিশ", "চল্লিশ",
  "একচল্লিশ", "বিয়াল্লিশ", "তেতাল্লিশ", "চৌচল্লিশ", "পঁয়তাল্লিশ",
  "ছেচল্লিশ", "সাতচল্লিশ", "আটচল্লিশ", "ঊনপঞ্চাশ", "পঞ্চাশ",
  "একান্ন", "বায়ান্ন", "তিপান্ন", "চুয়ান্ন", "পঞ্চান্ন",
  "ছাপান্ন", "সাতান্ন", "আটান্ন", "ঊনষাট", "ষাট",
  "একষট্টি", "বাষট্টি", "তেষট্টি", "চৌষট্টি", "পঁয়ষট্টি",
  "ছেষট্টি", "সাতষট্টি", "আটষট্টি", "ঊনসত্তর", "সত্তর",
  "একাত্তর", "বাহাত্তর", "তেহাত্তর", "চুয়াত্তর", "পঁচাত্তর",
  "ছিয়াত্তর", "সাতাত্তর", "আটাত্তর", "ঊনআশি", "আশি",
  "একাশি", "বিরাশি", "তিরাশি", "চুরাশি", "পঁচাশি",
  "ছিয়াশি", "সাতাশি", "আটাশি", "ঊননব্বই", "নব্বই",
  "একানব্বই", "বিরানব্বই", "তিরানব্বই", "চুরানব্বই", "পঁচানব্বই",
  "ছিয়ানব্বই", "সাতানব্বই", "আটানব্বই", "নিরানব্বই", "একশ",
];

const SPLIT_PATTERN = /<p[^>]*?>\s*([০-৯\d]+)\.\s*<\/p>/g;
const TARGET_XHTML = "main.xhtml";

const cleanQuotes = (html: string) => {
  // শুধু <p> tag এর ভেতরে সব ধরনের double quote → single quote
  return html.replace(/(<p[^>]*>)(.*?)(<\/p>)/gs, (_, open, content, close) => {
    const cleaned = content
      .replace(/\u201c/g, "\u2018") // " → ' (opening curly)
      .replace(/\u201d/g, "\u2019") // " → ' (closing curly)
      .replace(/\u0022/g, "\u2019"); // " → ' (straight double quote)
    return open + cleaned + close;
  });
};

export const processAndSplitEpub = async (
  originalFile: File,
  splitConfig: { isManual: boolean; count: number; mode?: "auto" | "manual" | "heading" },
): Promise<Blob> => {
  const zip = new JSZip();
  const content = await zip.loadAsync(await originalFile.arrayBuffer());

  const targetPath = Object.keys(content.files).find((n) =>
    n.endsWith(TARGET_XHTML),
  )!;
  const opfPath = Object.keys(content.files).find((n) => n.endsWith(".opf"))!;
  const ncxPath = Object.keys(content.files).find((n) => n.endsWith(".ncx"));

  let rawHtml = await content.file(targetPath)!.async("string");
  let opfContent = await content.file(opfPath)!.async("string");
  let ncxContent = ncxPath
    ? await content.file(ncxPath)!.async("string")
    : null;

  rawHtml = cleanQuotes(rawHtml);

  const bodyMatch = rawHtml.match(/<body.*?>(.*?)<\/body>/s);
  const bodyContent = bodyMatch ? bodyMatch[1] : "";
  const fileHeader =
    rawHtml.match(/(<\?xml.*?<body.*?>)/s)?.[0] || "<html><body>";
  const fileFooter = "</body></html>";

  // isIntro: true হলে এই part টা Section0000, h2 নেই, TOC নেই
  const finalParts: { html: string; title: string; isIntro: boolean }[] = [];

  if (splitConfig.mode === "heading") {
    // ## দিয়ে শুরু হওয়া <p> গুলো heading — split point
    const paragraphs = bodyContent.split(/(?=<p)/g);
    let currentHtml = "";
    let isFirst = true;
    let currentTitle = "";

    const flush = (title: string, html: string, intro: boolean) => {
      if (!html.trim()) return;
      finalParts.push({ html, title, isIntro: intro });
    };

    for (const p of paragraphs) {
      // ## identifier detect
      const headingMatch = p.match(/<p[^>]*?>\s*##([^<]+?)\s*<\/p>/i);
      if (headingMatch) {
        // আগের chunk flush করো
        flush(currentTitle, currentHtml, isFirst && !currentTitle);
        currentTitle = headingMatch[1].trim();
        currentHtml = "";
        isFirst = false;
      } else {
        currentHtml += p;
      }
    }
    // শেষ chunk
    flush(currentTitle, currentHtml, isFirst && !currentTitle);

  } else if (splitConfig.isManual) {
    SPLIT_PATTERN.lastIndex = 0;
    const parts = bodyContent.split(SPLIT_PATTERN);
    let counter = 0;
    parts.forEach((p) => {
      if (/^\s*[০-৯\d]+\s*$/.test(p)) {
        counter++;
        return;
      }
      if (!p.trim()) return;
      finalParts.push({
        html: p,
        title: counter === 0
          ? ""
          : `পর্ব-${BENGALI_NUM_WORDS[counter] || counter}`,
        isIntro: counter === 0,
      });
    });
  } else {
    const totalWords = bodyContent.replace(/<[^>]*>/g, "").split(/\s+/).length;
    const wordsPerFile = Math.floor(totalWords / splitConfig.count);
    const paragraphs = bodyContent.split(/(?=<p)/g);
    let currentHtml = "", currentWords = 0, idx = 1;

    paragraphs.forEach((p) => {
      const pWords = p.replace(/<[^>]*>/g, "").split(/\s+/).length;
      if (currentWords + pWords > wordsPerFile && idx < splitConfig.count) {
        finalParts.push({
          html: currentHtml,
          title: `পর্ব-${BENGALI_NUM_WORDS[idx] || idx}`,
          isIntro: false,
        });
        idx++;
        currentHtml = p;
        currentWords = pWords;
      } else {
        currentHtml += p;
        currentWords += pWords;
      }
    });
    if (currentHtml.trim()) {
      finalParts.push({
        html: currentHtml,
        title: `পর্ব-${BENGALI_NUM_WORDS[idx] || idx}`,
        isIntro: false,
      });
    }
  }

  // ধাপ ৩: ফাইল জেনারেশন
  let manifestEntries = "";
  let spineEntries = "";
  let navPoints = "";
  let tocPlayOrder = 1;
  let realSectionCounter = 0; // intro ছাড়া real section count

  // শেষ non-intro part এর index বের করা
  const lastRealIndex = finalParts.reduce((last, p, i) => (!p.isIntro ? i : last), -1);

  finalParts.forEach((part, partIndex) => {
    // ✅ intro → Section0000, real parts → Section0001, Section0002...
    const sectionNum = part.isIntro ? 0 : ++realSectionCounter;
    const id = `Section${sectionNum.toString().padStart(4, "0")}`;
    const fileName = `${id}.xhtml`;

    // ✅ intro তে h2 নেই, বাকিতে আছে
    const heading = part.isIntro
      ? ""
      : `<h2 style="text-align: center;">${part.title}</h2>\n`;

    // ✅ Last section এ সমাপ্ত যোগ করা
    let htmlContent = part.html;
    if (partIndex === lastRealIndex) {
      const SAMAPTO = "সমাপ্ত";
      const samapto_bold_center = `<p style="text-align: center;"><strong>${SAMAPTO}</strong></p>`;
      // আগে থেকে আছে কিনা check
      if (!htmlContent.includes(SAMAPTO)) {
        htmlContent += `\n${samapto_bold_center}`;
      } else {
        // আছে কিন্তু bold+center নেই — replace করা
        htmlContent = htmlContent.replace(
          /(<p[^>]*>)\s*সমাপ্ত\s*(<\/p>)/g,
          samapto_bold_center,
        );
      }
    }

    const finalHtml = `${fileHeader}\n${heading}${htmlContent}\n<br/>\n${fileFooter}`;
    zip.file(`OEBPS/Text/${fileName}`, finalHtml);

    manifestEntries += `    <item id="${id}" href="Text/${fileName}" media-type="application/xhtml+xml"/>\n`;
    spineEntries += `    <itemref idref="${id}"/>\n`;

    // ✅ intro TOC এ যাবে না
    if (!part.isIntro) {
      navPoints += `    <navPoint id="${id}" playOrder="${tocPlayOrder++}"><navLabel><text>${part.title}</text></navLabel><content src="Text/${fileName}"/></navPoint>\n`;
    }
  });

  // ধাপ ৪: OPF আপডেট
  const targetIdMatch = opfContent.match(
    new RegExp(`<item id="(.*?)" href=".*?${TARGET_XHTML}"`),
  );
  if (targetIdMatch) {
    const targetId = targetIdMatch[1];
    opfContent = opfContent.replace(
      new RegExp(`<item id="${targetId}".*?\\/>`),
      manifestEntries.trim(),
    );
    opfContent = opfContent.replace(
      new RegExp(`<itemref idref="${targetId}".*?\\/>`),
      spineEntries.trim(),
    );
  } else {
    opfContent = opfContent.replace(
      /<manifest>.*?<\/manifest>/s,
      `<manifest>\n${manifestEntries}</manifest>`,
    );
    opfContent = opfContent.replace(
      /<spine.*?>.*?<\/spine>/s,
      `<spine>\n${spineEntries}</spine>`,
    );
  }
  zip.file(opfPath, opfContent);

  // ধাপ ৫: NCX আপডেট
  if (ncxContent && ncxPath) {
    ncxContent = ncxContent.replace(
      /<navMap>.*?<\/navMap>/s,
      `<navMap>\n${navPoints}</navMap>`,
    );
    zip.file(ncxPath, ncxContent);
  }

  zip.remove(targetPath);

  return await zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
  });
};
