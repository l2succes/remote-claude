import { NextRequest, NextResponse } from 'next/server'

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || ''
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || ''

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  // Verify state to prevent CSRF
  const storedState = request.cookies.get('github_oauth_state')?.value

  if (!code || !state || state !== storedState) {
    return NextResponse.redirect(new URL('/claude?error=auth_failed', request.url))
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData.error)
      return NextResponse.redirect(new URL('/claude?error=token_failed', request.url))
    }

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
      },
    })

    const userData = await userResponse.json()

    // Redirect back to claude page with success
    const response = NextResponse.redirect(new URL('/claude?auth=success', request.url))

    // Store token and user info in secure cookies
    response.cookies.set('github_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    response.cookies.set('github_user', JSON.stringify({
      id: userData.id,
      login: userData.login,
      name: userData.name,
      avatar_url: userData.avatar_url,
    }), {
      httpOnly: false, // Allow client to read user info
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    // Clear state cookie
    response.cookies.delete('github_oauth_state')

    return response
  } catch (error) {
    console.error('GitHub OAuth callback error:', error)
    return NextResponse.redirect(new URL('/claude?error=callback_failed', request.url))
  }
}