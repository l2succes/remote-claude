import { notFound } from 'next/navigation'
import { getDocBySlug, getAllDocs, mdxOptions } from '@/lib/mdx'
import { serialize } from 'next-mdx-remote/serialize'
import MDXContent from '@/components/MDXContent'

export async function generateStaticParams() {
  const docs = await getAllDocs()
  return docs.map((doc) => ({
    slug: doc.slug.split('/'),
  }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string[] }
}) {
  const slug = params.slug
  const doc = await getDocBySlug(slug)
  
  if (!doc) {
    return {
      title: 'Documentation - Remote Claude',
    }
  }
  
  return {
    title: `${doc.meta.title} - Remote Claude`,
    description: doc.meta.description,
  }
}

export default async function DocPage({
  params,
}: {
  params: { slug: string[] }
}) {
  const slug = params.slug
  const doc = await getDocBySlug(slug)
  
  if (!doc) {
    notFound()
  }
  
  const mdxSource = await serialize(doc.content, {
    mdxOptions: mdxOptions.mdxOptions,
  })
  
  return (
    <article className="prose prose-invert prose-lg max-w-none">
      <div className="not-prose mb-8 pb-8 border-b border-gray-800">
        <h1 className="text-4xl font-bold mb-3 text-gray-100">{doc.meta.title}</h1>
        {doc.meta.description && (
          <p className="text-xl text-gray-400">{doc.meta.description}</p>
        )}
      </div>
      <MDXContent source={mdxSource} />
    </article>
  )
}