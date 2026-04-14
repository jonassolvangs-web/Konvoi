// Vipps ePayment API utility
// Docs: https://developer.vippsmobilepay.com/docs/APIs/epayment-api/

const VIPPS_BASE_URL = process.env.VIPPS_BASE_URL || 'https://apitest.vipps.no';
const VIPPS_CLIENT_ID = process.env.VIPPS_CLIENT_ID || '';
const VIPPS_CLIENT_SECRET = process.env.VIPPS_CLIENT_SECRET || '';
const VIPPS_SUBSCRIPTION_KEY = process.env.VIPPS_SUBSCRIPTION_KEY || '';
const VIPPS_MSN = process.env.VIPPS_MERCHANT_SERIAL_NUMBER || '';

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(`${VIPPS_BASE_URL}/accesstoken/get`, {
    method: 'POST',
    headers: {
      'client_id': VIPPS_CLIENT_ID,
      'client_secret': VIPPS_CLIENT_SECRET,
      'Ocp-Apim-Subscription-Key': VIPPS_SUBSCRIPTION_KEY,
      'Merchant-Serial-Number': VIPPS_MSN,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vipps auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600_000),
  };

  return cachedToken.token;
}

function commonHeaders(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Ocp-Apim-Subscription-Key': VIPPS_SUBSCRIPTION_KEY,
    'Merchant-Serial-Number': VIPPS_MSN,
    'Vipps-System-Name': 'TURBO',
    'Vipps-System-Version': '1.0.0',
  };
}

interface CreatePaymentParams {
  reference: string;
  amountInOre: number;
  customerPhoneNumber: string;
  description: string;
  returnUrl?: string;
  callbackUrl?: string;
}

export async function createPayment({
  reference,
  amountInOre,
  customerPhoneNumber,
  description,
  returnUrl,
  callbackUrl,
}: CreatePaymentParams) {
  const token = await getAccessToken();

  // Calculate VAT (25% MVA, amount is inclusive)
  const totalAmount = amountInOre;
  const vatAmount = Math.round(totalAmount - totalAmount / 1.25);

  const body = {
    amount: {
      currency: 'NOK',
      value: totalAmount,
    },
    paymentMethod: {
      type: 'WALLET',
    },
    customer: {
      phoneNumber: customerPhoneNumber,
    },
    reference,
    userFlow: 'PUSH_MESSAGE',
    paymentDescription: description,
    receipt: {
      orderLines: [
        {
          name: description,
          id: reference,
          totalAmount: totalAmount,
          totalAmountExcludingTax: totalAmount - vatAmount,
          totalTaxAmount: vatAmount,
          taxPercentage: 25,
          unitInfo: {
            unitPrice: totalAmount,
            quantity: '1',
            quantityUnit: 'PCS',
          },
        },
      ],
      bottomLine: {
        currency: 'NOK',
        totalAmount: totalAmount,
        totalTax: vatAmount,
      },
    },
    ...(returnUrl && { returnUrl }),
    ...(callbackUrl && { paymentEvents: [{ url: callbackUrl }] }),
  };

  const res = await fetch(`${VIPPS_BASE_URL}/epayment/v1/payments`, {
    method: 'POST',
    headers: commonHeaders(token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vipps create payment failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getPaymentStatus(reference: string) {
  const token = await getAccessToken();

  const res = await fetch(`${VIPPS_BASE_URL}/epayment/v1/payments/${reference}`, {
    method: 'GET',
    headers: commonHeaders(token),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vipps get status failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function capturePayment(reference: string, amountInOre: number) {
  const token = await getAccessToken();

  const body = {
    modificationAmount: {
      currency: 'NOK',
      value: amountInOre,
    },
  };

  const res = await fetch(`${VIPPS_BASE_URL}/epayment/v1/payments/${reference}/capture`, {
    method: 'POST',
    headers: {
      ...commonHeaders(token),
      'Idempotency-Key': `capture-${reference}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vipps capture failed: ${res.status} ${text}`);
  }

  return res.json();
}
