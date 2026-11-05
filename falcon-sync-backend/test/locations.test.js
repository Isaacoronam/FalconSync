import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import request from "supertest";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI =
  process.env.MONGODB_URI_TEST ?? "mongodb://127.0.0.1:27017/falconsync_test";

const { default: app } = await import("../src/app.js");
const { connectDB, disconnectDB } = await import("../src/config/db.js");
const { default: Location } = await import("../src/models/Location.js");

const cathedral = {
  title: "Catedral de Coro",
  slug: "catedral-de-coro",
  category: "religious",
  description:
    "Templo colonial de la ciudad de Coro, ubicado frente a la Plaza Bolívar.",
  location: {
    type: "Point",
    coordinates: [-69.6778073, 11.4075246],
  },
  sourceUrl: "https://www.openstreetmap.org/way/370610638",
  images: ["/images/locations/catedral-de-coro.jpg"],
  isProvisional: false,
};

const plaza = {
  title: "Plaza Bolívar de Coro",
  slug: "plaza-bolivar-de-coro",
  category: "architecture",
  description:
    "Espacio público del casco histórico de Coro, frente a la Catedral.",
  location: {
    type: "Point",
    coordinates: [-69.6781938, 11.4072811],
  },
  sourceUrl: "https://www.openstreetmap.org/way/370610469",
  isProvisional: false,
};

async function seedLocations() {
  await Location.create([cathedral, plaza]);
}

describe("FalconSync API", () => {
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

  it("responde el estado de salud de la API", async () => {
    const response = await request(app).get("/api/health");

    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ok");
  });

  it("devuelve una lista paginada y vacía cuando no hay lugares", async () => {
    const response = await request(app).get("/api/locations");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, []);
    assert.equal(response.body.meta.total, 0);
  });

  it("lista los lugares con su información geoespacial", async () => {
    await seedLocations();

    const response = await request(app).get("/api/locations");

    assert.equal(response.status, 200);
    assert.equal(response.body.meta.total, 2);
    assert.equal(response.body.data.length, 2);

    const catedral = response.body.data.find(
      (item) => item.slug === "catedral-de-coro",
    );
    assert.ok(catedral);
    assert.deepEqual(catedral.location.coordinates, [-69.6778073, 11.4075246]);
    assert.deepEqual(catedral.images, [
      "/images/locations/catedral-de-coro.jpg",
    ]);

    const plaza = response.body.data.find(
      (item) => item.slug === "plaza-bolivar-de-coro",
    );
    assert.ok(plaza);
    assert.deepEqual(plaza.images, []);
  });

  it("filtra los lugares por categoría", async () => {
    await seedLocations();

    const response = await request(app).get(
      "/api/locations?category=religious",
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.meta.total, 1);
    assert.equal(response.body.data[0].slug, "catedral-de-coro");
  });

  it("rechaza una categoría desconocida", async () => {
    const response = await request(app).get(
      "/api/locations?category=inventada",
    );

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "INVALID_CATEGORY");
  });

  it("aplica paginación con límites controlados", async () => {
    await seedLocations();

    const response = await request(app).get("/api/locations?page=1&limit=1");

    assert.equal(response.status, 200);
    assert.equal(response.body.data.length, 1);
    assert.equal(response.body.meta.total, 2);
    assert.equal(response.body.meta.totalPages, 2);
  });

  it("devuelve un lugar por slug y responde 404 si no existe", async () => {
    await seedLocations();

    const found = await request(app).get("/api/locations/catedral-de-coro");
    const missing = await request(app).get("/api/locations/no-existe");

    assert.equal(found.status, 200);
    assert.equal(found.body.data.slug, "catedral-de-coro");
    assert.deepEqual(found.body.data.images, [
      "/images/locations/catedral-de-coro.jpg",
    ]);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error.code, "LOCATION_NOT_FOUND");
  });

  it("busca lugares cercanos usando el índice 2dsphere", async () => {
    await seedLocations();

    const response = await request(app).get(
      "/api/locations/near?lat=11.4075&lng=-69.6778&radius=500",
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.data[0].slug, "catedral-de-coro");
    assert.ok(response.body.data.length >= 2);
  });

  it("rechaza coordenadas inválidas en la búsqueda cercana", async () => {
    const response = await request(app).get(
      "/api/locations/near?lat=200&lng=-69.6778",
    );

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "INVALID_COORDINATES");
  });

  it("rechaza coordenadas inválidas en el modelo", async () => {
    const invalid = new Location({
      ...cathedral,
      slug: "catedral-invalida",
      location: { type: "Point", coordinates: [-200, 11.4] },
    });

    await assert.rejects(() => invalid.validate(), /longitud|coordinates/i);
  });

  it("crea el índice geoespacial de Location", async () => {
    const indexes = await Location.collection.indexes();
    const geoIndex = indexes.find((index) => index.key.location === "2dsphere");

    assert.ok(geoIndex);
  });
});
