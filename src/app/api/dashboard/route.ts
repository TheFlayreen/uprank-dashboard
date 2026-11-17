import { connection, NextResponse } from "next/server";
import { getDashboard } from "@/server/dashboard";

// All joining and calculation happens on the server; the client only renders this JSON.
export async function GET() {
  await connection(); // always read the latest synced data, never prerender at build time
  try {
    return NextResponse.json(await getDashboard());
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
