import { DocsLayout } from 'fumadocs-ui/layouts/notebook'
import { baseOptions, linkItems } from '@/lib/layout.shared'
import { source } from '@/lib/source'

export default function Layout({ children }: LayoutProps<'/docs'>) {
  const base = baseOptions()

  return (
    <DocsLayout
      {...base}
      links={linkItems.filter((item) => item.type === 'icon')}
      nav={{
        ...base.nav,
        mode: 'top',
      }}
      tabMode='navbar'
      tree={source.getPageTree()}
    >
      {children}
    </DocsLayout>
  )
}