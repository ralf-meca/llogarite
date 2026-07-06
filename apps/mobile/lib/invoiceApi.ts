import { apiFetch, describeHttpError } from './http';

const VERIFY_INVOICE_URL = 'https://efiskalizimi-app.tatime.gov.al/invoice-check/api/verifyInvoice';

export type InvoiceQrParams = {
  iic: string;
  tin: string;
  dateTimeCreated: string;
};

export function parseInvoiceQrUrl(scannedText: string): InvoiceQrParams | null {
  const queryStart = scannedText.indexOf('?');
  if (queryStart === -1) {
    return null;
  }

  const params: Record<string, string> = {};
  for (const pair of scannedText.slice(queryStart + 1).split('&')) {
    const [rawKey, rawValue = ''] = pair.split('=');
    if (!rawKey) {
      continue;
    }
    try {
      params[decodeURIComponent(rawKey).trim()] = decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  const { iic, tin, crtd } = params;
  if (!iic || !tin || !crtd) {
    return null;
  }
  return { iic, tin, dateTimeCreated: crtd };
}

export type InvoiceItem = {
  name: string;
  quantity: number;
  unitPriceBeforeVat: number;
  unitPriceAfterVat: number;
  category?: string;
};

export type InvoiceSeller = {
  name: string;
};

export type InvoiceBuddy = {
  userId: string;
  paid: boolean;
};

export type InvoiceVerificationResult = {
  iic: string;
  dateTimeCreated: string;
  totalPrice: number;
  seller: InvoiceSeller;
  items: InvoiceItem[];
  projectId?: string | null;
  verified?: boolean;
  buddies?: InvoiceBuddy[];
};

export async function verifyInvoice(params: InvoiceQrParams): Promise<InvoiceVerificationResult> {
  const query = new URLSearchParams(params).toString();
  const response = await apiFetch(`${VERIFY_INVOICE_URL}?${query}`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(
      describeHttpError(
        response.status,
        { 404: 'Fatura nuk u gjet. Kontrollo kodin QR.' },
        'Verifikimi i faturës dështoi. Provo përsëri.',
      ),
    );
  }
  return response.json();
}
