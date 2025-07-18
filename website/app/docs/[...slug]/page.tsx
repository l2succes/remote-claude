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
    <>
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{doc.meta.title}</h1>
        {doc.meta.description && (
          <p className="text-xl text-gray-400">{doc.meta.description}</p>
        )}
      </div>
      <div className="prose-headings:scroll-mt-20">
        <MDXContent source={mdxSource} />
      </div>
    </>
  )
}