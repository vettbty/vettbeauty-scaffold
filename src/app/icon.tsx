import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* Generated from the wordmark face, so the icon is always Playfair and never
   drifts from the site. A single V, not the full wordmark: at 180px and below
   "VETT beauty" turns into two illegible smudges. The renderer (Satori) needs
   a static font file, not the next/font web font, hence src/app/fonts. */
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default async function Icon() {
  const font = await readFile(
    join(process.cwd(), "src/app/fonts/Playfair-SemiBold.ttf"),
  );
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", background: "#FBEFEE",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Playfair", color: "#5F3B2A",
        fontSize: 300, letterSpacing: "-0.04em",
      }}>V</div>
    ),
    { ...size, fonts: [{ name: "Playfair", data: font, style: "normal", weight: 600 }] },
  );
}
