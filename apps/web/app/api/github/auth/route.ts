import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('github_token')?.value
  const userCookie = request.cookies.get('github_user')?.value

  if (!token || !userCookie) {
    return NextResponse.json({ isAuthenticated: false })
  }

  try {
    const user = JSON.parse(userCookie)

    // Verify token is still valid
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      // Token is invalid, clear cookies
      const res = NextResponse.json({ isAuthenticated: false })
      res.cookies.delete('github_token')
      res.cookies.delete('github_user')
      return res
    }

    return NextResponse.json({
      isAuthenticated: true,
      user: {
        id: user.id,
        username: user.login,
        name: user.name,
        avatar_url: user.avatar_url,
      }
    })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json({ isAuthenticated: false })
  }
}