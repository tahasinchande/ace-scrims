import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import {
  normalizeReferralCode,
  REFERRAL_COOKIE_NAME,
  validateReferralCode,
} from "@/lib/referrals"

export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "CDN-Cache-Control": "no-store",
}

export async function GET(request: NextRequest) {
  try {
    const queryCode = request.nextUrl.searchParams.get("code")
    const cookieStore = await cookies()
    const stagedCode = cookieStore.get(REFERRAL_COOKIE_NAME)?.value ?? ""
    const rawCode = queryCode !== null ? queryCode : stagedCode
    const code = normalizeReferralCode(rawCode)

    if (!code) {
      return NextResponse.json(
        { ok: true, code: "", valid: false, staged: Boolean(stagedCode) },
        { headers: NO_STORE_HEADERS }
      )
    }

    const result = await validateReferralCode(code)
    if (!result.valid) {
      return NextResponse.json(
        {
          ok: true,
          code,
          valid: false,
          reason: result.reason,
          staged: queryCode === null && Boolean(stagedCode),
        },
        { headers: NO_STORE_HEADERS }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        code: result.code,
        valid: true,
        type: result.type,
        referrerName: result.referrerName,
        staged: queryCode === null && Boolean(stagedCode),
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (err) {
    console.warn("[API /referrals/stage GET] error:", err)
    return NextResponse.json(
      { ok: false, error: "Could not validate referral code right now." },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { code?: string }
    const code = normalizeReferralCode(body.code)
    const isProd = process.env.NODE_ENV === "production"

    if (!code) {
      const res = NextResponse.json(
        { ok: true, cleared: true, code: "", valid: false },
        { headers: NO_STORE_HEADERS }
      )
      res.cookies.set(REFERRAL_COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        path: "/",
        maxAge: 0,
      })
      return res
    }

    const result = await validateReferralCode(code)
    if (!result.valid) {
      return NextResponse.json(
        { ok: false, valid: false, code, error: result.reason },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    const res = NextResponse.json(
      {
        ok: true,
        valid: true,
        code: result.code,
        type: result.type,
        referrerName: result.referrerName,
      },
      { headers: NO_STORE_HEADERS }
    )
    res.cookies.set(REFERRAL_COOKIE_NAME, result.code, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      path: "/",
      maxAge: 60 * 30, // 30 minutes to complete Email or Google OAuth sign-up
    })
    return res
  } catch (err) {
    console.warn("[API /referrals/stage POST] error:", err)
    return NextResponse.json(
      { ok: false, error: "Could not stage referral code." },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}

export async function DELETE() {
  const isProd = process.env.NODE_ENV === "production"
  const res = NextResponse.json({ ok: true, cleared: true }, { headers: NO_STORE_HEADERS })
  res.cookies.set(REFERRAL_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: 0,
  })
  return res
}
