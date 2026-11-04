/**
 * Cliente Mercado Pago — Preapproval (suscripciones)
 */

export type CrearPreapprovalInput = {
  reason: string;
  externalReference: string;
  payerEmail?: string;
  transactionAmount: number;
  currencyId?: string;
  backUrl: string;
};

export type PreapprovalResult = {
  id: string;
  initPoint: string;
  status: string;
};

export interface IMercadoPagoClient {
  crearPreapproval(input: CrearPreapprovalInput): Promise<PreapprovalResult>;
  obtenerPreapproval(id: string): Promise<PreapprovalResult & { status: string }>;
}

export type MercadoPagoClientOptions = {
  accessToken: string | null;
  fetchFn?: typeof fetch;
};

/**
 * Mock: no llama a la API; genera IDs e init_point ficticios
 */
export class MockMercadoPagoClient implements IMercadoPagoClient {
  public created: CrearPreapprovalInput[] = [];
  public statuses = new Map<string, string>();

  async crearPreapproval(
    input: CrearPreapprovalInput
  ): Promise<PreapprovalResult> {
    this.created.push(input);
    const id = `preapproval_mock_${this.created.length}`;
    this.statuses.set(id, 'pending');
    return {
      id,
      initPoint: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${id}`,
      status: 'pending',
    };
  }

  async obtenerPreapproval(
    id: string
  ): Promise<PreapprovalResult & { status: string }> {
    return {
      id,
      initPoint: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${id}`,
      status: this.statuses.get(id) ?? 'pending',
    };
  }

  /** Helper de tests: simular cambio de estado */
  setStatus(id: string, status: string): void {
    this.statuses.set(id, status);
  }
}

/**
 * Cliente real contra api.mercadopago.com
 */
export class MercadoPagoClient implements IMercadoPagoClient {
  private accessToken: string;
  private fetchFn: typeof fetch;

  constructor(options: MercadoPagoClientOptions) {
    if (!options.accessToken) {
      throw new Error('MERCADOPAGO_ACCESS_TOKEN requerido');
    }
    this.accessToken = options.accessToken;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async crearPreapproval(
    input: CrearPreapprovalInput
  ): Promise<PreapprovalResult> {
    const body = {
      reason: input.reason,
      external_reference: input.externalReference,
      payer_email: input.payerEmail ?? 'cliente@ticketaventas.local',
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: input.transactionAmount,
        currency_id: input.currencyId ?? 'ARS',
      },
      back_url: input.backUrl,
      status: 'pending',
    };

    const res = await this.fetchFn(
      'https://api.mercadopago.com/preapproval',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      throw new Error(
        `Mercado Pago preapproval error ${res.status}: ${await res.text()}`
      );
    }

    const json = (await res.json()) as {
      id: string;
      init_point?: string;
      sandbox_init_point?: string;
      status?: string;
    };

    return {
      id: json.id,
      initPoint: json.init_point ?? json.sandbox_init_point ?? '',
      status: json.status ?? 'pending',
    };
  }

  async obtenerPreapproval(
    id: string
  ): Promise<PreapprovalResult & { status: string }> {
    const res = await this.fetchFn(
      `https://api.mercadopago.com/preapproval/${id}`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      }
    );
    if (!res.ok) {
      throw new Error(
        `Mercado Pago get preapproval ${res.status}: ${await res.text()}`
      );
    }
    const json = (await res.json()) as {
      id: string;
      init_point?: string;
      sandbox_init_point?: string;
      status?: string;
    };
    return {
      id: json.id,
      initPoint: json.init_point ?? json.sandbox_init_point ?? '',
      status: json.status ?? 'unknown',
    };
  }
}

export function createMercadoPagoClient(
  options: MercadoPagoClientOptions
): IMercadoPagoClient {
  if (options.accessToken) {
    return new MercadoPagoClient(options);
  }
  console.warn('[mercadopago] Sin ACCESS_TOKEN: usando MockMercadoPagoClient');
  return new MockMercadoPagoClient();
}
