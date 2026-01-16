'use client'

import Terminal from "@/components/Terminal";
import AsciiLogo from "@/components/AsciiLogo";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FaGithub,
  FaBook,
  FaRocket,
  FaCloud,
  FaServer,
  FaTasks,
  FaBell,
} from "react-icons/fa";

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Check if user is already authenticated
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })
  }, [])

  const handleGitHubSignIn = async () => {
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/workspaces`,
        scopes: 'repo read:user',
      },
    })

    if (error) {
      console.error('Error signing in:', error)
      alert('Failed to sign in with GitHub: ' + error.message)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900">
      {/* Navigation */}
      <nav className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-white">Claude Cloud</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/workspaces"
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <FaTasks /> Workspaces
              </Link>
              <Link
                href="/docs"
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <FaBook /> Docs
              </Link>
              <a
                href="https://github.com/l2succes/remote-claude"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <FaGithub /> GitHub
              </a>
              {!loading && (
                user ? (
                  <button
                    onClick={handleSignOut}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Sign Out
                  </button>
                ) : (
                  <button
                    onClick={handleGitHubSignIn}
                    className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
                  >
                    <FaGithub /> Sign In
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-8">
              <AsciiLogo />
            </div>
            <p className="text-xl md:text-2xl text-gray-300 mb-8">
              AI Development in the Cloud
            </p>
            <p className="text-lg text-gray-400 max-w-3xl mx-auto mb-12">
              Run Claude Code tasks remotely on GitHub Codespaces or AWS EC2.
              Save and reuse tasks, manage multiple projects, and get notified
              when tasks complete.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
                <Link
                  href="/workspaces"
                  className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-primary-600/25"
                >
                  <FaTasks /> Go to Workspaces
                </Link>
              ) : (
                <button
                  onClick={handleGitHubSignIn}
                  className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 px-6 rounded-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-primary-600/25"
                >
                  <FaGithub /> Continue with GitHub
                </button>
              )}
              <Link
                href="/docs/quick-start"
                className="inline-flex items-center gap-2 bg-accent-600 hover:bg-accent-700 text-white font-semibold py-3 px-6 rounded-lg transition-all hover:scale-105 hover:shadow-lg hover:shadow-accent-600/25"
              >
                <FaRocket /> Get Started
              </Link>
              <a
                href="https://github.com/l2succes/remote-claude"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg border border-gray-700 transition-all hover:scale-105"
              >
                <FaGithub /> View on GitHub
              </a>
            </div>
          </div>

          {/* Terminal Demo */}
          <div className="mb-20">
            <Terminal />
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            <div className="bg-gray-800/50 backdrop-blur p-6 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors">
              <FaTasks className="text-3xl text-primary-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Task-Based Workflow
              </h3>
              <p className="text-gray-400">
                Save and reuse common tasks. No need to remember complex
                commands.
              </p>
            </div>
            <div className="bg-gray-800/50 backdrop-blur p-6 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors">
              <FaCloud className="text-3xl text-accent-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Multi-Cloud Support
              </h3>
              <p className="text-gray-400">
                Choose between GitHub Codespaces or AWS EC2 based on your needs.
              </p>
            </div>
            <div className="bg-gray-800/50 backdrop-blur p-6 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors">
              <FaServer className="text-3xl text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Auto-Scaling
              </h3>
              <p className="text-gray-400">
                Automatically provision and terminate cloud resources as needed.
              </p>
            </div>
            <div className="bg-gray-800/50 backdrop-blur p-6 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors">
              <FaBell className="text-3xl text-amber-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Smart Notifications
              </h3>
              <p className="text-gray-400">
                Get notified via email, Slack, or webhooks when tasks complete.
              </p>
            </div>
          </div>

          {/* Quick Start */}
          <div className="bg-gray-800 rounded-lg p-8 mb-20">
            <h2 className="text-3xl font-bold text-white mb-6 text-center">
              Quick Start
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-primary-500 font-semibold">1.</span>{" "}
                  Install
                </h3>
                <pre className="bg-gray-900 p-4 rounded-md overflow-x-auto">
                  <code className="text-gray-300">
                    npm install -g remote-claude
                  </code>
                </pre>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-primary-500 font-semibold">2.</span>{" "}
                  Configure
                </h3>
                <pre className="bg-gray-900 p-4 rounded-md overflow-x-auto">
                  <code className="text-gray-300">
                    rclaude config github --token YOUR_TOKEN
                  </code>
                </pre>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="text-primary-500 font-semibold">3.</span> Run
                </h3>
                <pre className="bg-gray-900 p-4 rounded-md overflow-x-auto">
                  <code className="text-gray-300">rclaude run fix-bug</code>
                </pre>
              </div>
            </div>
          </div>

          {/* Backend Comparison */}
          <div className="mb-20">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">
              Choose Your Backend
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                  <FaCloud className="text-primary-500" /> GitHub Codespaces
                </h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Integrated with GitHub repositories</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Pre-configured development environment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Pay-as-you-go pricing</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Best for GitHub-hosted projects</span>
                  </li>
                </ul>
              </div>
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                  <FaServer className="text-accent-500" /> AWS EC2
                </h3>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Flexible instance types and sizes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Spot instances for 90% cost savings</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Works with any Git provider</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">✓</span>
                    <span>Best for compute-intensive tasks</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-700 bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">
              © 2024 Remote Claude. MIT License.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a
                href="https://github.com/l2succes/remote-claude"
                className="text-gray-400 hover:text-white"
              >
                GitHub
              </a>
              <Link href="/docs" className="text-gray-400 hover:text-white">
                Documentation
              </Link>
              <a
                href="https://github.com/l2succes/remote-claude/issues"
                className="text-gray-400 hover:text-white"
              >
                Issues
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
