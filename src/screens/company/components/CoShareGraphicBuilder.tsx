import { useEffect, useRef, useState } from "react";
import { X, Download, Eye, Loader2, FileText, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PDFDocument } from "pdf-lib";

interface CoShareGraphicBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  company: any;
}

type LayoutFormat = "square" | "landscape" | "a4";

export const CoShareGraphicBuilder = ({
  isOpen,
  onClose,
  job,
  company,
}: CoShareGraphicBuilderProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawCountRef = useRef(0);
  const [format, setFormat] = useState<LayoutFormat>("square");
  const [rendering, setRendering] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Brand Kit variables from company
  const primaryColor = company?.brand_primary_color || "#22C55E";
  const secondaryColor = company?.brand_secondary_color || "#0D1117";
  const accentColor = company?.brand_accent_color || "#3B82F6";
  const brandRecipe = company?.brand_style_recipe || {};

  // Fonts specified in style recipe or fallback
  const fontTitle = brandRecipe.fontTitle || "Outfit";
  const fontBody = brandRecipe.fontBody || "Inter";
  const layoutTheme = brandRecipe.layoutTheme || "modern";
  const visualStyle = brandRecipe.visualStyle || "Geometric gradient layouts";

  const publicLink = `${window.location.origin}/jobs/${job?.id}/apply`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(publicLink)}`;

  // Load Google Font dynamically if not already loaded
  const loadFonts = async () => {
    try {
      const fontUrlTitle = `https://fonts.googleapis.com/css2?family=${fontTitle.replace(/\s+/g, "+")}:wght@700&display=swap`;
      const fontUrlBody = `https://fonts.googleapis.com/css2?family=${fontBody.replace(/\s+/g, "+")}:wght@400;600&display=swap`;

      if (!document.getElementById(`font-${fontTitle}`)) {
        const link = document.createElement("link");
        link.id = `font-${fontTitle}`;
        link.rel = "stylesheet";
        link.href = fontUrlTitle;
        document.head.appendChild(link);
      }

      if (!document.getElementById(`font-${fontBody}`)) {
        const link = document.createElement("link");
        link.id = `font-${fontBody}`;
        link.rel = "stylesheet";
        link.href = fontUrlBody;
        document.head.appendChild(link);
      }

      // Wait for fonts to load
      await Promise.all([
        document.fonts.load(`bold 1em ${fontTitle}`),
        document.fonts.load(`normal 1em ${fontBody}`),
      ]);
    } catch (e) {
      console.warn("Fonts load warning:", e);
    }
  };

  const drawCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isLightColor = (hex: string) => {
      if (!hex) return false;
      let cleanHex = hex.trim().replace(/^#/, "");
      if (cleanHex.length === 3) {
        cleanHex = cleanHex.split("").map(c => c + c).join("");
      }
      if (cleanHex.length < 6) return false;
      const r = parseInt(cleanHex.slice(0, 2), 16) || 0;
      const g = parseInt(cleanHex.slice(2, 4), 16) || 0;
      const b = parseInt(cleanHex.slice(4, 6), 16) || 0;
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.6;
    };

    const drawLogoWithWhiteBg = (
      c: CanvasRenderingContext2D,
      img: HTMLImageElement,
      x: number,
      y: number,
      w: number,
      h: number
    ) => {
      c.save();
      c.fillStyle = "#FFFFFF";
      c.beginPath();
      const radius = 8;
      if (typeof c.roundRect === "function") {
        c.roundRect(x, y, w, h, radius);
      } else {
        c.rect(x, y, w, h);
      }
      c.fill();
      
      c.strokeStyle = "rgba(0, 0, 0, 0.05)";
      c.lineWidth = 1;
      c.stroke();
      
      const padding = Math.round(Math.min(w, h) * 0.08);
      const innerW = w - padding * 2;
      const innerH = h - padding * 2;
      
      const imgRatio = img.width / img.height;
      const boxRatio = innerW / innerH;
      
      let drawW = innerW;
      let drawH = innerH;
      let drawX = x + padding;
      let drawY = y + padding;
      
      if (imgRatio > boxRatio) {
        drawH = innerW / imgRatio;
        drawY = y + padding + (innerH - drawH) / 2;
      } else {
        drawW = innerH * imgRatio;
        drawX = x + padding + (innerW - drawW) / 2;
      }
      
      c.drawImage(img, drawX, drawY, drawW, drawH);
      c.restore();
    };

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const currentDrawId = ++drawCountRef.current;

    setRendering(true);

    try {
      // 1. Ensure fonts are preloaded
      await loadFonts();
      if (currentDrawId !== drawCountRef.current) return;

      // 2. Set dimensions based on format
      let width = 1080;
      let height = 1080;

      if (format === "landscape") {
        width = 1200;
        height = 628;
      } else if (format === "a4") {
        // standard A4 ratio scaled for crisp export (approx 2x standard 72dpi points)
        width = 1240;
        height = 1754;
      }

      canvas.width = width;
      canvas.height = height;

      // Theme helper states
      // If layout theme is corporate, force light background style behavior (clean white)
      const isLightBg = isLightColor(secondaryColor) || layoutTheme === "corporate";
      const textColor = isLightBg ? "#111827" : "#FFFFFF";
      const textMutedColor = isLightBg ? "#4B5563" : "rgba(255, 255, 255, 0.7)";
      const cardBgColor = isLightBg ? "rgba(0, 0, 0, 0.02)" : "rgba(255, 255, 255, 0.08)";
      const cardBorderColor = isLightBg ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.25)";

      // 3. Clear and draw background
      // Use clean solid white for light themes and corporate layouts to avoid reddish/pinkish/yellowish tints
      const canvasBgColor = isLightBg ? "#FFFFFF" : secondaryColor;
      console.log("Canvas draw parameters:", {
        primaryColor,
        secondaryColor,
        accentColor,
        isLightBg,
        canvasBgColor,
        layoutTheme
      });
      ctx.fillStyle = canvasBgColor;
      ctx.fillRect(0, 0, width, height);

      // 4. Draw decorative brand background shapes (gradients, geometric lines)
      if (!isLightBg) {
        ctx.save();
        const grad = ctx.createRadialGradient(
          width / 2, height / 2, 50,
          width / 2, height / 2, Math.max(width, height)
        );
        grad.addColorStop(0, secondaryColor);
        // Create a subtle shift using accent/primary color with high transparency
        grad.addColorStop(1, hexToRgba(primaryColor, 0.08));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Geometric line accent patterns
        ctx.strokeStyle = hexToRgba(primaryColor, 0.15);
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (layoutTheme === "geometric" || layoutTheme === "bold") {
          ctx.moveTo(0, height * 0.2);
          ctx.lineTo(width, height * 0.4);
          ctx.moveTo(width * 0.1, height);
          ctx.lineTo(width * 0.9, 0);
        } else {
          // Minimalist/Corporate lines
          ctx.moveTo(width * 0.05, height * 0.15);
          ctx.lineTo(width * 0.95, height * 0.15);
          ctx.moveTo(width * 0.05, height * 0.85);
          ctx.lineTo(width * 0.95, height * 0.85);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 5. Preload Company Logo & QR Code with CORS anonymous tags
      const [logoImg, qrImg] = await Promise.all([
        loadImageCORS(company?.logo_url),
        loadImageCORS(qrCodeUrl)
      ]);
      if (currentDrawId !== drawCountRef.current) return;

      // 6. Draw layouts
      if (format === "square") {
        // --- SQUARE LAYOUT ---
        const drawCorporateSquare = (layoutTheme === "corporate" || isLightBg);

        if (drawCorporateSquare) {
          // Draw Top Banner
          ctx.fillStyle = primaryColor;
          ctx.fillRect(0, 0, width, 260);

          // Draw Logo inside banner
          if (logoImg) {
            drawLogoWithWhiteBg(ctx, logoImg, 80, 70, 120, 120);
          } else {
            ctx.fillStyle = "#FFFFFF";
            ctx.font = `700 32px ${fontTitle}`;
            ctx.fillText(company?.name?.substring(0, 2).toUpperCase() || "CO", 80, 150);
          }

          // Banner Right side texts (Hiring labels)
          ctx.textAlign = "right";
          ctx.fillStyle = accentColor;
          ctx.font = `italic 600 24px ${fontBody}`;
          ctx.fillText("We're", width - 80, 110);
          
          ctx.fillStyle = "#FFFFFF";
          ctx.font = `700 52px ${fontTitle}`;
          ctx.fillText("HIRING", width - 80, 170);

          ctx.fillStyle = accentColor;
          ctx.font = `600 18px ${fontBody}`;
          ctx.fillText("Join Our Team!", width - 80, 210);
          ctx.textAlign = "left"; // reset

          // Company Name text below banner
          ctx.fillStyle = textColor;
          ctx.font = `600 24px ${fontBody}`;
          ctx.fillText(company?.name || "Corporate Sourcing", 80, 320);

          // Job Title
          ctx.fillStyle = textColor;
          ctx.font = `700 56px ${fontTitle}`;
          const titleWords = (job?.title || "Career Opportunity").split(" ");
          let line = "";
          let y = 410;
          const maxTitleWidth = width - 160;
          for (let n = 0; n < titleWords.length; n++) {
            const testLine = line + titleWords[n] + " ";
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxTitleWidth && n > 0) {
              ctx.fillText(line, 80, y);
              line = titleWords[n] + " ";
              y += 75;
            } else {
              line = testLine;
            }
          }
          ctx.fillText(line, 80, y);

          // Job details group (Location, job type)
          ctx.fillStyle = primaryColor;
          ctx.font = `700 22px ${fontBody}`;
          const detailsLine = `${job?.location || "Remote"}  |  ${job?.employment_type || job?.job_type || "Full-time"}`;
          ctx.fillText(detailsLine.toUpperCase(), 80, y + 60);

          // Sub-details description
          ctx.fillStyle = textMutedColor;
          ctx.font = `400 20px ${fontBody}`;
          const descText = (job?.description || "").replace(/<[^>]*>/g, "");
          wrapText(ctx, descText, 80, y + 110, width - 160, 30, 4);

        } else {
          // Traditional Dark Mode Square
          // Header line
          ctx.fillStyle = primaryColor;
          ctx.fillRect(80, 80, 100, 8);

          // Logo
          if (logoImg) {
            drawLogoWithWhiteBg(ctx, logoImg, 80, 120, 100, 100);
          } else {
            ctx.fillStyle = primaryColor;
            ctx.font = `700 32px ${fontTitle}`;
            ctx.fillText(company?.name?.substring(0, 2).toUpperCase() || "CO", 80, 180);
          }

          // Company Name text
          ctx.fillStyle = "#FFFFFF";
          ctx.font = `600 24px ${fontBody}`;
          ctx.fillText(company?.name || "Corporate Sourcing", 80, 260);

          // Job Title
          ctx.fillStyle = "#FFFFFF";
          ctx.font = `700 56px ${fontTitle}`;
          const titleWords = (job?.title || "Career Opportunity").split(" ");
          let line = "";
          let y = 380;
          const maxTitleWidth = width - 160;
          for (let n = 0; n < titleWords.length; n++) {
            const testLine = line + titleWords[n] + " ";
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxTitleWidth && n > 0) {
              ctx.fillText(line, 80, y);
              line = titleWords[n] + " ";
              y += 75;
            } else {
              line = testLine;
            }
          }
          ctx.fillText(line, 80, y);

          // Job details group (Location, job type)
          ctx.fillStyle = primaryColor;
          ctx.font = `700 22px ${fontBody}`;
          const detailsLine = `${job?.location || "Remote"}  |  ${job?.employment_type || job?.job_type || "Full-time"}`;
          ctx.fillText(detailsLine.toUpperCase(), 80, y + 60);

          // Sub-details description
          ctx.fillStyle = hexToRgba("#FFFFFF", 0.7);
          ctx.font = `400 20px ${fontBody}`;
          const descText = (job?.description || "").replace(/<[^>]*>/g, "");
          wrapText(ctx, descText, 80, y + 110, width - 160, 30, 4);
        }

        // Common Footer / QR Apply Section for Square
        ctx.fillStyle = cardBgColor;
        ctx.fillRect(80, height - 260, width - 160, 180);
        
        ctx.lineWidth = 1;
        ctx.strokeStyle = cardBorderColor;
        ctx.strokeRect(80, height - 260, width - 160, 180);

        // CTA text
        ctx.fillStyle = textColor;
        ctx.font = `700 24px ${fontTitle}`;
        ctx.fillText("JOIN OUR TEAM", 120, height - 170);
        ctx.fillStyle = textMutedColor;
        ctx.font = `400 16px ${fontBody}`;
        ctx.fillText("Scan QR code to submit your application", 120, height - 130);

        // Draw QR code inside footer box
        if (qrImg) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(width - 230, height - 240, 140, 140);
          ctx.drawImage(qrImg, width - 225, height - 235, 130, 130);
        }

        // TalentHub watermarking
        ctx.fillStyle = isLightBg ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.25)";
        ctx.font = `600 12px ${fontBody}`;
        ctx.fillText("Powered by TalentHub", width - 210, height - 50);

      } else if (format === "landscape") {
        // --- LANDSCAPE LAYOUT ---
        const drawCorporateLandscape = (layoutTheme === "corporate" || isLightBg);

        if (drawCorporateLandscape) {
          // Draw Top Banner
          ctx.fillStyle = primaryColor;
          ctx.fillRect(0, 0, width, 150);

          // Draw Logo inside banner
          if (logoImg) {
            drawLogoWithWhiteBg(ctx, logoImg, 60, 35, 80, 80);
          }
          
          ctx.fillStyle = "#FFFFFF";
          ctx.font = `600 24px ${fontBody}`;
          ctx.fillText(company?.name || "Acme Corp", logoImg ? 160 : 60, 85);

          // Right side title
          ctx.textAlign = "right";
          ctx.fillStyle = accentColor;
          ctx.font = `italic 600 20px ${fontBody}`;
          ctx.fillText("We're Hiring  •  Join Our Team", width - 60, 85);
          ctx.textAlign = "left"; // reset

          // Job Title below banner
          ctx.fillStyle = textColor;
          ctx.font = `700 46px ${fontTitle}`;
          const titleWords = (job?.title || "Career Opportunity").split(" ");
          let line = "";
          let y = 240;
          const maxTitleWidth = 650;
          for (let n = 0; n < titleWords.length; n++) {
            const testLine = line + titleWords[n] + " ";
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxTitleWidth && n > 0) {
              ctx.fillText(line, 60, y);
              line = titleWords[n] + " ";
              y += 58;
            } else {
              line = testLine;
            }
          }
          ctx.fillText(line, 60, y);

          // Metadata badges
          ctx.fillStyle = primaryColor;
          ctx.font = `700 18px ${fontBody}`;
          ctx.fillText(`${(job?.location || "Remote").toUpperCase()}  •  ${(job?.employment_type || job?.job_type || "Full-time").toUpperCase()}`, 60, y + 45);

          // Short Description
          ctx.fillStyle = textMutedColor;
          ctx.font = `400 16px ${fontBody}`;
          const descText = (job?.description || "").replace(/<[^>]*>/g, "");
          wrapText(ctx, descText, 60, y + 90, 650, 24, 3);

        } else {
          // Traditional Dark Mode Landscape
          if (logoImg) {
            drawLogoWithWhiteBg(ctx, logoImg, 60, 60, 80, 80);
          }
          
          ctx.fillStyle = "#FFFFFF";
          ctx.font = `600 20px ${fontBody}`;
          ctx.fillText(company?.name || "Acme Corp", logoImg ? 160 : 60, 110);

          // Job Title
          ctx.fillStyle = "#FFFFFF";
          ctx.font = `700 46px ${fontTitle}`;
          const titleWords = (job?.title || "Career Opportunity").split(" ");
          let line = "";
          let y = 220;
          const maxTitleWidth = 650;
          for (let n = 0; n < titleWords.length; n++) {
            const testLine = line + titleWords[n] + " ";
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxTitleWidth && n > 0) {
              ctx.fillText(line, 60, y);
              line = titleWords[n] + " ";
              y += 58;
            } else {
              line = testLine;
            }
          }
          ctx.fillText(line, 60, y);

          // Metadata badges
          ctx.fillStyle = primaryColor;
          ctx.font = `700 18px ${fontBody}`;
          ctx.fillText(`${(job?.location || "Remote").toUpperCase()}  •  ${(job?.employment_type || job?.job_type || "Full-time").toUpperCase()}`, 60, y + 45);

          // Short Description
          ctx.fillStyle = hexToRgba("#FFFFFF", 0.65);
          ctx.font = `400 16px ${fontBody}`;
          const descText = (job?.description || "").replace(/<[^>]*>/g, "");
          wrapText(ctx, descText, 60, y + 90, 650, 24, 3);
        }

        // Common Right Column (Call To Action & QR code) for Landscape
        const boxX = width - 420;
        ctx.fillStyle = cardBgColor;
        ctx.fillRect(boxX, 60, 360, height - 120);

        ctx.strokeStyle = cardBorderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, 60, 360, height - 120);

        // Header inside Box
        ctx.fillStyle = textColor;
        ctx.font = `700 20px ${fontTitle}`;
        ctx.textAlign = "center";
        ctx.fillText("APPLY ONLINE NOW", boxX + 180, 120);

        ctx.fillStyle = textMutedColor;
        ctx.font = `400 14px ${fontBody}`;
        ctx.fillText("Scan code with your phone camera", boxX + 180, 155);

        if (qrImg) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(boxX + 90, 190, 180, 180);
          ctx.drawImage(qrImg, boxX + 95, 195, 170, 170);
        }

        ctx.fillStyle = primaryColor;
        ctx.font = `700 14px ${fontBody}`;
        ctx.fillText("TALENTHUB NETWORK", boxX + 180, height - 100);
        ctx.textAlign = "left"; // reset alignment

      } else {
        // --- A4 PRINT LAYOUT ---
        const drawCorporateA4 = (layoutTheme === "corporate" || isLightBg);

        if (drawCorporateA4) {
          // Draw Top Banner
          ctx.fillStyle = primaryColor;
          ctx.fillRect(0, 0, width, 320);

          // Draw strip for Job Title below banner
          // Create a darker shade of primary color for contrast
          const r = Math.max(0, parseInt(primaryColor.slice(1, 3), 16) - 30) || 0;
          const g = Math.max(0, parseInt(primaryColor.slice(3, 5), 16) - 30) || 0;
          const b = Math.max(0, parseInt(primaryColor.slice(5, 7), 16) - 30) || 0;
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(0, 320, width, 100);

          // Draw Logo inside banner
          if (logoImg) {
            drawLogoWithWhiteBg(ctx, logoImg, 100, 80, 160, 160);
          } else {
            ctx.fillStyle = "#FFFFFF";
            ctx.font = `700 48px ${fontTitle}`;
            ctx.fillText(company?.name?.substring(0, 2).toUpperCase() || "CO", 100, 240);
          }

          // Company Name inside banner
          ctx.fillStyle = "#FFFFFF";
          ctx.font = `600 28px ${fontBody}`;
          ctx.fillText(company?.name || "Corporate Sourcing", 290, 170);

          // Banner Right side texts
          ctx.textAlign = "right";
          ctx.fillStyle = accentColor;
          ctx.font = `italic 600 32px ${fontBody}`;
          ctx.fillText("We're", width - 100, 110);
          
          ctx.fillStyle = "#FFFFFF";
          ctx.font = `700 72px ${fontTitle}`;
          ctx.fillText("HIRING", width - 100, 190);

          ctx.fillStyle = accentColor;
          ctx.font = `600 24px ${fontBody}`;
          ctx.fillText("Join Our Team!", width - 100, 240);
          ctx.textAlign = "left"; // reset

          // Job Title in strip (centered)
          ctx.textAlign = "center";
          ctx.fillStyle = "#FFFFFF";
          ctx.font = `700 36px ${fontTitle}`;
          ctx.fillText((job?.title || "CAREER OPPORTUNITY").toUpperCase(), width / 2, 385);
          ctx.textAlign = "left"; // reset

          // Two Column Layout
          const colWidth = (width - 260) / 2; // ~490px
          const col1X = 100;
          const col2X = width - 100 - colWidth; // ~650px

          // --- COLUMN 1 CONTENT ---
          let y = 490;
          
          // Metadata items
          ctx.fillStyle = textColor;
          ctx.font = `700 22px ${fontBody}`;
          ctx.fillText("Position:", col1X, y);
          ctx.font = `400 22px ${fontBody}`;
          ctx.fillText(job?.title || "Not specified", col1X + 110, y);
          
          y += 40;
          ctx.fillStyle = textColor;
          ctx.font = `700 22px ${fontBody}`;
          ctx.fillText("Location:", col1X, y);
          ctx.font = `400 22px ${fontBody}`;
          ctx.fillText(job?.location || "Remote", col1X + 110, y);
          
          y += 40;
          ctx.fillStyle = textColor;
          ctx.font = `700 22px ${fontBody}`;
          ctx.fillText("Type:", col1X, y);
          ctx.font = `400 22px ${fontBody}`;
          ctx.fillText(job?.employment_type || job?.job_type || "Full-time", col1X + 110, y);

          y += 50;
          // Divider
          ctx.strokeStyle = cardBorderColor;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(col1X, y);
          ctx.lineTo(col1X + colWidth, y);
          ctx.stroke();

          y += 40;
          // About Us Section
          ctx.fillStyle = primaryColor;
          ctx.font = `700 24px ${fontTitle}`;
          ctx.fillText("About Us", col1X, y);
          
          y += 35;
          ctx.fillStyle = textMutedColor;
          ctx.font = `400 18px ${fontBody}`;
          const aboutText = company?.description || `We are a leading and growing group in the ${company?.industry || "industry"} sector. We are committed to excellence and professional development for all team members.`;
          wrapText(ctx, aboutText, col1X, y, colWidth, 26, 6);

          y += 180;
          // Role Overview Section
          ctx.fillStyle = primaryColor;
          ctx.font = `700 24px ${fontTitle}`;
          ctx.fillText("Role Overview", col1X, y);

          y += 35;
          ctx.fillStyle = textMutedColor;
          ctx.font = `400 18px ${fontBody}`;
          const descText = (job?.description || "").replace(/<[^>]*>/g, "");
          wrapText(ctx, descText, col1X, y, colWidth, 26, 12);

          // --- COLUMN 2 CONTENT ---
          let y2 = 490;

          // Key Skills Needed
          if (job?.skills && job.skills.length > 0) {
            ctx.fillStyle = primaryColor;
            ctx.font = `700 24px ${fontTitle}`;
            ctx.fillText("Key Skills Needed", col2X, y2);

            let skillX = col2X;
            let skillY = y2 + 30;
            ctx.font = `600 16px ${fontBody}`;
            job.skills.forEach((skill: string) => {
              const skillWidth = ctx.measureText(skill).width + 30;
              if (skillX + skillWidth > col2X + colWidth) {
                skillX = col2X;
                skillY += 45;
              }
              ctx.fillStyle = hexToRgba(primaryColor, 0.1);
              ctx.fillRect(skillX, skillY, skillWidth - 10, 34);
              ctx.strokeStyle = hexToRgba(primaryColor, 0.3);
              ctx.strokeRect(skillX, skillY, skillWidth - 10, 34);

              ctx.fillStyle = textColor;
              ctx.fillText(skill, skillX + 10, skillY + 23);
              skillX += skillWidth + 5;
            });
            y2 = skillY + 80;
          }

          // Requirements Section
          ctx.fillStyle = primaryColor;
          ctx.font = `700 24px ${fontTitle}`;
          ctx.fillText("Qualifications & Requirements", col2X, y2);
          
          y2 += 35;
          ctx.fillStyle = textMutedColor;
          ctx.font = `400 18px ${fontBody}`;
          const reqsText = job?.requirements || "• Practical experience in a similar role.\n• Strong organizational and communication skills.\n• Relevant degree or certification preferred.\n• Ability to work collaboratively in a fast-paced environment.";
          wrapText(ctx, reqsText, col2X, y2, colWidth, 26, 10);

        } else {
          // Traditional Dark Mode A4 Layout
          // Header
          ctx.fillStyle = primaryColor;
          ctx.fillRect(100, 100, 200, 12);

          if (logoImg) {
            drawLogoWithWhiteBg(ctx, logoImg, 100, 160, 140, 140);
          } else {
            ctx.fillStyle = primaryColor;
            ctx.font = `700 48px ${fontTitle}`;
            ctx.fillText(company?.name?.substring(0, 2).toUpperCase() || "CO", 100, 240);
          }

          ctx.fillStyle = "#FFFFFF";
          ctx.font = `600 32px ${fontBody}`;
          ctx.fillText(company?.name || "Corporate Sourcing", 100, 360);

          // Main Title
          ctx.fillStyle = "#FFFFFF";
          ctx.font = `700 68px ${fontTitle}`;
          const titleWords = (job?.title || "Career Opportunity").split(" ");
          let line = "";
          let y = 500;
          const maxTitleWidth = width - 200;
          for (let n = 0; n < titleWords.length; n++) {
            const testLine = line + titleWords[n] + " ";
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxTitleWidth && n > 0) {
              ctx.fillText(line, 100, y);
              line = titleWords[n] + " ";
              y += 90;
            } else {
              line = testLine;
            }
          }
          ctx.fillText(line, 100, y);

          // Details Row
          ctx.fillStyle = primaryColor;
          ctx.font = `700 26px ${fontBody}`;
          ctx.fillText(`${(job?.location || "Remote").toUpperCase()}   |   ${(job?.employment_type || job?.job_type || "Full-time").toUpperCase()}`, 100, y + 60);

          // Horizontal line separator
          ctx.fillStyle = hexToRgba(primaryColor, 0.3);
          ctx.fillRect(100, y + 110, width - 200, 2);

          // Job Description Text Header
          ctx.fillStyle = "#FFFFFF";
          ctx.font = `700 28px ${fontTitle}`;
          ctx.fillText("Job Description & Scope", 100, y + 165);

          // Job Description content
          ctx.fillStyle = hexToRgba("#FFFFFF", 0.7);
          ctx.font = `400 22px ${fontBody}`;
          const descText = (job?.description || "").replace(/<[^>]*>/g, "");
          wrapText(ctx, descText, 100, y + 215, width - 200, 34, 15);

          // Required Skills Header
          if (job?.skills && job.skills.length > 0) {
            ctx.fillStyle = "#FFFFFF";
            ctx.font = `700 28px ${fontTitle}`;
            ctx.fillText("Key Skills Needed", 100, height - 580);

            let skillX = 100;
            let skillY = height - 530;
            ctx.font = `600 18px ${fontBody}`;
            job.skills.forEach((skill: string) => {
              const skillWidth = ctx.measureText(skill).width + 30;
              if (skillX + skillWidth > width - 100) {
                skillX = 100;
                skillY += 45;
              }
              ctx.fillStyle = hexToRgba(primaryColor, 0.15);
              ctx.fillRect(skillX, skillY, skillWidth - 10, 36);
              ctx.strokeStyle = hexToRgba(primaryColor, 0.4);
              ctx.strokeRect(skillX, skillY, skillWidth - 10, 36);

              ctx.fillStyle = "#FFFFFF";
              ctx.fillText(skill, skillX + 10, skillY + 24);
              skillX += skillWidth + 5;
            });
          }
        }

        // Common A4 QR code CTA footer block at the bottom
        const footerY = height - 340;
        ctx.fillStyle = cardBgColor;
        ctx.fillRect(100, footerY, width - 200, 220);
        ctx.strokeStyle = cardBorderColor;
        ctx.strokeRect(100, footerY, width - 200, 220);

        ctx.fillStyle = textColor;
        ctx.font = `700 28px ${fontTitle}`;
        ctx.fillText("INTERESTED IN THIS ROLE?", 140, footerY + 75);
        ctx.fillStyle = textMutedColor;
        ctx.font = `400 20px ${fontBody}`;
        ctx.fillText("Scan QR code to submit your application", 140, footerY + 125);

        if (qrImg) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(width - 320, footerY + 20, 180, 180);
          ctx.drawImage(qrImg, width - 315, footerY + 25, 170, 170);
        }
      }

      setRendering(false);
    } catch (err) {
      console.error("Canvas draw failure:", err);
      toast.error("Failed to render preview canvas layout.");
      setRendering(false);
    }
  };

  const loadImageCORS = (url?: string | null): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      if (!url) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn(`Failed loading image CORS: ${url}`);
        resolve(null);
      };
    });
  };

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const wrapText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number
  ) => {
    const words = text.split(" ");
    let line = "";
    let lineCount = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, y);
        line = words[n] + " ";
        y += lineHeight;
        lineCount++;
        if (lineCount >= maxLines) return;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, y);
  };

  // Trigger draw on change of format or metadata
  useEffect(() => {
    if (isOpen && job) {
      drawCanvas();
    }
  }, [isOpen, format, job, company]);

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `Advert_${job?.title?.replace(/\s+/g, "_") || "Job"}_${format}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("PNG Graphic downloaded!");
    } catch (e) {
      toast.error("PNG download failed. Try PDF export.");
      console.error(e);
    }
  };

  const handleDownloadPdf = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setGeneratingPdf(true);
    try {
      // Create PDF Document using pdf-lib
      const pdfDoc = await PDFDocument.create();
      
      // Standard A4 dimensions in points (595.27 x 841.89)
      const page = pdfDoc.addPage([595, 842]);

      // Export canvas as JPEG base64 (downscales file size to prevent crash)
      const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64Data = jpegDataUrl.split(",")[1];
      const imgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      const embeddedImg = await pdfDoc.embedJpg(imgBytes);

      // Draw JPEG image covering full page bounds
      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: 595,
        height: 842,
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `Advert_${job?.title?.replace(/\s+/g, "_") || "Job"}_A4.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("PDF Advert document downloaded!");
    } catch (err) {
      console.error("PDF generator failure:", err);
      toast.error("Could not construct PDF file. Try PNG instead.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col lg:flex-row overflow-hidden max-h-[90vh]">
        {/* Render/Preview Canvas Column */}
        <div className="flex-1 bg-[#0a0c10] p-6 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-white/5 relative min-h-[300px] lg:min-h-0">
          <div className="w-full max-w-[400px] aspect-square flex items-center justify-center relative overflow-hidden bg-black/25 rounded-2xl border border-white/5">
            {rendering && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs text-white">Generating preview...</span>
              </div>
            )}
            <canvas 
              ref={canvasRef} 
              className="max-w-full max-h-full object-contain shadow-glow"
              style={{ width: "100%", height: "100%" }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-4 text-center leading-relaxed">
            Layout auto-composites company colors, preloaded Google Font: <strong className="text-white">{fontTitle}</strong>, and an active QR link to apply.
          </p>
        </div>

        {/* Configurations Side Panel */}
        <div className="w-full lg:w-80 p-6 flex flex-col justify-between shrink-0 space-y-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-1.5 text-white font-bold">
                <ImageIcon className="w-4 h-4 text-primary" />
                <span>Job Sourcing Graphic</span>
              </div>
              <button 
                onClick={onClose} 
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Layout selectors */}
            <div className="space-y-2">
              <Label className="text-xs text-zinc-300 font-semibold uppercase tracking-wider">Graphic Format</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setFormat("square")}
                  className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    format === "square" 
                      ? "bg-primary/10 border-primary text-primary" 
                      : "bg-[#111318] border-white/5 text-muted-foreground hover:text-white"
                  }`}
                >
                  Square
                </button>
                <button
                  onClick={() => setFormat("landscape")}
                  className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    format === "landscape" 
                      ? "bg-primary/10 border-primary text-primary" 
                      : "bg-[#111318] border-white/5 text-muted-foreground hover:text-white"
                  }`}
                >
                  Landscape
                </button>
                <button
                  onClick={() => setFormat("a4")}
                  className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    format === "a4" 
                      ? "bg-primary/10 border-primary text-primary" 
                      : "bg-[#111318] border-white/5 text-muted-foreground hover:text-white"
                  }`}
                >
                  A4 Print
                </button>
              </div>
            </div>

            {/* Metadata Recipe */}
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 space-y-2.5">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Corporate Brand Styles</p>
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: primaryColor }} title="Primary" />
                <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: secondaryColor }} title="Secondary" />
                <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: accentColor }} title="Accent" />
                <span className="text-[11px] text-white/80 font-medium">Style: {layoutTheme}</span>
              </div>
              <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                Rules: {visualStyle}
              </p>
            </div>
          </div>

          {/* Export Actions */}
          <div className="space-y-2 pt-4 border-t border-white/5">
            <Button
              onClick={handleDownloadPng}
              disabled={rendering}
              className="w-full h-11 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              <ImageIcon className="w-4 h-4" /> Export image (PNG)
            </Button>
            <Button
              onClick={handleDownloadPdf}
              disabled={rendering || generatingPdf}
              variant="outline"
              className="w-full h-11 border-white/10 text-white hover:bg-white/5 rounded-xl flex items-center justify-center gap-2"
            >
              {generatingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <FileText className="w-4 h-4 text-muted-foreground" />
              )}
              Export document (PDF)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
