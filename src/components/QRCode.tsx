interface Props {
  url: string;
  size?: number;
  className?: string;
}

export function QRCode({ url, size = 128, className }: Props) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&margin=10`;
  return <img src={src} alt={`QR ${url}`} width={size} height={size} className={className} loading="lazy" />;
}

export function useQRCodeUrl(url: string, size = 256) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&margin=10`;
}
