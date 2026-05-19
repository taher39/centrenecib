import logo from "@/assets/logo.png";

export function Logo({ size = 56, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={logo}
      alt="Centre Nassib"
      width={size}
      height={size}
      className={`rounded-full object-cover ring-2 ring-primary/20 shadow-md ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
