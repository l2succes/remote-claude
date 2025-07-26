import { logger } from '../utils/logger'

export class AuthManager {
  private validTokens: Set<string>

  constructor() {
    // In production, this would validate against a real auth service
    // For now, we use environment variable tokens
    this.validTokens = new Set()
    
    const tokens = process.env.AGENT_AUTH_TOKENS?.split(',') || []
    tokens.forEach(token => {
      if (token.trim()) {
        this.validTokens.add(token.trim())
      }
    })
    
    // Add a default token for development
    if (this.validTokens.size === 0 && process.env.NODE_ENV !== 'production') {
      this.validTokens.add('dev-token')
      logger.warn('Using default development token')
    }
  }

  async validateToken(token: string): Promise<boolean> {
    if (!token) {
      return false
    }
    
    // In production, this would check against a database or auth service
    const isValid = this.validTokens.has(token)
    
    if (!isValid) {
      logger.warn('Invalid token attempted', { token: token.substring(0, 8) + '...' })
    }
    
    return isValid
  }

  addToken(token: string): void {
    this.validTokens.add(token)
    logger.info('Token added', { token: token.substring(0, 8) + '...' })
  }

  removeToken(token: string): void {
    this.validTokens.delete(token)
    logger.info('Token removed', { token: token.substring(0, 8) + '...' })
  }
}