import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, before, beforeEach, describe, it } from "node:test";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ??
  "mongodb://127.0.0.1:27017/falconsync_seed_test";

const {
  seedLocations,
  syncLocations,
  syncEditorialContent,
  verifyLocations,
  locations,
} = await import("../scripts/seedLocations.js");
const { connectDB, disconnectDB } = await import("../src/config/db.js");
const { default: Location } = await import("../src/models/Location.js");

describe("Seed de POI", () => {
  before(async () => {
    await connectDB();
    await Location.init();
  });

  beforeEach(async () => {
    await Location.deleteMany({});
  });

  after(async () => {
    await Location.deleteMany({});
    await disconnectDB();
  });

  it("es idempotente, elimina Mirador del Pueblo e incorpora Gelatería El Sol al catálogo", async () => {
    await Location.create({
      ...locations[0],
      title: "Mirador del Pueblo",
      slug: "mirador-del-pueblo",
    });

    const first = await seedLocations();
    const second = await seedLocations();
    const verification = await verifyLocations();
    const count = await Location.countDocuments({});
    const gelateria = await Location.findOne({ slug: "heladeria-el-sol" });
    const removed = await Location.findOne({ slug: "mirador-del-pueblo" });

    assert.equal(first.inserted, locations.length);
    assert.equal(second.inserted, 0);
    assert.equal(second.existing, locations.length);
    assert.equal(count, locations.length);
    assert.equal(gelateria.title, "Gelatería El Sol");
    assert.equal(gelateria.isCatalogVisible, true);
    assert.deepEqual(gelateria.images, ["/images/locations/Gelateria-el-sol.jpeg"]);
    assert.equal(removed, null);
    assert.equal(verification.ok, true);

    await Location.create({
      ...locations[0],
      title: "Mirador del Pueblo",
      slug: "mirador-del-pueblo",
    });

    await Location.updateOne(
      { slug: "parque-nacional-medanos-de-coro" },
      {
        $set: {
          location: {
            type: "Point",
            coordinates: [-69.734390625, 11.6039625],
          },
        },
      },
    );
    await Location.updateOne(
      { slug: "catedral-de-coro" },
      {
        $set: {
          location: {
            type: "Point",
            coordinates: [-69.6777, 11.4076],
          },
        },
      },
    );

    await syncLocations();

    assert.equal(
      await Location.findOne({ slug: "mirador-del-pueblo" }),
      null,
    );
    const syncedPark = await Location.findOne({
      slug: "parque-nacional-medanos-de-coro",
    });
    const unchangedCathedral = await Location.findOne({
      slug: "catedral-de-coro",
    });
    assert.deepEqual(syncedPark.location.coordinates, [-69.6677, 11.437]);
    assert.equal(syncedPark.status, "published");
    assert.equal(syncedPark.isProvisional, false);
    assert.equal(syncedPark.verificationLevel, "unverified");
    assert.equal(syncedPark.checkInRadiusMeters, 200);
    assert.deepEqual(unchangedCathedral.location.coordinates, [-69.6777, 11.4076]);
    assert.equal(
      unchangedCathedral.historicalStory,
      locations.find((location) => location.slug === "catedral-de-coro")
        .historicalStory,
    );
  });

  it("mantiene los 23 POI publicados y con metadatos de publicación coherentes", () => {
    assert.equal(locations.length, 23);
    assert.equal(
      locations.filter((location) => location.status === "published").length,
      23,
    );
    assert.equal(
      locations.filter((location) => location.isProvisional).length,
      0,
    );

    for (const location of locations) {
      assert.ok(
        location.coordinateVerifiedAt,
        `${location.title} debe tener fecha de revisión de coordenadas`,
      );
      assert.ok(
        ["single-source", "unverified"].includes(location.verificationLevel),
        `${location.title} debe declarar un nivel de verificación`,
      );
      assert.ok(
        location.historicalStory?.length >= 100,
        `${location.title} debe tener una reseña editorial ampliada`,
      );
      assert.ok(
        location.interestingFacts?.length >= 2,
        `${location.title} debe tener datos de interés`,
      );
      assert.ok(
        location.interestingFacts.every((fact) => fact.length <= 280),
        `${location.title} tiene datos de interés que exceden el límite`,
      );
      assert.ok(
        location.visitorInfo?.length > 0,
        `${location.title} debe tener información para visitantes`,
      );
      assert.ok(
        location.contentSources?.every((source) => /^https?:\/\//i.test(source)),
        `${location.title} tiene fuentes con formato inválido`,
      );
    }

    const casaMuseo = locations.find(
      (location) => location.slug === "casa-museo-locos-de-la-vela",
    );
    assert.equal(casaMuseo.checkInRadiusMeters, 100);
  });

  it("sincroniza solo el contenido editorial vacío y no borra ni sobrescribe otros datos", async () => {
    for (const location of locations) {
      const base = { ...location };
      delete base.historicalStory;
      delete base.interestingFacts;
      delete base.visitorInfo;
      delete base.contentSources;
      await Location.create(base);
    }

    await Location.create({
      ...locations[0],
      title: "Mirador legado",
      slug: "mirador-legado",
      historicalStory: undefined,
      interestingFacts: [],
      visitorInfo: undefined,
      contentSources: [],
    });

    const result = await syncEditorialContent();
    const cathedral = await Location.findOne({ slug: "catedral-de-coro" });
    const legacy = await Location.findOne({ slug: "mirador-legado" });

    assert.equal(result.updated, locations.length);
    assert.equal(
      cathedral.historicalStory,
      locations.find((location) => location.slug === "catedral-de-coro")
        .historicalStory,
    );
    assert.ok(legacy);
    assert.equal(legacy.historicalStory, undefined);
    assert.equal(
      await Location.countDocuments({}),
      locations.length + 1,
    );

    await Location.updateOne(
      { slug: "catedral-de-coro" },
      { $set: { historicalStory: "Contenido editorial propio" } },
    );
    await assert.rejects(syncEditorialContent(), /no sobrescribir contenido existente/);
    const preservedCathedral = await Location.findOne({
      slug: "catedral-de-coro",
    });
    assert.equal(preservedCathedral.historicalStory, "Contenido editorial propio");
  });

  it("incluye imágenes locales para todos los POI del catálogo y excluye Mirador del Pueblo", () => {
    const catalogLocations = locations.filter(
      (location) => location.isCatalogVisible !== false,
    );

    assert.equal(locations.length, 23);
    assert.equal(catalogLocations.length, 23);
    assert.equal(
      locations.some((location) => location.slug === "mirador-del-pueblo"),
      false,
    );
    assert.deepEqual(
      locations.find(
        (location) => location.slug === "parque-nacional-medanos-de-coro",
      ).location.coordinates,
      [-69.6677, 11.437],
    );

    for (const location of catalogLocations) {
      assert.ok(location.images.length > 0, `${location.title} debe tener imagen`);

      for (const image of location.images) {
        const imagePath = new URL(
          `../../falcon-sync-frontend/public${image}`,
          import.meta.url,
        );
        assert.ok(existsSync(imagePath), `${location.title}: falta ${image}`);
      }
    }
  });
});
