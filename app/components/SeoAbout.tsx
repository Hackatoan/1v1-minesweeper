// Server-rendered how-to + FAQ under the landing card. The landing itself is mostly
// interactive controls, so this is the crawlable copy (and FAQPage schema) for the page.
type About = {
  heading: string
  intro: string
  how: string[]
  faqHeading: string
  faq: { q: string; a: string }[]
}

export function SeoAbout({ about }: { about: About }) {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: about.faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }
  return (
    <section className="w-full max-w-2xl mx-auto px-6 pb-28 text-pink-200/70 text-sm leading-relaxed">
      <h2 className="text-xl font-bold text-pink-100 mb-3">{about.heading}</h2>
      <p className="mb-4">{about.intro}</p>
      <ul className="list-disc pl-5 space-y-2 mb-8">
        {about.how.map((h) => <li key={h}>{h}</li>)}
      </ul>
      <h2 className="text-xl font-bold text-pink-100 mb-3">{about.faqHeading}</h2>
      <dl className="space-y-4">
        {about.faq.map(({ q, a }) => (
          <div key={q}>
            <dt className="font-semibold text-pink-100">{q}</dt>
            <dd>{a}</dd>
          </div>
        ))}
      </dl>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, '\\u003c') }} />
    </section>
  )
}
