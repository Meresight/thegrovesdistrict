import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/receipt?url=...
 * Proxies receipt images from Supabase storage through the same-origin server.
 * This completely avoids cross-origin blocking, ad-blocker restrictions,
 * and bucket permission issues in admin and member browsers.
 */
export async function GET(req: NextRequest) {
  try {
    const rawUrl = req.nextUrl.searchParams.get("url") || "";
    if (!rawUrl) {
      return new NextResponse("Missing url parameter", { status: 400 });
    }

    // Extract file name from URL (e.g. .../receipts/receipt-123.png -> receipt-123.png)
    let fileName = rawUrl;
    if (fileName.includes("/receipts/")) {
      fileName = fileName.split("/receipts/").pop() || fileName;
    } else if (fileName.includes("/")) {
      fileName = fileName.split("/").pop() || fileName;
    }
    // Clean any query string from fileName
    fileName = fileName.split("?")[0];

    const db = getAdminClient();
    if (db && fileName) {
      const { data: blob, error } = await db.storage.from("receipts").download(fileName);
      if (!error && blob) {
        const buffer = Buffer.from(await blob.arrayBuffer());
        const ext = fileName.split(".").pop()?.toLowerCase();
        let mime = blob.type || "image/png";
        if (ext === "jpg" || ext === "jpeg") mime = "image/jpeg";
        else if (ext === "webp") mime = "image/webp";
        else if (ext === "png") mime = "image/png";
        else if (ext === "pdf") mime = "application/pdf";

        return new Response(buffer, {
          status: 200,
          headers: {
            "Content-Type": mime,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
            "Content-Disposition": `inline; filename="${fileName}"`,
          },
        });
      }
    }

    // Fallback: If direct storage download failed, fetch via server-side HTTP
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
      const res = await fetch(rawUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get("content-type") || "image/png";
        return new Response(buf, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }

    return new NextResponse("Receipt not found", { status: 404 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error loading receipt";
    console.error("[receipt proxy error]", msg);
    return new NextResponse(msg, { status: 500 });
  }
}
