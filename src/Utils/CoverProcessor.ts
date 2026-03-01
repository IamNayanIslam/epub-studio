// src/Utils/CoverProcessor.ts
import * as jpeg from "@jsquash/jpeg";

const COVER_WIDTH = 395;
const COVER_HEIGHT = 632;
const JPEG_QUALITY = 80; // Sharp এর মতো quality

// ── Canvas থেকে MozJPEG দিয়ে Blob বানানো ────────────────────────────────
async function canvasToMozJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const jpegBuffer = await jpeg.encode(imageData, { quality: JPEG_QUALITY });
  return new Blob([jpegBuffer], { type: "image/jpeg" });
}

export const generateCoverImages = async (
  imageFile: File | string,
  config: any,
  withLogo: boolean = false,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = COVER_WIDTH;
      canvas.height = COVER_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("Canvas context failed");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, COVER_WIDTH, COVER_HEIGHT);

      if (withLogo) {
        const logo = new Image();
        logo.src =
          config.logoColor === "white"
            ? "/boitoi_white.png"
            : "/boitoi_blue.png";

        await new Promise((res) => {
          logo.onload = res;
          logo.onerror = () => reject("Logo load failed");
        });

        const logoWidth = (COVER_WIDTH * (config.logoSize || 18)) / 100;
        const logoHeight = (logo.height / logo.width) * logoWidth;
        const margin = config.margin || 18;
        const x = COVER_WIDTH - logoWidth - margin;
        const y =
          config.logoPosition === "top-right"
            ? margin
            : COVER_HEIGHT - logoHeight - margin;

        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 10;
        ctx.drawImage(logo, x, y, logoWidth, logoHeight);
      }

      try {
        const blob = await canvasToMozJpegBlob(canvas);
        resolve(blob);
      } catch {
        // MozJPEG fail হলে fallback
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject("Blob failed")),
          "image/jpeg",
          0.85,
        );
      }
    };

    img.src =
      typeof imageFile === "string"
        ? imageFile
        : URL.createObjectURL(imageFile);
    img.onerror = () => reject("Image load failed");
  });
};