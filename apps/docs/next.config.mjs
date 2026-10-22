import { createMDX } from 'fumadocs-mdx/next'

const withMDX = createMDX({
  // `.source` is root-owned in this checkout, so the generator cannot update it.
  outDir: '.source-gen',
})

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  serverExternalPackages: [
    'ts-morph',
    'typescript',
    'oxc-transform',
    'twoslash',
    'shiki',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fumadocs.dev',
      },
    ],
  },
}

export default withMDX(config)