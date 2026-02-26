import JSZip from "jszip";

const SPLIT_PATTERN = /<p[^>]*?>\s*([০-৯\d]+)\.\s*<\/p>/g;

const toEnglish = (bngNum: string) =>
  bngNum
    .split("")
    .map((d) => ("০১২৩৪৫৬৭৮৯".indexOf(d) > -1 ? "০১২৩৪৫৬৭৮৯".indexOf(d) : d))
    .join("");

export const processEpubFile = async (file: File) => {
  try {
    const zip = new JSZip();
    const content = await zip.loadAsync(await file.arrayBuffer());

    // ১. মেইন ফাইল খুঁজে বের করা
    const targetFile = Object.keys(content.files).find((name) =>
      name.endsWith("main.xhtml"),
    );
    if (!targetFile)
      throw new Error("Essential EPUB file (main.xhtml) missing!");

    const htmlContent = await content.file(targetFile)!.async("string");

    // ২. শব্দ সংখ্যা গণনা করা
    const wordCount = htmlContent
      .replace(/<[^>]*>/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    // ৩. স্প্লিট পয়েন্ট ডিটেকশন
    // প্রতিবার exec() করার আগে lastIndex reset করা (g flag bug fix)
    SPLIT_PATTERN.lastIndex = 0;
    const detectedNumbers: number[] = [];
    let match;
    while ((match = SPLIT_PATTERN.exec(htmlContent)) !== null) {
      const num = /[০-৯]/.test(match[1])
        ? parseInt(toEnglish(match[1]))
        : parseInt(match[1]);
      if (!isNaN(num)) detectedNumbers.push(num);
    }

    // ৪. লজিক সিদ্ধান্ত (প্যাটার্ন আছে কি নেই)
    if (detectedNumbers.length === 0) {
      return {
        status: "error",
        errorType: "no-points",
        data: { wordCount },
      };
    }

    // ৫. মিসিং পয়েন্ট চেক করা
    const maxPoint = Math.max(...detectedNumbers);
    const missingPoints: number[] = [];
    for (let i = 1; i <= maxPoint; i++) {
      if (!detectedNumbers.includes(i)) missingPoints.push(i);
    }

    if (missingPoints.length > 0) {
      return {
        status: "error",
        errorType: "missing-points",
        data: { missingPoints, totalSplits: detectedNumbers.length, wordCount },
      };
    }

    return {
      status: "success",
      data: { totalSplits: maxPoint, wordCount },
    };
  } catch (error: any) {
    throw new Error(error.message);
  }
};
