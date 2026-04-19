import { BookIcon, WebhookIcon } from 'lucide-react'
import type { ReactNode } from 'react'

function DocumentationItem({
  title,
  description,
  icon,
  href,
}: {
  title: string
  description: string
  icon: { icon: ReactNode; id: string }
  href: string
}) {
  return (
    <a
      href={href}
      className='flex flex-col gap-2 rounded-lg border p-6 transition-colors hover:bg-fd-muted'
    >
      <div className='flex items-center gap-2'>
        {icon.icon}
        <h3 className='font-semibold'>{title}</h3>
      </div>
      <p className='text-fd-muted-foreground text-sm'>{description}</p>
    </a>
  )
}

export default function HomePage() {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-6 py-12'>
      <h1 className='text-4xl font-bold'>Welcome to the Docs</h1>
      <p className='text-fd-muted-foreground max-w-xl text-center text-lg'>
        Get started with the documentation, API reference, or changelog.
      </p>
      <div className='mt-8 grid grid-cols-1 gap-4 text-left md:grid-cols-2'>
        <DocumentationItem
          title='Documentation'
          description='Get started with the Fumadocs framework.'
          icon={{ icon: <BookIcon />, id: '(index)' }}
          href='/docs'
        />
        <DocumentationItem
          title='API Reference'
          description='Explore the API reference.'
          icon={{ icon: <WebhookIcon />, id: 'api-reference' }}
          href='/docs/api-reference'
        />
      </div>
    </div>
  )
}