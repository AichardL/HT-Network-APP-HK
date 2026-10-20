import { NextResponse } from 'next/server';

// 独立香港 web 应用的轻量 API 帮助函数（无鉴权/审计/sqlite 依赖）。
export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}