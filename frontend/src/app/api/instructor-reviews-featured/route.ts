import { NextRequest, NextResponse } from "next/server";

// Server-side URL for container-to-container communication
const BACKEND_URL =
  process.env.BACKEND_API_URL || "http://physio-backend:8080/api";

/**
 * Proxy for the public featured-instructor-reviews endpoint, used by the
 * Strapi-driven Instructor Reviews block. No-store ensures every page load
 * gets a fresh round-robin shuffle from the backend.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = searchParams.get("limit");
    const params = new URLSearchParams();
    if (limit) params.set("limit", limit);
    const qs = params.toString();
    const url = `${BACKEND_URL}/courses/instructor-reviews/featured${qs ? `?${qs}` : ""}`;

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
