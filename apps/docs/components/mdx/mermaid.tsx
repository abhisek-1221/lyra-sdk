'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

export function Mermaid({ chart }: { chart: string }) {
  const [svg, setSvg] = useState('')

  useEffect(() => {
    const render = async () => {
      const mermaid = (
        await import('mermaid')
      ).default

      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
      })

      const { svg: rendered } = await mermaid.render('mermaid-svg', chart)
      setSvg(rendered)
    }

    render()
  }, [chart])

  return (
    <div
      className='[&_svg]:mx-auto [&_svg]:w-full'
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}