import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

process.env.NODE_ENV = 'test';

const { adventures } = await import('../scripts/seedAdventures.js');
const { locations } = await import('../scripts/seedLocations.js');

const locationBySlug = new Map(
  locations.map((location) => [location.slug, location]),
);

describe('Seed de aventuras', () => {
  it('define una aventura publicada con paradas reales del catálogo', () => {
    assert.ok(adventures.length >= 1);

    for (const adventure of adventures) {
      assert.equal(adventure.status, 'published');
      assert.match(adventure.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.ok(adventure.summary.length >= 10);
      assert.ok(adventure.summary.length <= 280);
      assert.ok(adventure.description.length >= 20);
      assert.ok(adventure.estimatedMinutes >= 1);
      assert.ok(adventure.stops.length >= 3);

      const slugs = adventure.stops.map((stop) => stop.slug);
      assert.equal(new Set(slugs).size, slugs.length);

      for (const stop of adventure.stops) {
        const location = locationBySlug.get(stop.slug);

        assert.ok(location, `Falta el POI ${stop.slug}`);
        assert.equal(location.status, 'published');
        assert.equal(location.isProvisional, false);
        assert.ok(stop.didacticText.length > 20);
        assert.ok(stop.instructions.length > 10);
      }
    }
  });

  it('usa la portada y la insignia dentro de las rutas de imagen permitidas', () => {
    for (const adventure of adventures) {
      assert.match(
        adventure.coverImage,
        /^\/images\/locations\/[A-Za-z0-9._-]+$/,
      );
      assert.match(
        adventure.badge.image,
        /^\/images\/locations\/[A-Za-z0-9._-]+$/,
      );
    }
  });
});
