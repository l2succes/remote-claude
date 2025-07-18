'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface TerminalCommand {
  input: string
  output: string
  delay: number
}

const commands: TerminalCommand[] = [
  {
    input: 'npm install -g remote-claude',
    output: `\n+ remote-claude@1.0.0\nadded 142 packages in 8.429s\n✅ Installed remote-claude@latest\n`,
    delay: 1500
  },
  {
    input: 'rclaude init',
    output: `🚀 Initializing Remote Claude for this project\n\n? Default compute backend: (Use arrow keys)\n❯ GitHub Codespaces - Cloud development environments\n  AWS EC2 - Scalable cloud compute instances\n\n✅ Created .rclaude.json\n`,
    delay: 2000
  },
  {
    input: 'rclaude run fix-auth-bug',
    output: `⚠️  Task 'fix-auth-bug' not found in registry\n\n? Would you like to create a new task with ID 'fix-auth-bug'? (Y/n) Y\n\n? Task name: Fix Authentication Bug\n? Task description: Debug and fix the login authentication issue\n? Repository: myorg/web-app\n\n✅ Task created successfully!\n🚀 Starting remote Claude Code task...\n📍 Provider: GitHub Codespaces\n⏱️  Timeout: 1800s\n\n🔄 Creating codespace...\n✅ Codespace created!\n📦 Installing Claude Code...\n🤖 Executing task...\n\n✅ Task completed successfully!\n`,
    delay: 3000
  },
  {
    input: 'rclaude tasks --recent',
    output: `📋 Recently used tasks:\n\n1. fix-auth-bug - Fix Authentication Bug\n   Debug and fix the login authentication issue\n   📁 myorg/web-app (main) last run 2 minutes ago (1 run)\n   ☁️  codespace (basicLinux32gb)\n`,
    delay: 1000
  }
]

export default function Terminal() {
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0)
  const [currentInput, setCurrentInput] = useState('')
  const [currentOutput, setCurrentOutput] = useState('')
  const [isTyping, setIsTyping] = useState(true)
  const [commandHistory, setCommandHistory] = useState<Array<{ input: string; output: string }>>([])

  useEffect(() => {
    if (currentCommandIndex >= commands.length) {
      // Reset and loop
      setTimeout(() => {
        setCurrentCommandIndex(0)
        setCommandHistory([])
        setCurrentInput('')
        setCurrentOutput('')
        setIsTyping(true)
      }, 3000)
      return
    }

    const command = commands[currentCommandIndex]
    let inputIndex = 0
    let outputIndex = 0

    // Type the input
    const inputInterval = setInterval(() => {
      if (inputIndex < command.input.length) {
        setCurrentInput(command.input.slice(0, inputIndex + 1))
        inputIndex++
      } else {
        clearInterval(inputInterval)
        setIsTyping(false)
        
        // After input is complete, show output with delay
        setTimeout(() => {
          const outputInterval = setInterval(() => {
            if (outputIndex < command.output.length) {
              setCurrentOutput(command.output.slice(0, outputIndex + 1))
              outputIndex += Math.floor(Math.random() * 3) + 1 // Variable speed for more natural feel
            } else {
              clearInterval(outputInterval)
              
              // Move to history and next command
              setTimeout(() => {
                setCommandHistory(prev => [...prev, { input: command.input, output: command.output }])
                setCurrentInput('')
                setCurrentOutput('')
                setIsTyping(true)
                setCurrentCommandIndex(prev => prev + 1)
              }, command.delay)
            }
          }, 10)
        }, 500)
      }
    }, 50)

    return () => {
      clearInterval(inputInterval)
    }
  }, [currentCommandIndex])

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="terminal-gradient rounded-lg shadow-2xl overflow-hidden border border-gray-800">
        {/* Terminal Header */}
        <div className="bg-gray-800 px-4 py-2 flex items-center">
          <div className="flex space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <div className="flex-1 text-center">
            <span className="text-gray-400 text-sm font-mono">remote-claude@main</span>
          </div>
        </div>
        
        {/* Terminal Body */}
        <div className="p-4 h-[500px] overflow-y-auto font-mono text-sm leading-relaxed">
          {/* Command History */}
          {commandHistory.map((cmd, index) => (
            <div key={index} className="mb-4">
              <div className="flex items-center">
                <span className="text-terminal-prompt mr-2">$</span>
                <span className="text-white">{cmd.input}</span>
              </div>
              <div className="text-gray-300 whitespace-pre-wrap mt-1">{cmd.output}</div>
            </div>
          ))}
          
          {/* Current Command */}
          {currentInput && (
            <div className="mb-4">
              <div className="flex items-center">
                <span className="text-terminal-prompt mr-2">$</span>
                <span className="text-white">
                  {currentInput}
                  {isTyping && (
                    <motion.span
                      className="inline-block w-2 h-4 bg-white ml-1"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                    />
                  )}
                </span>
              </div>
              {currentOutput && (
                <div className="text-gray-300 whitespace-pre-wrap mt-1">{currentOutput}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}