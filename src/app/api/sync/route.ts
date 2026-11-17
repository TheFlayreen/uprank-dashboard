import { NextResponse } from "next/server";
import { runSync } from "@/server/sync";

// Re-pull both APIs into Postgres. Used by the "Refresh data" button.
export async function POST() {
  try {
    const result = await runSync({ source: "api" });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
