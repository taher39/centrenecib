import { useEffect, useRef, useState } from "react";
import QRCodeLib from "qrcode";

interface Props {
  url: string;
  size?: number;
  className?: string;
}

export function QRCode({ url, size = 128, className }: Props) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    QRCodeLib.toDataURL(url, { width: size * 2, margin: 1 }).then(setDataUrl).catch(() => {});
  }, [url, size]);

  if (!dataUrl) return <div className={className} style={{ width: size, height: size }} />;
  return <img src={dataUrl} alt={`QR ${url}`} width={size} height={size} className={className} />;
}

export function useQRCodeUrl(url: string, size = 256) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    QRCodeLib.toDataURL(url, { width: size * 2, margin: 1 }).then(setDataUrl).catch(() => {});
  }, [url, size]);
  return dataUrl;
}
