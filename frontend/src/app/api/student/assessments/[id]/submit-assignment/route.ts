import { NextRequest, NextResponse } from "next/server";

const BACKEND =
  process.env.BACKEND_API_URL || "http://physio-backend:8080/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = request.headers.get("authorization") || "";
  const contentType = request.headers.get("content-type") || "";

  try {
    // Stream raw body to preserve multipart boundary
    const res = await globalThis.fetch(
      `${BACKEND}/student/assessments/${id}/submit-assignment`,
      {
        method: "POST",
        headers: {
          authorization: auth,
          "content-type": contentType,
        },
        body: request.body,
        // @ts-expect-error duplex needed for streaming body
        duplex: "half",
      }
    );

    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data, { status: res.status });
    } catch {
      return NextResponse.json(
        { message: text || "Upload failed" },
        { status: res.status }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
