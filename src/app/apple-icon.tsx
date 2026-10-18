import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* The Apple touch icon: identical to icon.tsx at 180px. A single V, generated
   from the wordmark face (see icon.tsx). */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const font = await readFile(
    join(process.cwd(), "src/app/fonts/Playfair-SemiBold.ttf"),
  );
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", background: "#FBEFEE",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "Playfair", color: "#5F3B2A",
        fontSize: 105, letterSpacing: "-0.04em",
      }}>V</div>
    ),
    { ...size, fonts: [{ name: "Playfair", data: font, style: "normal", weight: 600 }] },
  );
}
