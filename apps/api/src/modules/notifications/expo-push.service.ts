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

interface ExpoPushResponse {
  data?: ExpoPushTicket | ExpoPushTicket[];
  errors?: Array<{
    code?: string;
    message?: string;
  }>;
}

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";

@Injectable()
export class ExpoPushService {
  async send(message: ExpoPushMessage): Promise<ExpoPushTicket> {
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
      response = await fetch(EXPO_PUSH_SEND_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(message),
      });
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Expo Push API network request failed.",
        details: {
          error: "EXPO_PUSH_NETWORK_ERROR",
        },
      };
    }

    const payload = (await response.json().catch(() => ({}))) as ExpoPushResponse;

    if (!response.ok || payload.errors?.length) {
      const error = payload.errors?.[0];
      return {
        status: "error",
        message:
          error?.message ??
          `Expo Push API request failed with status ${response.status}`,
        details: {
          error: error?.code ?? `HTTP_${response.status}`,
        },
      };
    }

    const ticket = Array.isArray(payload.data) ? payload.data[0] : payload.data;

    return (
      ticket ?? {
        status: "error",
        message: "Expo Push API returned an empty ticket.",
        details: {
          error: "EMPTY_TICKET",
        },
      }
    );
  }
}
