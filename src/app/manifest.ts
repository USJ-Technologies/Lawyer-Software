import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Smart Vakeel — Case Register',
    short_name: 'SmartVakeel',
    description: 'Never miss a hearing date.',
    start_url: '/',
    display: 'standalone',
    background_color: '#efeae0',
    theme_color: '#1c1b19',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
