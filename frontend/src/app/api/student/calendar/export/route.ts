import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.BACKEND_API_URL || "http://physio-backend:8080/api";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = `${BACKEND_URL}/student/calendar/export`;

    const response = await globalThis.fetch(url, {
      headers: {
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Backend returned " + response.status },
        { status: response.status },
      );
    }

    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="my-sessions.ics"',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
