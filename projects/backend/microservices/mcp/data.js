import Adventure from '../../databases/models/Adventure.js';
import AdventureStop from '../../databases/models/AdventureStop.js';
import Location from '../../databases/models/Location.js';
import { HttpError } from '../../helpers/HttpError.js';

export const ROUTE_DISCLAIMER =
  'Recorrido recomendado con paradas registradas. No es una ruta verificada paso a paso ni incluye navegación giro a giro.';

const PUBLIC_LOCATION_FILTER = Object.freeze({
  status: 'published',
  deletedAt: null,
  isProvisional: { $ne: true },
  isCatalogVisible: { $ne: false },
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function coordinatesOf(location) {
  const coordinates = location?.location?.coordinates;

  if (
    !Array.isArray(coordinates) ||
    coordinates.length !== 2 ||
    !coordinates.every((value) => Number.isFinite(value))
  ) {
    return null;
  }

  return {
    latitude: coordinates[1],
    longitude: coordinates[0],
  };
}

function mapUrlFor(coordinates) {
  if (!coordinates) {
    return null;
  }

  return `https://www.openstreetmap.org/?mlat=${coordinates.latitude}&mlon=${coordinates.longitude}#map=18/${coordinates.latitude}/${coordinates.longitude}`;
}

function publicPoi(location) {
  return {
    id: location._id.toString(),
    slug: location.slug,
    title: location.title,
    category: location.category,
    address: location.address ?? null,
    coordinates: coordinatesOf(location),
  };
}

export async function findPoisByText(text, limit = 5) {
  const pattern = new RegExp(escapeRegex(text), 'i');
  const locations = await Location.find({
    ...PUBLIC_LOCATION_FILTER,
    $or: [
      { title: pattern },
      { slug: pattern },
      { address: pattern },
    ],
  })
    .select('title slug category address location')
    .sort({ title: 1 })
    .limit(limit)
    .lean();

  return locations.map(publicPoi);
}

export async function findNearbyPois({ latitude, longitude, limit = 3 }) {
  const locations = await Location.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        distanceField: 'distanceMeters',
        maxDistance: 2000,
        spherical: true,
        query: { ...PUBLIC_LOCATION_FILTER },
      },
    },
    { $limit: limit },
    {
      $project: {
        title: 1,
        slug: 1,
        category: 1,
        address: 1,
        location: 1,
        distanceMeters: 1,
      },
    },
  ]);

  return locations.map((location) => ({
    ...publicPoi(location),
    distanceMeters: Math.round(location.distanceMeters),
  }));
}

export async function listPublishedRoutes() {
  const routes = await Adventure.find({ status: 'published', deletedAt: null })
    .select('slug title summary difficulty estimatedMinutes')
    .sort({ title: 1 })
    .limit(10)
    .lean();

  return Promise.all(
    routes.map(async (route) => ({
      slug: route.slug,
      title: route.title,
      summary: route.summary,
      difficulty: route.difficulty,
      estimatedMinutes: route.estimatedMinutes,
      stopsCount: await AdventureStop.countDocuments({ adventure: route._id }),
      disclaimer: ROUTE_DISCLAIMER,
    })),
  );
}

export async function getPublishedRoute(slug) {
  const route = await Adventure.findOne({
    slug,
    status: 'published',
    deletedAt: null,
  })
    .select('slug title summary description difficulty estimatedMinutes')
    .lean();

  if (!route) {
    throw new HttpError(
      404,
      'ROUTE_NOT_FOUND',
      'No se encontró el recorrido solicitado.',
    );
  }

  const stops = await AdventureStop.find({ adventure: route._id })
    .sort({ order: 1 })
    .populate({
      path: 'location',
      select: 'title slug category address location',
      match: PUBLIC_LOCATION_FILTER,
    })
    .limit(12);

  return {
    slug: route.slug,
    title: route.title,
    summary: route.summary,
    description: route.description.slice(0, 2000),
    difficulty: route.difficulty,
    estimatedMinutes: route.estimatedMinutes,
    disclaimer: ROUTE_DISCLAIMER,
    stops: stops
      .filter((stop) => stop.location)
      .map((stop) => {
        const coordinates = coordinatesOf(stop.location);

        return {
          order: stop.order,
          title: stop.location.title,
          slug: stop.location.slug,
          category: stop.location.category,
          address: stop.location.address ?? null,
          coordinates,
          mapUrl: mapUrlFor(coordinates),
          didacticText: stop.didacticText?.slice(0, 600) ?? null,
          instructions: stop.instructions?.slice(0, 600) ?? null,
        };
      }),
  };
}

export async function findPublishedPoiBySlugOrId({ slug, id }) {
  const filter = { ...PUBLIC_LOCATION_FILTER };

  if (id) {
    filter._id = id;
  } else {
    filter.slug = slug;
  }

  const location = await Location.findOne(filter)
    .select('_id slug title category address location')
    .lean();

  if (!location) {
    throw new HttpError(
      404,
      'POI_NOT_FOUND',
      'No se encontró el lugar indicado entre los publicados.',
    );
  }

  return location;
}
