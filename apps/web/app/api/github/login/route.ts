import { NextResponse } from 'next/server'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || ''
const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3020/api/github/callback'

export async function GET() {
  // Generate a random state for CSRF protection
  const state = Math.random().toString(36).substring(7)

  // Store state in cookie for verification
  const response = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=repo,read:user&state=${state}`
  )

  response.cookies.set('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  })

  return response
}