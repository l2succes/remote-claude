import Link from 'next/link'
import { getAllDocs } from '@/lib/mdx'

interface DocSection {
  title: string
  items: {
    title: string
    href: string
    order?: number
  }[]
}

async function getDocsSidebar(): Promise<DocSection[]> {
  const docs = await getAllDocs()
  
  // Group docs by section
  const sections: Record<string, DocSection> = {
    'Getting Started': { title: 'Getting Started', items: [] },
    'Core Concepts': { title: 'Core Concepts', items: [] },
    'Backends': { title: 'Backends', items: [] },
    'CLI Reference': { title: 'CLI Reference', items: [] },
    'Advanced': { title: 'Advanced', items: [] },
  }
  
  docs.forEach((doc) => {
    const section = doc.section || 'Getting Started'
    if (sections[section]) {
      sections[section].items.push({
        title: doc.title,
        href: `/docs/${doc.slug}`,
        order: doc.order,
      })
    }
  })
  
  // Sort items within each section
  Object.values(sections).forEach((section) => {
    section.items.sort((a, b) => (a.order || 999) - (b.order || 999))
  })
  
  return Object.values(sections).filter((section) => section.items.length > 0)
}

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sections = await getDocsSidebar()
  
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="font-bold text-xl">
              Remote Claude
            </Link>
            <nav className="flex items-center gap-6">
              <Link
                href="/docs"
                className="text-sm font-medium hover:text-primary-400 transition-colors"
              >
                Documentation
              </Link>
              <Link
                href="https://github.com/yourusername/remote-claude"
                className="text-sm font-medium hover:text-primary-400 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </Link>
            </nav>
          </div>
        </div>
      </header>
      
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 lg:h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <nav className="space-y-6">
              {sections.map((section) => (
                <div key={section.title}>
                  <h3 className="font-semibold text-sm uppercase text-gray-400 mb-2">
                    {section.title}
                  </h3>
                  <ul className="space-y-1">
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="block px-3 py-2 text-sm rounded-md hover:bg-gray-800 hover:text-primary-400 transition-colors"
                        >
                          {item.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
          
          {/* Main content */}
          <main className="min-w-0 max-w-4xl">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}