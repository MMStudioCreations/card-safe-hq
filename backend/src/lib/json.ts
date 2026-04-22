export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

export function ok(data: unknown, status = 200, headers?: HeadersInit): Response {
  return json({ ok: true, data }, status, headers);
}

export function error(errorMessage: string, status = 400): Response {
  return json({ ok: false, error: errorMessage }, status);
}

export function badRequest(message = 'Bad request'): Response {
  return error(message, 400);
}

export function unauthorized(message = 'Unauthorized'): Response {
  return error(message, 401);
}

export function forbidden(message = 'Forbidden'): Response {
  return error(message, 403);
}

export function notFound(message = 'Not found'): Response {
  return error(message, 404);
}

export function serverError(message = 'Internal server error'): Response {
  return error(message, 500);
}

export function tooManyRequests(message = 'Too many requests'): Response {
  return error(message, 429);
}
