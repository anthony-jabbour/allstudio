export default function AboutPage() {
  return (
    <main
      id="about-main"
      className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-6 px-6 py-24"
    >
      <p
        id="about-eyebrow"
        className="text-sm tracking-[0.2em] uppercase text-zinc-500"
      >
        Studio profile
      </p>
      <h1
        id="about-heading"
        className="max-w-xl text-4xl leading-tight font-semibold tracking-tight text-zinc-950"
      >
        About Aurora Atelier
      </h1>
      <p id="about-copy" className="max-w-xl text-base leading-7 text-zinc-600">
        Every static route in this Next.js fixture edits real source files on
        disk while keeping preview isolation intact.
      </p>
    </main>
  );
}
