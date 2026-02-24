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

    for (const key of ["eventType", "entityType", "userId", "startDate", "endDate"]) {
      const val = searchParams.get(key);
      if (val) params.set(key, val);
    }

    const qs = params.toString();
    const url = `${BACKEND_URL}/nelc-audit/export${qs ? `?${qs}` : ""}`;

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
    const disposition = response.headers.get("content-disposition") || 'attachment; filename="nelc-audit-logs.csv"';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": disposition,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
