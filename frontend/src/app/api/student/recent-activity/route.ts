import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_API_URL || "http://physio-backend:8080/api";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const params = new URLSearchParams();

    const limit = searchParams.get("limit");
    if (limit) params.set("limit", limit);

    const qs = params.toString();
    const url = `${BACKEND_URL}/student/recent-activity${qs ? `?${qs}` : ""}`;

    const response = await globalThis.fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Backend returned " + response.status },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
