import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import http from 'node:http';

/**
 * Reverse-proxy /mcp requests to the local MCP HTTP server on port 3100.
 * Supports POST (JSON-RPC), GET (SSE), and DELETE (session termination).
 */
export async function mcpProxyRoutes(fastify: FastifyInstance) {
  const MCP_PORT = 3100;

  // Collect raw body as a Buffer instead of JSON-parsing it
  fastify.removeAllContentTypeParsers();
  fastify.addContentTypeParser(
    '*',
    { parseAs: 'buffer' },
    (_req: FastifyRequest, body: Buffer, done: (err: null, body: Buffer) => void) => {
      done(null, body);
    },
  );

  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    const headers: Record<string, string> = {};
    if (request.headers['content-type']) {
      headers['content-type'] = request.headers['content-type'] as string;
    }
    if (request.headers['accept']) {
      headers['accept'] = request.headers['accept'] as string;
    }
    if (request.headers['mcp-session-id']) {
      headers['mcp-session-id'] = request.headers['mcp-session-id'] as string;
    }

    const body = request.body as Buffer | undefined;
    if (body && body.length > 0) {
      headers['content-length'] = String(body.length);
    }

    return new Promise<void>((resolve) => {
      const proxyReq = http.request(
        {
          hostname: '127.0.0.1',
          port: MCP_PORT,
          path: '/mcp',
          method: request.method,
          headers,
        },
        (proxyRes) => {
          reply.raw.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
          proxyRes.pipe(reply.raw, { end: true });
          proxyRes.on('end', resolve);
          proxyRes.on('error', () => resolve());
        },
      );

      proxyReq.on('error', (err) => {
        fastify.log.error(err, 'MCP proxy error');
        if (!reply.raw.headersSent) {
          reply.raw.writeHead(502, { 'content-type': 'application/json' });
          reply.raw.end(JSON.stringify({ error: 'MCP server unavailable' }));
        }
        resolve();
      });

      if (body && body.length > 0) {
        proxyReq.end(body);
      } else {
        proxyReq.end();
      }
    });
  };

  fastify.all('/', handler);
}
