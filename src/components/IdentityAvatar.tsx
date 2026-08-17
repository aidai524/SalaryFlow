import type { CSSProperties } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function gradientFromSeed(seed: string): string {
  const hash = hashSeed(seed || "salaryflow");
  const h1 = hash % 360;
  const h2 = (hash >> 8) % 360;
  const h3 = (hash >> 16) % 360;
  return `linear-gradient(135deg, hsl(${h1} 72% 62%), hsl(${h2} 68% 58%), hsl(${h3} 70% 55%))`;
}

export function identityAvatarSeed(person: {
  id?: string | null;
  email?: string | null;
  name?: string | null;
}): string {
  return String(person.id || person.email || person.name || "avatar").trim() || "avatar";
}

export function IdentityAvatar({
  src,
  seed,
  size = 30,
  className,
  alt = "",
}: {
  src?: string | null;
  seed: string;
  size?: number;
  className?: string;
  alt?: string;
}) {
  const gradient = gradientFromSeed(seed);
  const style = { width: size, height: size } as CSSProperties;

  return (
    <Avatar
      className={cn("size-auto shrink-0 overflow-hidden rounded-full", className)}
      style={style}
    >
      {src ? <AvatarImage src={src} alt={alt} /> : null}
      <AvatarFallback
        className="rounded-full text-[0px]"
        style={{ backgroundImage: gradient }}
        delayMs={src ? 600 : 0}
      >
        {seed.slice(0, 1)}
      </AvatarFallback>
    </Avatar>
  );
}
