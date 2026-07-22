import { Injectable } from "@nestjs/common";

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string | number | boolean | null>;
}

export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
}

export interface ExpoPushReceipt {
  status: "ok" | "error";
  message?: string;
  details?: {
    error?: string;
  };
}

interface ExpoPushResponse {
  data?: ExpoPushTicket | ExpoPushTicket[];
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
}

interface ExpoPushReceiptsResponse {
  data?: Record<string, ExpoPushReceipt>;
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
}

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

@Injectable()
export class ExpoPushService {
  async send(message: ExpoPushMessage): Promise<ExpoPushTicket> {
    const tickets = await this.sendMany([message]);
    return (
      tickets[0] ?? {
        status: "error",
        message: "Expo Push API returned an empty ticket.",
        details: {
          error: "EMPTY_TICKET",
        },
      }
    );
  }

  /** Expo accepts up to 100 messages per request. */
  async sendMany(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    if (messages.length === 0) {
      return [];
    }

    const tickets: ExpoPushTicket[] = [];

    for (let offset = 0; offset < messages.length; offset += 100) {
      const chunk = messages.slice(offset, offset + 100);
      const payload = await this.postJson<ExpoPushResponse>(
        EXPO_PUSH_SEND_URL,
        chunk,
      );

      if (!payload.ok) {
        tickets.push(
          ...chunk.map(() => payload.ticket),
        );
        continue;
      }

      const chunkTickets = Array.isArray(payload.body.data)
        ? payload.body.data
        : payload.body.data
          ? [payload.body.data]
          : [];

      for (let index = 0; index < chunk.length; index += 1) {
        tickets.push(
          chunkTickets[index] ?? {
            status: "error",
            message: "Expo Push API returned an empty ticket.",
            details: {
              error: "EMPTY_TICKET",
            },
          },
        );
      }
    }

    return tickets;
  }

  async getReceipts(
    ids: string[],
  ): Promise<Record<string, ExpoPushReceipt>> {
    if (ids.length === 0) {
      return {};
    }

    const payload = await this.postJson<ExpoPushReceiptsResponse>(
      EXPO_PUSH_RECEIPTS_URL,
      { ids },
    );

    if (!payload.ok) {
      return {};
    }

    return payload.body.data ?? {};
  }

  private async postJson<T extends { errors?: Array<{ code?: string; message?: string }> }>(
    url: string,
    body: unknown,
  ): Promise<
    | { ok: true; body: T }
    | { ok: false; ticket: ExpoPushTicket }
  > {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    };
    const accessToken = process.env.EXPO_PUSH_ACCESS_TOKEN;

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch (error) {
      return {
        ok: false,
        ticket: {
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Expo Push API network request failed.",
          details: {
            error: "EXPO_PUSH_NETWORK_ERROR",
          },
        },
      };
    }

    const responseBody = (await response.json().catch(() => ({}))) as T;

    if (!response.ok || responseBody.errors?.length) {
      const error = responseBody.errors?.[0];
      return {
        ok: false,
        ticket: {
          status: "error",
          message:
            error?.message ??
            `Expo Push API request failed with status ${response.status}`,
          details: {
            error: error?.code ?? `HTTP_${response.status}`,
          },
        },
      };
    }

    return { ok: true, body: responseBody };
  }
}
