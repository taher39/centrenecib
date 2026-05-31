import { useEffect } from "react";

type Inv = {
  id: string; number: string; subtotal: number; discount: number; total: number;
  amount_paid: number; payment_type: "full" | "partial"; notes: string | null; issued_at: string;
  clients?: { full_name?: string; phone?: string } | null;
  invoice_items?: { id: string; service_name: string; quantity: number; unit_price: number; total: number }[];
};

type Settings = {
  name?: string; address?: string | null; phone?: string | null; email?: string | null;
  nif?: string | null; nis?: string | null; rc?: string | null; article?: string | null; ai?: string | null;
} | null;

export function InvoicePrintView({ invoice, settings }: { invoice: Inv; settings: Settings }) {
  useEffect(() => {
    // ensure print stylesheet
    if (!document.getElementById("print-style")) {
      const s = document.createElement("style");
      s.id = "print-style";
      s.textContent = `
        @media screen { .print-only { display: none; } }
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only { position: absolute; left: 0; top: 0; width: 100%; padding: 20mm; font-family: 'Cormorant Garamond', serif; color: #111; }
          .print-only table { width: 100%; border-collapse: collapse; }
          .print-only th, .print-only td { border-bottom: 1px solid #ddd; padding: 6px 4px; }
        }
      `;
      document.head.appendChild(s);
    }
  }, []);

  const rem = Number(invoice.total) - Number(invoice.amount_paid);

  return (
    <div style={{ direction: "ltr", maxWidth: 800, margin: "0 auto", fontFamily: "Cormorant Garamond, serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #1f6a4d", paddingBottom: 12 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1f6a4d" }}>{settings?.name ?? "CENTRE NECIB"}</div>
          {settings?.address && <div style={{ fontSize: 12 }}>{settings.address}</div>}
          {settings?.phone && <div style={{ fontSize: 12 }}>Tél: {settings.phone}</div>}
          {settings?.email && <div style={{ fontSize: 12 }}>{settings.email}</div>}
        </div>
        <div style={{ fontSize: 11, textAlign: "right" }}>
          {settings?.nif && <div>NIF: {settings.nif}</div>}
          {settings?.nis && <div>NIS: {settings.nis}</div>}
          {settings?.rc && <div>RC: {settings.rc}</div>}
          {settings?.article && <div>Article: {settings.article}</div>}
          {settings?.ai && <div>AI: {settings.ai}</div>}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
        <div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: 4 }}>FACTURE</div>
          <div>N° {invoice.number}</div>
          <div>Date: {new Date(invoice.issued_at).toLocaleDateString("fr-FR")}</div>
        </div>
        <div>
          <div style={{ fontWeight: 600 }}>Cliente</div>
          <div>{invoice.clients?.full_name}</div>
          {invoice.clients?.phone && <div style={{ fontSize: 12 }}>{invoice.clients.phone}</div>}
        </div>
      </div>

      <table style={{ marginTop: 20 }}>
        <thead>
          <tr style={{ background: "#f0ebe3" }}>
            <th style={{ textAlign: "left" }}>Désignation</th>
            <th>Qté</th>
            <th>P.U.</th>
            <th style={{ textAlign: "right" }}>Montant</th>
          </tr>
        </thead>
        <tbody>
          {(invoice.invoice_items ?? []).map((it) => (
            <tr key={it.id}>
              <td>{it.service_name}</td>
              <td style={{ textAlign: "center" }}>{it.quantity}</td>
              <td style={{ textAlign: "center" }}>{Number(it.unit_price).toLocaleString()}</td>
              <td style={{ textAlign: "right" }}>{Number(it.total).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
        <div style={{ minWidth: 280 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>Sous-total:</span><span>{Number(invoice.subtotal).toLocaleString()} DA</span></div>
          {Number(invoice.discount) > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span>Remise:</span><span>− {Number(invoice.discount).toLocaleString()} DA</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #1f6a4d", marginTop: 6, paddingTop: 6, fontWeight: 700, fontSize: 18 }}><span>Total TTC:</span><span>{Number(invoice.total).toLocaleString()} DA</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}><span>Payé:</span><span>{Number(invoice.amount_paid).toLocaleString()} DA</span></div>
          {rem > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#b00020", fontWeight: 700 }}><span>Reste à payer:</span><span>{rem.toLocaleString()} DA</span></div>}
        </div>
      </div>

      <div style={{ marginTop: 80, display: "flex", justifyContent: "flex-end" }}>
        <div style={{ borderTop: "1px solid #999", paddingTop: 4, width: 220, textAlign: "center", fontSize: 11 }}>Signature &amp; cachet</div>
      </div>
    </div>
  );
}

export function openPrintWindow(_id: string) {
  window.print();
}
