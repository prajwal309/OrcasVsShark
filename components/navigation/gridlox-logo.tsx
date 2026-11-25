import Image from "next/image";

export const gridLoxLogo = {
  url: "/logo/logo.png",
  width: 1062,
  height: 1008,
  alt: "GridLox Games",
};

const sizes = {
  header: "(max-width: 700px) 48px, 56px",
  landing: "(max-width: 600px) 136px, (max-width: 900px) 184px, 224px",
  footer: "36px",
};

export function GridLoxLogo({ variant }: { variant: keyof typeof sizes }) {
  return (
    <Image
      className={`gridlox-logo gridlox-logo--${variant}`}
      src={gridLoxLogo.url}
      alt={gridLoxLogo.alt}
      width={gridLoxLogo.width}
      height={gridLoxLogo.height}
      sizes={sizes[variant]}
      quality={90}
      preload={variant === "landing"}
    />
  );
}
