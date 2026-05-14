import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://1v1sw.hackatoa.com',       lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: 'https://1v1sw.hackatoa.com/lobby',  lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
  ]
}
