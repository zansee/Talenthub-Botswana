const sharp = require('sharp');

const logoUrl = "https://hovxyfqpinwqomvevrfb.supabase.co/storage/v1/object/public/company-logos/logo_338e5701-2702-4e6d-8ec3-bec06c3fa524_1780094635003.jpg";

async function analyze() {
  try {
    console.log(`Downloading and reading image via sharp: ${logoUrl}`);
    
    // Download image buffer
    const response = await fetch(logoUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Resize using sharp to 50x50, output raw pixel data (RGBA)
    const { data, info } = await sharp(buffer)
      .resize(50, 50)
      .raw()
      .toBuffer({ resolveWithObject: true });

    const colors = {};

    // Iterate over pixel data (4 bytes per pixel: R, G, B, A)
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i + 0];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 200) continue;

      // Ignore near-whites and near-blacks
      if (r > 245 && g > 245 && b > 245) continue;
      if (r < 15 && g < 15 && b < 15) continue;

      // Rounding logic from CoSettings
      const roundFactor = 16;
      const rr = Math.min(255, Math.round(r / roundFactor) * roundFactor);
      const gg = Math.min(255, Math.round(g / roundFactor) * roundFactor);
      const bb = Math.min(255, Math.round(b / roundFactor) * roundFactor);

      const toHex = (val) => {
        const h = val.toString(16);
        return h.length === 1 ? "0" + h : h;
      };
      const hex = `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`.toUpperCase();

      colors[hex] = (colors[hex] || 0) + 1;
    }

    const sorted = Object.entries(colors).sort((a, b) => b[1] - a[1]);
    console.log("Extracted Dominant Colors (Top 20):");
    sorted.slice(0, 20).forEach(([color, count], idx) => {
      console.log(`[${idx + 1}] Hex: ${color} | Count: ${count}`);
    });
  } catch (err) {
    console.error("Error analyzing image:", err);
  }
}

analyze();
