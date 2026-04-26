import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function stripOptionalQuotes(value) {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function parseViteDefaultsFromEnvExample() {
    const filePath = resolve(process.cwd(), '.env.example');
    if (!existsSync(filePath))
        return {};
    const raw = readFileSync(filePath, 'utf8');
    const entries = {};
    raw.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            return;
        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex <= 0)
            return;
        const key = trimmed.slice(0, separatorIndex).trim();
        if (!key.startsWith('VITE_'))
            return;
        const value = stripOptionalQuotes(trimmed.slice(separatorIndex + 1));
        entries[key] = value;
    });
    return entries;
}

const viteEnvDefaults = parseViteDefaultsFromEnvExample();

function createJsonResponse(res) {
    let statusCode = 200;
    return {
        status(code) {
            statusCode = code;
            return this;
        },
        json(payload) {
            if (!res.headersSent) {
                res.statusCode = statusCode;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
            }
            res.end(JSON.stringify(payload));
        },
    };
}

async function readRequestBody(req) {
    return await new Promise((resolveBody, rejectBody) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
        req.on('error', rejectBody);
    });
}

function emailApiDevPlugin() {
    return {
        name: 'develogic-email-api-dev-routes',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                if (!req.url) {
                    next();
                    return;
                }

                const requestUrl = new URL(req.url, 'http://localhost');
                const pathname = requestUrl.pathname;
                if (
                    pathname !== '/api/email/capabilities' &&
                    pathname !== '/api/email/send' &&
                    pathname !== '/api/public/invoice-payment/context' &&
                    pathname !== '/api/public/invoice-payment/submit'
                ) {
                    next();
                    return;
                }

                try {
                    const response = createJsonResponse(res);

                    if (pathname === '/api/email/send' || pathname === '/api/public/invoice-payment/submit') {
                        const rawBody = await readRequestBody(req);
                        if (rawBody.trim().length > 0) {
                            try {
                                req.body = JSON.parse(rawBody);
                            } catch {
                                response.status(400).json({
                                    ok: false,
                                    errorCode: 'INVALID_JSON',
                                    errorMessage: 'Request body must be valid JSON.',
                                });
                                return;
                            }
                        } else {
                            req.body = undefined;
                        }

                        if (pathname === '/api/email/send') {
                            const { default: sendHandler } = await import('./api/email/send.js');
                            await sendHandler(req, response);
                            return;
                        }

                        const { default: publicSubmitHandler } = await import('./api/public/invoice-payment/submit.js');
                        await publicSubmitHandler(req, response);
                        return;
                    }

                    if (pathname === '/api/public/invoice-payment/context') {
                        req.query = Object.fromEntries(requestUrl.searchParams.entries());
                        const { default: publicContextHandler } = await import('./api/public/invoice-payment/context.js');
                        await publicContextHandler(req, response);
                        return;
                    }

                    const { default: capabilitiesHandler } = await import('./api/email/capabilities.js');
                    await capabilitiesHandler(req, response);
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Email API middleware failed unexpectedly.';
                    if (!res.headersSent) {
                        res.statusCode = 500;
                        res.setHeader('Content-Type', 'application/json; charset=utf-8');
                    }
                    res.end(
                        JSON.stringify({
                            ok: false,
                            errorCode: 'EMAIL_API_MIDDLEWARE_ERROR',
                            errorMessage: message,
                        }),
                    );
                }
            });
        },
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    Object.assign(process.env, env);

    return {
        plugins: [react(), emailApiDevPlugin()],
        define: {
            __ENV_EXAMPLE__: JSON.stringify(viteEnvDefaults),
        },
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url)),
            },
        },
    };
});
