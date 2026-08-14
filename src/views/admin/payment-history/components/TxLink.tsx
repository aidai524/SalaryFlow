export function TxLink({
  href,
  hash,
}: {
  href: string | null | undefined;
  hash: string | null | undefined;
}) {
  if (!hash) {
    return <span className="font-montserrat text-[14px] text-[#909090]">—</span>;
  }
  if (!href) {
    return (
      <span className="font-montserrat text-[14px] text-[#3f8afb]" title={hash}>
        Tx
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title={hash}
      className="font-montserrat text-[14px] text-[#3f8afb] underline underline-offset-2 hover:opacity-80"
    >
      Tx
    </a>
  );
}
