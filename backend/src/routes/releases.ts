import type { Env } from '../types';
import { queryAll, queryOne, run } from '../lib/db';
import { badRequest, notFound, ok } from '../lib/json';
import { asString, parseJsonBody } from '../lib/validation';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function listReleases(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const game = url.searchParams.get('game');
  const type = url.searchParams.get('type');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const where: string[] = ['release_date >= date("now")'];
  const params: unknown[] = [];

  if (game) {
    where.push('game = ?');
    params.push(game);
  }
  if (type) {
    where.push('product_type = ?');
    params.push(type);
  }
  if (from) {
    if (!DATE_RE.test(from)) return badRequest('Invalid date format. Use YYYY-MM-DD');
    where.push('release_date >= ?');
    params.push(from);
  }
  if (to) {
    if (!DATE_RE.test(to)) return badRequest('Invalid date format. Use YYYY-MM-DD');
    where.push('release_date <= ?');
    params.push(to);
  }

  // Future external sync feeds can upsert data into this same releases table.
  const rows = await queryAll(env.DB, `SELECT * FROM releases WHERE ${where.join(' AND ')} ORDER BY release_date ASC LIMIT 300`, params);
  return ok(rows);
}

export async function createRelease(env: Env, request: Request): Promise<Response> {
  const body = await parseJsonBody<Record<string, unknown>>(request);
  if (body instanceof Response) return body;

  try {
    const game = asString(body.game, 'game', 50, true);
    const releaseName = asString(body.release_name, 'release_name', 120, true);
    const productType = asString(body.product_type, 'product_type', 50);
    const releaseDate = asString(body.release_date, 'release_date', 10, true);
    const sourceUrl = asString(body.source_url, 'source_url', 500);

    if (!releaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
      return badRequest('release_date must use YYYY-MM-DD');
    }

    await run(
      env.DB,
      `INSERT INTO releases (game, release_name, product_type, release_date, source_url)
       VALUES (?, ?, ?, ?, ?)`,
      [game, releaseName, productType, releaseDate, sourceUrl],
    );

    const created = await queryOne(env.DB, 'SELECT * FROM releases WHERE id = last_insert_rowid()');
    return ok(created, 201);
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : 'Invalid release payload');
  }
}

export async function getRelease(env: Env, id: number): Promise<Response> {
  const row = await queryOne(env.DB, 'SELECT * FROM releases WHERE id = ?', [id]);
  if (!row) return notFound('Release not found');
  return ok(row);
}
