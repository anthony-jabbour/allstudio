import { ServiceBadge } from "@/components/service-badge";
import { SiteFooter } from "@/components/site-footer";

const highlightWork = true;

export default function Home() {
  return (
    <main className="min-h-full text-slate-900 dark:text-slate-100">
      <section
        id="hero"
        className="mx-auto grid max-w-5xl gap-8 px-6 py-20 md:grid-cols-2 md:items-center lg:py-28"
      >
        <div className="flex flex-col gap-6">
          <h1
            id="harbor-heading"
            className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
          >
            Harbor Studio
          </h1>
          <p className="text-base text-slate-600 md:text-lg dark:text-slate-300">
            Brand and web design for independent makers.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              id="harbor-cta"
              href="#services"
              className="rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-500 focus-visible:outline-2 focus-visible:outline-sky-600"
            >
              Book a call
            </a>
            <button
              id="harbor-secondary"
              type="button"
              className={`rounded-full border px-5 py-3 text-sm ${highlightWork ? "border-sky-600 text-sky-700" : "border-slate-300"}`}
            >
              See our work
            </button>
          </div>
        </div>
        <ul id="services" className="grid gap-3 sm:grid-cols-2">
          <li className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <ServiceBadge label="New" isNew />
            <p className="mt-3 font-medium">Identity systems</p>
          </li>
          <li className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <ServiceBadge label="Core" isNew={false} />
            <p className="mt-3 font-medium">Marketing sites</p>
          </li>
        </ul>
      </section>
      <SiteFooter />
    </main>
  );
}
