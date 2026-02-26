import JSZip from "jszip";

// ✅ Fix: সঠিক বাংলা সংখ্যা শব্দ (১ থেকে ১০০)
const BENGALI_NUM_WORDS = [
  "",
  "এক",
  "দুই",
  "তিন",
  "চার",
  "পাঁচ",
  "ছয়",
  "সাত",
  "আট",
  "নয়",
  "দশ",
  "এগারো",
  "বারো",
  "তেরো",
  "চৌদ্দ",
  "পনেরো",
  "ষোলো",
  "সতেরো",
  "আঠারো",
  "উনিশ",
  "বিশ",
  "একুশ",
  "বাইশ",
  "তেইশ",
  "চব্বিশ",
  "পঁচিশ",
  "ছাব্বিশ",
  "সাতাশ",
  "আটাশ",
  "ঊনত্রিশ",
  "ত্রিশ",
  "একত্রিশ",
  "বত্রিশ",
  "তেত্রিশ",
  "চৌত্রিশ",
  "পঁয়ত্রিশ",
  "ছত্রিশ",
  "সাতত্রিশ",
  "আটত্রিশ",
  "ঊনচল্লিশ",
  "চল্লিশ",
  "একচল্লিশ",
  "বিয়াল্লিশ",
  "তেতাল্লিশ",
  "চৌচল্লিশ",
  "পঁয়তাল্লিশ",
  "ছেচল্লিশ",
  "সাতচল্লিশ",
  "আটচল্লিশ",
  "ঊনপঞ্চাশ",
  "পঞ্চাশ",
  "একান্ন",
  "বায়ান্ন",
  "তিপান্ন",
  "চুয়ান্ন",
  "পঞ্চান্ন",
  "ছাপান্ন",
  "সাতান্ন",
  "আটান্ন",
  "ঊনষাট",
  "ষাট",
  "একষট্টি",
  "বাষট্টি",
  "তেষট্টি",
  "চৌষট্টি",
  "পঁয়ষট্টি",
  "ছেষট্টি",
  "সাতষট্টি",
  "আটষট্টি",
  "ঊনসত্তর",
  "সত্তর",
  "একাত্তর",
  "বাহাত্তর",
  "তেহাত্তর",
  "চুয়াত্তর",
  "পঁচাত্তর",
  "ছিয়াত্তর",
  "সাতাত্তর",
  "আটাত্তর",
  "ঊনআশি",
  "আশি",
  "একাশি",
  "বিরাশি",
  "তিরাশি",
  "চুরাশি",
  "পঁচাশি",
  "ছিয়াশি",
  "সাতাশি",
  "আটাশি",
  "ঊননব্বই",
  "নব্বই",
  "একানব্বই",
  "বিরানব্বই",
  "তিরানব্বই",
  "চুরানব্বই",
  "পঁচানব্বই",
  "ছিয়ানব্বই",
  "সাতানব্বই",
  "আটানব্বই",
  "নিরানব্বই",
  "একশ",
];

const SPLIT_PATTERN = /<p[^>]*?>\s*([০-৯\d]+)\.\s*<\/p>/g;
const TARGET_XHTML = "main.xhtml";

// ১. কোট ক্লিন করার লজিক
const cleanQuotes = (html: string) => {
  return html.replace(/<p.*?>.*?<\/p>/gs, (match) => {
    return match.replace(/["""]/g, (q) =>
      q === "\u201c" ? "\u2018" : "\u2019",
    );
  });
};

// ২. মেইন প্রসেসর
export const processAndSplitEpub = async (
  originalFile: File,
  splitConfig: { isManual: boolean; count: number },
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

  // ধাপ ১: ক্লিন করা
  rawHtml = cleanQuotes(rawHtml);

  const bodyMatch = rawHtml.match(/<body.*?>(.*?)<\/body>/s);
  const bodyContent = bodyMatch ? bodyMatch[1] : "";
  const fileHeader =
    rawHtml.match(/(<\?xml.*?<body.*?>)/s)?.[0] || "<html><body>";
  const fileFooter = "</body></html>";

  const finalParts: { html: string; title: string }[] = [];

  // ধাপ ২: স্প্লিটিং লজিক
  if (splitConfig.isManual) {
    // g flag এর lastIndex reset
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
        title:
          counter === 0
            ? "সূচনা"
            : `পর্ব-${BENGALI_NUM_WORDS[counter] || counter}`,
      });
    });
  } else {
    const totalWords = bodyContent.replace(/<[^>]*>/g, "").split(/\s+/).length;
    const wordsPerFile = Math.floor(totalWords / splitConfig.count);
    const paragraphs = bodyContent.split(/(?=<p)/g);
    let currentHtml = "",
      currentWords = 0,
      idx = 1;

    paragraphs.forEach((p) => {
      const pWords = p.replace(/<[^>]*>/g, "").split(/\s+/).length;
      if (currentWords + pWords > wordsPerFile && idx < splitConfig.count) {
        finalParts.push({
          html: currentHtml,
          title: `পর্ব-${BENGALI_NUM_WORDS[idx] || idx}`,
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
      });
    }
  }

  // ধাপ ৩: ফাইল জেনারেশন
  let manifestEntries = "";
  let spineEntries = "";
  let navPoints = "";

  finalParts.forEach((part, i) => {
    const id = `Section${(i + 1).toString().padStart(4, "0")}`;
    const fileName = `${id}.xhtml`;
    const heading = `<h2 style="text-align: center;">${part.title}</h2>\n`;
    const finalHtml = `${fileHeader}\n${heading}${part.html}\n<br/>\n${fileFooter}`;

    zip.file(`OEBPS/Text/${fileName}`, finalHtml);

    manifestEntries += `    <item id="${id}" href="Text/${fileName}" media-type="application/xhtml+xml"/>\n`;
    spineEntries += `    <itemref idref="${id}"/>\n`;
    navPoints += `    <navPoint id="${id}" playOrder="${i + 1}"><navLabel><text>${part.title}</text></navLabel><content src="Text/${fileName}"/></navPoint>\n`;
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
