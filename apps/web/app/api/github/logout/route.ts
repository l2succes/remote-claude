import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true })

  // Clear all GitHub-related cookies
  response.cookies.delete('github_token')
  response.cookies.delete('github_user')
  response.cookies.delete('github_oauth_state')

  return response
}