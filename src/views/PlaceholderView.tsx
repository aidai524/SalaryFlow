export function PlaceholderView({
  title,
  description = "This page is under construction. Content will be implemented from the Figma design in a follow-up pass.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <section className="rounded-[20px] border border-white bg-[#fdfdfd] p-6 shadow-[0_0_20px_rgba(0,0,0,0.06)] sm:p-8">
      <p className="text-sm font-medium text-[#606060]">DECash</p>
      <h1 className="mt-2 font-[family-name:var(--font-montserrat)] text-2xl font-medium text-black sm:text-[26px]">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#606060]">{description}</p>
      <p className="mt-6 text-sm text-[#606060]">
        See <code className="rounded bg-black/5 px-1.5 py-0.5">docs/page-migration-guide.md</code> for
        the page migration workflow.
      </p>
    </section>
  );
}
