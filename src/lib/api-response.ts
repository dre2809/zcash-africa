/**
 * Standardised API response helpers.
 *
 * Every route handler should use these so the client always receives a
 * consistent JSON envelope:
 *
 *   { success: true,  data: <payload>,       meta?: <pagination> }
 *   { success: false, error: "<message>",    code?: "<ERROR_CODE>" }
 */

import { NextResponse } from "next/server";

// ─── Success ─────────────────────────────────────────────────────────────────

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function ok<T>(
  data: T,
  meta?: PaginationMeta,
  status = 200
): NextResponse {
  return NextResponse.json({ success: true, data, ...(meta ? { meta } : {}) }, { status });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export function badRequest(message = "Bad Request", code?: string): NextResponse {
  return NextResponse.json(
    { success: false, error: message, ...(code ? { code } : {}) },
    { status: 400 }
  );
}

export function unauthorized(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden"): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 403 });
}

export function notFound(resource = "Resource"): NextResponse {
  return NextResponse.json(
    { success: false, error: `${resource} not found` },
    { status: 404 }
  );
}

export function conflict(message = "Conflict"): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 409 });
}

export function tooManyRequests(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Too many requests. Please slow down." },
    { status: 429 }
  );
}

export function serverError(message = "Internal Server Error"): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10))
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}
