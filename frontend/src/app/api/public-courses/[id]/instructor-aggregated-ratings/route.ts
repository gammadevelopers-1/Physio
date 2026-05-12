import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_API_URL || "http://physio-backend:8080/api";

/**
 * Proxy for the public instructor-aggregated-ratings endpoint. Powers the
 * "Instructor" toggle inside the public course-detail Reviews block —
 * returns the course's instructor's reviews across every course they teach.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    const limit = searchParams.get("limit");
    const qs = limit ? `?limit=${encodeURIComponent(limit)}` : "";
    const url = `${BACKEND_URL}/courses/${id}/instructor-aggregated-ratings${qs}`;

    const response = await globalThis.fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: "Backend returned " + response.status },
        { status: response.status },
      );
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
