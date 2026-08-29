import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { formatINR, formatDate } from "@/src/utils/format";

interface ReceiptData {
  id: string;
  member_name: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  transaction_number?: string | null;
  remarks?: string | null;
}

function buildHtml(p: ReceiptData): string {
  const receiptNo = p.id.slice(0, 8).toUpperCase();
  const rows: [string, string][] = [
    ["Receipt No.", receiptNo],
    ["Date", formatDate(p.payment_date)],
    ["Received From", p.member_name],
    ["Payment Mode", p.payment_mode],
  ];
  if (p.transaction_number) rows.push(["Txn / Ref No.", p.transaction_number]);
  if (p.remarks) rows.push(["Remarks", p.remarks]);

  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td class="k">${k}</td><td class="v">${v}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; margin: 0; padding: 32px; color: #1C1917; }
    .card { max-width: 640px; margin: 0 auto; border: 2px solid #FEE7D3; border-radius: 20px; overflow: hidden; }
    .head { background: linear-gradient(135deg, #EA580C, #F97316); color: #fff; padding: 28px 32px; }
    .mandal { font-size: 22px; font-weight: 800; letter-spacing: .3px; }
    .sub { font-size: 13px; opacity: .9; margin-top: 2px; }
    .badge { display:inline-block; margin-top: 14px; background: rgba(255,255,255,.2); padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight:700; text-transform: uppercase; letter-spacing:1px; }
    .amount { text-align:center; padding: 28px 32px 8px; }
    .amount .lbl { font-size: 13px; color:#78716C; text-transform:uppercase; letter-spacing:1px; }
    .amount .val { font-size: 44px; font-weight: 800; color:#16A34A; margin-top:6px; }
    table { width: 100%; border-collapse: collapse; padding: 0 32px; }
    .wrap { padding: 8px 32px 24px; }
    td { padding: 12px 0; border-bottom: 1px solid #F5F5F4; font-size: 15px; vertical-align: top; }
    td.k { color: #78716C; width: 42%; }
    td.v { color: #1C1917; font-weight: 600; text-align: right; }
    .foot { text-align:center; padding: 18px 32px 30px; color:#A8A29E; font-size: 12px; }
    .thanks { text-align:center; color:#EA580C; font-weight:700; font-size:15px; padding: 4px 32px 0; }
  </style></head>
  <body>
    <div class="card">
      <div class="head">
        <div class="mandal">Kranti Ganesh Mandal</div>
        <div class="sub">2026 · Vargani Payment Receipt</div>
        <div class="badge">Paid</div>
      </div>
      <div class="amount">
        <div class="lbl">Amount Received</div>
        <div class="val">${formatINR(p.amount)}</div>
      </div>
      <div class="wrap">
        <table>${rowsHtml}</table>
      </div>
      <div class="thanks">🙏 Thank you for your contribution</div>
      <div class="foot">This is a computer-generated receipt and does not require a signature.</div>
    </div>
  </body></html>`;
}

/** Generate and share/print a Vargani payment receipt as PDF. */
export async function shareReceipt(p: ReceiptData): Promise<void> {
  const html = buildHtml(p);
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Vargani Receipt", UTI: "com.adobe.pdf" });
  }
}
