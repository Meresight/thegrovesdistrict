import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const db = getAdminClient();
    if (!db) {
      return NextResponse.json({ error: "Server storage not configured" }, { status: 500 });
    }

    const fileExt = file.name.split(".").pop() || "png";
    const fileName = `receipt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { data, error } = await db.storage
      .from("receipts")
      .upload(fileName, buffer, {
        contentType: file.type || "image/png",
        upsert: true,
      });

    if (error) {
      console.error("[upload error]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: pubData } = db.storage.from("receipts").getPublicUrl(fileName);

    return NextResponse.json({ url: pubData.publicUrl });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    console.error("[upload api error]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
