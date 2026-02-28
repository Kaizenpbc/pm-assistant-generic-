import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import { query } from '../db.js';
import type { RowDataPacket } from 'mysql2/promise';
import crypto from 'node:crypto';

interface ClientRow extends RowDataPacket {
  client_id: string;
  client_secret: string | null;
  client_secret_expires_at: number | null;
  client_id_issued_at: number | null;
  redirect_uris: string;
  client_name: string | null;
  client_uri: string | null;
  logo_uri: string | null;
  scope: string | null;
  contacts: string | null;
  tos_uri: string | null;
  policy_uri: string | null;
  token_endpoint_auth_method: string | null;
  grant_types: string | null;
  response_types: string | null;
  software_id: string | null;
  software_version: string | null;
}

function rowToClient(row: ClientRow): OAuthClientInformationFull {
  return {
    client_id: row.client_id,
    client_secret: row.client_secret ?? undefined,
    client_secret_expires_at: row.client_secret_expires_at ?? undefined,
    client_id_issued_at: row.client_id_issued_at ?? undefined,
    // Zod v4's z.url() produces strings at runtime, not URL objects.
    // The SDK's authorize handler compares with .includes(string), so we must return strings.
    redirect_uris: JSON.parse(row.redirect_uris),
    client_name: row.client_name ?? undefined,
    client_uri: row.client_uri ?? undefined,
    logo_uri: row.logo_uri ?? undefined,
    scope: row.scope ?? undefined,
    contacts: row.contacts ? JSON.parse(row.contacts) : undefined,
    tos_uri: row.tos_uri ?? undefined,
    policy_uri: row.policy_uri ?? undefined,
    token_endpoint_auth_method: row.token_endpoint_auth_method ?? undefined,
    grant_types: row.grant_types ? JSON.parse(row.grant_types) : undefined,
    response_types: row.response_types ? JSON.parse(row.response_types) : undefined,
    software_id: row.software_id ?? undefined,
    software_version: row.software_version ?? undefined,
  } as OAuthClientInformationFull;
}

export class DatabaseClientsStore implements OAuthRegisteredClientsStore {
  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    const rows = await query<ClientRow>(
      'SELECT * FROM oauth_clients WHERE client_id = ?',
      [clientId],
    );
    if (rows.length === 0) return undefined;
    return rowToClient(rows[0]);
  }

  async registerClient(
    client: Omit<OAuthClientInformationFull, 'client_id' | 'client_id_issued_at'>,
  ): Promise<OAuthClientInformationFull> {
    const clientId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    const redirectUris = client.redirect_uris.map((u) => u.toString());

    await query(
      `INSERT INTO oauth_clients
       (client_id, client_secret, client_secret_expires_at, client_id_issued_at,
        redirect_uris, client_name, client_uri, logo_uri, scope, contacts,
        tos_uri, policy_uri, token_endpoint_auth_method, grant_types,
        response_types, software_id, software_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        client.client_secret ?? null,
        client.client_secret_expires_at ?? null,
        now,
        JSON.stringify(redirectUris),
        client.client_name ?? null,
        client.client_uri?.toString() ?? null,
        client.logo_uri?.toString() ?? null,
        client.scope ?? null,
        client.contacts ? JSON.stringify(client.contacts) : null,
        client.tos_uri?.toString() ?? null,
        client.policy_uri ?? null,
        client.token_endpoint_auth_method ?? 'none',
        client.grant_types ? JSON.stringify(client.grant_types) : null,
        client.response_types ? JSON.stringify(client.response_types) : null,
        client.software_id ?? null,
        client.software_version ?? null,
      ],
    );

    return {
      ...client,
      client_id: clientId,
      client_id_issued_at: now,
    };
  }
}
