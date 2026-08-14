import { chainLogoUrl, tokenLogoUrl } from "@/lib/logo";
import { cn } from "@/lib/utils";

export function TokenChainIcon({
  token,
  network,
  className,
}: {
  token: string;
  network: string;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-block size-5 shrink-0", className)}>
      <img src={tokenLogoUrl(token)} alt="" className="size-5 rounded-full object-cover" />
      <img
        src={chainLogoUrl(network)}
        alt=""
        className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-[2px] border border-white object-cover"
      />
    </span>
  );
}
