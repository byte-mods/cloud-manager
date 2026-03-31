import { NextRequest, NextResponse } from "next/server";

const DATA_ENGINEERING_SERVICE_URL = process.env.DATA_ENGINEERING_SERVICE_URL ?? "http://localhost:8089";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = slug?.join("/") ?? "";
  const searchParams = request.nextUrl.searchParams.toString();
  const url = searchParams ? `${endpoint}?${searchParams}` : endpoint;

  try {
    const response = await fetch(`${DATA_ENGINEERING_SERVICE_URL}/api/v1/data-engineering/${url}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          request.headers.entries().filter(([key]) =>
            ["authorization", "x-cloud-region", "x-cloud-account"].includes(key.toLowerCase())
          )
        ),
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Data engineering service unavailable" }, { status: 503 });
  }
}

