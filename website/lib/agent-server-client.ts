// Convert ws:// to http:// for HTTP requests
const wsUrl = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || 'ws://localhost:8080';
const AGENT_SERVER_URL = wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');

export class AgentServerClient {
  static async triggerClone(params: {
    workspaceId: string;
    repoUrl: string;
    diskPath: string;
    githubToken: string;
  }): Promise<void> {
    const response = await fetch(`${AGENT_SERVER_URL}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to trigger clone');
    }
  }

  static async getHealth(): Promise<any> {
    const response = await fetch(`${AGENT_SERVER_URL}/health`);
    return response.json();
  }
}
