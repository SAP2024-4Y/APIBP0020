// tests/map-api.test.js
'use strict';

const request = require('supertest');

const tmp = require('os').tmpdir() + '/apibp-map-test-' + process.pid + '.db';
process.env.DB_PATH = tmp;

let app;

beforeAll(async () => {
  const { buildApp } = require('../src/app');
  app = await buildApp();
});

afterAll(() => {
  try { require('fs').unlinkSync(tmp); } catch {}
});

describe('GET /api/v1/events/map', () => {
  test('radius search returns nearby events sorted by distance_km with GeoJSON [lon, lat]', async () => {
    const res = await request(app)
      .get('/api/v1/events/map')
      .query({ latitude: 12.975, longitude: 77.606, radius_km: 20 });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe('FeatureCollection');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);

    const first = res.body.items[0];
    // GeoJSON order check: [longitude (~77.6), latitude (~12.9)]
    expect(first.location.type).toBe('Point');
    expect(first.location.coordinates[0]).toBeGreaterThan(70);
    expect(first.location.coordinates[1]).toBeLessThan(20);
    expect(typeof first.distance_km).toBe('number');

    // Verify ascending distance sort
    for (let i = 1; i < res.body.items.length; i++) {
      expect(res.body.items[i].distance_km).toBeGreaterThanOrEqual(
        res.body.items[i - 1].distance_km
      );
    }
  });

  test('bounding-box search returns events inside [min_lon, min_lat, max_lon, max_lat]', async () => {
    const res = await request(app)
      .get('/api/v1/events/map')
      .query({ min_lat: 12.85, min_lon: 77.50, max_lat: 13.05, max_lon: 77.80 });

    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
    for (const item of res.body.items) {
      const [lon, lat] = item.location.coordinates;
      expect(lat).toBeGreaterThanOrEqual(12.85);
      expect(lat).toBeLessThanOrEqual(13.05);
      expect(lon).toBeGreaterThanOrEqual(77.50);
      expect(lon).toBeLessThanOrEqual(77.80);
    }
  });

  test('returns 400 INVALID_COORDINATES for out-of-range or missing params', async () => {
    const r1 = await request(app)
      .get('/api/v1/events/map')
      .query({ latitude: 999, longitude: 77.6, radius_km: 10 });
    expect(r1.status).toBe(400);
    expect(r1.body.error.code).toBe('INVALID_COORDINATES');

    const r2 = await request(app)
      .get('/api/v1/events/map')
      .query({ min_lat: 13.5, min_lon: 77.5, max_lat: 12.5, max_lon: 77.8 });
    expect(r2.status).toBe(400);
    expect(r2.body.error.code).toBe('INVALID_COORDINATES');

    const r3 = await request(app).get('/api/v1/events/map');
    expect(r3.status).toBe(400);
    expect(r3.body.error.code).toBe('INVALID_COORDINATES');
  });
});