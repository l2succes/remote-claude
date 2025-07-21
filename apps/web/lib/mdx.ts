import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
// MDXRemote will be imported directly in the component
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeHighlight from 'rehype-highlight'

const docsDirectory = path.join(process.cwd(), 'content/docs')

export interface DocMeta {
  title: string
  description?: string
  section?: string
  order?: number
  slug: string
}

export interface DocContent {
  meta: DocMeta
  content: string
  source: string
}

export async function getDocBySlug(slug: string[]): Promise<DocContent | null> {
  try {
    const filePath = path.join(docsDirectory, ...slug) + '.mdx'
    const fileContents = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(fileContents)
    
    return {
      meta: {
        ...data,
        slug: slug.join('/'),
      } as DocMeta,
      content,
      source: fileContents,
    }
  } catch (error) {
    return null
  }
}

export async function getAllDocs(): Promise<DocMeta[]> {
  const docs: DocMeta[] = []
  
  function readDocsRecursively(dir: string, basePath: string[] = []) {
    const files = fs.readdirSync(dir)
    
    files.forEach((file) => {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      
      if (stat.isDirectory()) {
        readDocsRecursively(filePath, [...basePath, file])
      } else if (file.endsWith('.mdx')) {
        const fileContents = fs.readFileSync(filePath, 'utf8')
        const { data } = matter(fileContents)
        const slug = [...basePath, file.replace('.mdx', '')].join('/')
        
        docs.push({
          ...data,
          slug,
        } as DocMeta)
      }
    })
  }
  
  if (fs.existsSync(docsDirectory)) {
    readDocsRecursively(docsDirectory)
  }
  
  return docs.sort((a, b) => (a.order || 999) - (b.order || 999))
}

export const mdxOptions = {
  mdxOptions: {
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      rehypeHighlight,
      [
        rehypeAutolinkHeadings,
        {
          properties: {
            className: ['anchor'],
          },
        },
      ],
    ],
  },
}