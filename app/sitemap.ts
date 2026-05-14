import { MetadataRoute } from 'next'
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: 'https://1v1sw.hackatoa.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 }]
}
