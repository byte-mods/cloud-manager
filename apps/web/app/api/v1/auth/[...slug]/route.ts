import { NextRequest, NextResponse } from "next/server";

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL ?? "http://localhost:8081";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = slug?.join("/") ?? "";

  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/api/v1/auth/${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          request.headers
            .entries()
            .filter(([key]) => key.toLowerCase().startsWith("x-") || key.toLowerCase() === "authorization")
        ),
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Auth service unavailable" },
      { status: 503 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = slug?.join("/") ?? "";
  const body = await request.json();

  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/api/v1/auth/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          request.headers
            .entries()
            .filter(([key]) => key.toLowerCase().startsWith("x-") || key.toLowerCase() === "authorization")
        ),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Auth service unavailable" },
      { status: 503 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = slug?.join("/") ?? "";
  const body = await request.json();

  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/api/v1/auth/${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          request.headers
            .entries()
            .filter(([key]) => key.toLowerCase().startsWith("x-") || key.toLowerCase() === "authorization")
        ),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Auth service unavailable" },
      { status: 503 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const endpoint = slug?.join("/") ?? "";

  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/api/v1/auth/${endpoint}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(
          request.headers
            .entries()
            .filter(([key]) => key.toLowerCase().startsWith("x-") || key.toLowerCase() === "authorization")
        ),
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Auth service unavailable" },
      { status: 503 }
    );
  }
}
