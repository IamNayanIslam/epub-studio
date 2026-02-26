// src/Utils/CoverProcessor.ts

export const generateCoverImages = async (
  imageFile: File | string, // File অথবা URL স্ট্রিং দুটোই সাপোর্ট করবে
  config: any,
  withLogo: boolean = false,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 395;
      canvas.height = 632;
      const ctx = canvas.getContext("2d");

      if (!ctx) return reject("Canvas context failed");

      // হাই-কোয়ালিটি সেটিংস
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // ১. মেইন কভার ড্র করা
      ctx.drawImage(img, 0, 0, 395, 632);

      // ২. লোগো অ্যাড করা
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

        const logoWidth = (395 * (config.logoSize || 18)) / 100;
        const logoHeight = (logo.height / logo.width) * logoWidth;
        const margin = config.margin || 18;

        const x = 395 - logoWidth - margin;
        const y =
          config.logoPosition === "top-right"
            ? margin
            : 632 - logoHeight - margin;

        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 10;
        ctx.drawImage(logo, x, y, logoWidth, logoHeight);
      }

      // ৩. ব্লব হিসেবে রিটার্ন করা (কোয়ালিটি ১.০ ফিক্সড)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject("Blob generation failed");
        },
        "image/jpeg",
        1.0, // এখানে সরাসরি ১০০% কোয়ালিটি
      );
    };

    // যদি imageFile স্ট্রিং (URL) হয় তবে সরাসরি সেট হবে, নাহলে তৈরি হবে
    img.src =
      typeof imageFile === "string"
        ? imageFile
        : URL.createObjectURL(imageFile);
    img.onerror = () => reject("Image load failed");
  });
};
