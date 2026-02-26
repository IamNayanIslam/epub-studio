import JSZip from "jszip";

export const injectCoverAndDownload = async (
  originalFile: File,
  newCoverBlob: Blob,
  bookTitle: string = "book",
) => {
  try {
    const zip = new JSZip();
    const arrayBuffer = await originalFile.arrayBuffer();
    const content = await zip.loadAsync(arrayBuffer);

    let coverPath = "";

    // ডাইনামিক ভাবে কভার ফাইল খুঁজে বের করা
    Object.keys(content.files).forEach((path) => {
      const lowerPath = path.toLowerCase();
      if (
        lowerPath.includes("cover") &&
        (lowerPath.endsWith(".jpg") ||
          lowerPath.endsWith(".jpeg") ||
          lowerPath.endsWith(".png"))
      ) {
        coverPath = path;
      }
    });

    if (coverPath) {
      zip.file(coverPath, newCoverBlob);
    } else {
      zip.file("OEBPS/Images/cover.jpg", newCoverBlob);
    }

    const updatedEpub = await zip.generateAsync({
      type: "blob",
      mimeType: "application/epub+zip",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    const link = document.createElement("a");
    const downloadUrl = URL.createObjectURL(updatedEpub);
    link.href = downloadUrl;
    link.download = `${bookTitle.replace(/\s+/g, "_") || "boitoi_book"}.epub`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 100);

    return true;
  } catch (error) {
    console.error("EPUB Injection failed:", error);
    return false;
  }
};
