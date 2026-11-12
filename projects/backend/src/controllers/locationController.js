import Location, {
  LOCATION_CATEGORIES,
  LOCATION_CIRCUITS,
  LOCATION_TAGS,
} from '../models/Location.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const DEFAULT_RADIUS_METERS = 1000;
const MAX_RADIUS_METERS = 50000;

function includeProvisionalLocations(value) {
  if (value === undefined || value === 'false') {
    return false;
  }

  if (value === 'true') {
    return true;
  }

  return null;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCoordinate(value, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

export async function listLocations(request, response) {
  const includeProvisional = includeProvisionalLocations(
    request.query.includeProvisional,
  );

  if (includeProvisional === null) {
    return response.status(400).json({
      error: {
        code: 'INVALID_INCLUDE_PROVISIONAL',
        message: 'includeProvisional solo admite true o false',
      },
    });
  }

  const page = parsePositiveInteger(request.query.page, 1);
  const limit = Math.min(
    parsePositiveInteger(request.query.limit, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );

  const filter = {
    deletedAt: null,
    isCatalogVisible: { $ne: false },
    $or: includeProvisional
      ? [
          { status: 'published', isProvisional: { $ne: true } },
          { status: 'draft', isProvisional: true },
        ]
      : [{ status: 'published', isProvisional: { $ne: true } }],
  };

  if (request.query.category) {
    if (!LOCATION_CATEGORIES.includes(request.query.category)) {
      return response.status(400).json({
        error: {
          code: 'INVALID_CATEGORY',
          message: `Categoría no válida. Valores permitidos: ${LOCATION_CATEGORIES.join(', ')}`,
        },
      });
    }

    filter.category = request.query.category;
  }

  if (request.query.circuit) {
    if (!LOCATION_CIRCUITS.includes(request.query.circuit)) {
      return response.status(400).json({
        error: {
          code: 'INVALID_CIRCUIT',
          message: `Circuito no válido. Valores permitidos: ${LOCATION_CIRCUITS.join(', ')}`,
        },
      });
    }

    filter.circuits = request.query.circuit;
  }

  if (request.query.tag) {
    if (!LOCATION_TAGS.includes(request.query.tag)) {
      return response.status(400).json({
        error: {
          code: 'INVALID_TAG',
          message: `Etiqueta no válida. Valores permitidos: ${LOCATION_TAGS.join(', ')}`,
        },
      });
    }

    filter.tags = request.query.tag;
  }

  const [locations, total] = await Promise.all([
    Location.find(filter)
      .sort({ title: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Location.countDocuments(filter),
  ]);

  response.json({
    data: locations,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getLocationBySlug(request, response) {
  const location = await Location.findOne({
    slug: request.params.slug,
    status: 'published',
    deletedAt: null,
    isProvisional: { $ne: true },
    isCatalogVisible: { $ne: false },
  });

  if (!location) {
    return response.status(404).json({
      error: {
        code: 'LOCATION_NOT_FOUND',
        message: 'No se encontró el lugar solicitado',
      },
    });
  }

  response.json({ data: location });
}

export async function listNearbyLocations(request, response) {
  const latitude = parseCoordinate(request.query.lat, -90, 90);
  const longitude = parseCoordinate(request.query.lng, -180, 180);
  const radius = Math.min(
    parsePositiveInteger(request.query.radius, DEFAULT_RADIUS_METERS),
    MAX_RADIUS_METERS,
  );

  if (latitude === null || longitude === null) {
    return response.status(400).json({
      error: {
        code: 'INVALID_COORDINATES',
        message:
          'Debes indicar lat y lng válidos; lat entre -90 y 90, lng entre -180 y 180',
      },
    });
  }

  const locations = await Location.find({
    status: 'published',
    deletedAt: null,
    isProvisional: { $ne: true },
    isCatalogVisible: { $ne: false },
    location: {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: radius,
      },
    },
  }).limit(50);

  response.json({
    data: locations,
    meta: {
      latitude,
      longitude,
      radius,
      total: locations.length,
    },
  });
}
