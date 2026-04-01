import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  status?: "online" | "away" | "busy" | "offline";
  online?: boolean;
  href?: string;
  className?: string;
  imageClassName?: string;
}

const statusClassMap: Record<NonNullable<AvatarProps["status"]>, string> = {
  online: "bg-green-500",
  away: "bg-yellow-500",
  busy: "bg-red-500",
  offline: "bg-gray-400",
};

const getFallbackAvatarUrl = (name: string, size: number) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=06b6d4&color=ffffff&size=${Math.round(size)}`;

export function Avatar({
  src,
  name = "Lensaya User",
  size = 40,
  status,
  online,
  href,
  className = "",
  imageClassName = "",
}: AvatarProps) {
  const normalizedSize = Math.max(16, Number(size) || 40);
  const resolvedName = String(name || "Lensaya User").trim() || "Lensaya User";
  const fallbackSrc = useMemo(
    () => getFallbackAvatarUrl(resolvedName, normalizedSize * 2),
    [normalizedSize, resolvedName]
  );
  const resolvedSrc = src || fallbackSrc;
  const [imageSrc, setImageSrc] = useState(resolvedSrc);

  useEffect(() => {
    setImageSrc(resolvedSrc);
  }, [resolvedSrc]);

  const wrapperStyle: CSSProperties = {
    width: `${normalizedSize}px`,
    height: `${normalizedSize}px`,
  };

  const avatarNode = (
    <span
      className={`relative inline-flex items-center justify-center rounded-full ${className}`}
      style={wrapperStyle}
    >
      <img
        src={imageSrc}
        alt={resolvedName}
        className={`w-full h-full rounded-full object-cover border border-gray-200 shadow-sm bg-gray-100 ${imageClassName}`}
        onError={() => {
          if (imageSrc !== fallbackSrc) {
            setImageSrc(fallbackSrc);
          }
        }}
      />

      {status ? (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${statusClassMap[status]}`}
          aria-hidden="true"
        />
      ) : null}

      {online ? (
        <span
          className="absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white bg-green-500"
          aria-hidden="true"
        />
      ) : null}
    </span>
  );

  if (!href) {
    return avatarNode;
  }

  return (
    <a href={href} className="inline-flex" aria-label={`${resolvedName} profile`}>
      {avatarNode}
    </a>
  );
}

export type { AvatarProps };
