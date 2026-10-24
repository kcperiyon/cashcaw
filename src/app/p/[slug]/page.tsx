import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/payments/price";
import { getPublishedStorefront } from "@/lib/storefront";
import { BuyForm } from "./BuyForm";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getPublishedStorefront(slug);
  if (!store) return { title: "Not found" };
  return { title: store.page.headline, description: store.page.subheadline };
}

function Block({ title, children }: { title: string; children: string }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-xl font-semibold text-neutral-900">{title}</h2>
      <p className="whitespace-pre-wrap leading-relaxed text-neutral-700">{children}</p>
    </section>
  );
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getPublishedStorefront(slug);
  if (!store) notFound();

  const { page } = store;
  const tiers = store.tiers.map((t) => ({
    name: t.name,
    price: t.price,
    description: t.description,
    chargeLabel: t.parsed ? formatMoney(t.parsed.amountMinor, t.parsed.currency) : null,
  }));

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-12 text-center">
        <h1 className="mb-4 text-3xl font-bold leading-tight text-neutral-900 sm:text-4xl">{page.headline}</h1>
        <p className="text-lg text-neutral-600">{page.subheadline}</p>
      </header>

      <Block title="Sound familiar?">{page.copy.problemAgitation}</Block>
      <Block title="Why this works">{page.copy.mechanismExplainer}</Block>
      <Block title="What you get">{page.copy.whatsIncluded}</Block>
      {store.bonuses.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">Bonuses</h2>
          {page.copy.bonusesText && (
            <p className="mb-3 whitespace-pre-wrap leading-relaxed text-neutral-700">{page.copy.bonusesText}</p>
          )}
          <ul className="list-disc space-y-1 pl-5 text-neutral-700">
            {store.bonuses.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </section>
      )}

      <section id="buy" className="mb-10 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold text-neutral-900">Get {store.title}</h2>
        <BuyForm slug={slug} tiers={tiers} cta={page.copy.cta} />
      </section>

      <Block title="Our guarantee">{page.copy.guaranteeText || store.guaranteeText}</Block>

      {page.copy.faq.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-xl font-semibold text-neutral-900">Questions</h2>
          <div className="space-y-4">
            {page.copy.faq.map((item, i) => (
              <div key={i}>
                <h3 className="font-medium text-neutral-900">{item.question}</h3>
                <p className="whitespace-pre-wrap text-neutral-700">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
