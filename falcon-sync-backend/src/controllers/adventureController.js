import Adventure from '../models/Adventure.js';
import AdventureStop from '../models/AdventureStop.js';
import { buildAdventureProgress } from '../services/adventureProgressService.js';
import { HttpError } from '../utils/HttpError.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const PUBLIC_LOCATION_FIELDS =
  'title slug category description address circuits tags location images conservationStatus verificationLevel checkInRadiusMeters';

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function serializeStop(stop) {
  return {
    id: stop._id.toString(),
    order: stop.order,
    didacticText: stop.didacticText,
    instructions: stop.instructions,
    location: stop.location.toJSON(),
  };
}

export async function listPublicAdventures(request, response) {
  const page = parsePositiveInteger(request.query.page, 1);
  const limit = Math.min(
    parsePositiveInteger(request.query.limit, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const filter = { status: 'published', deletedAt: null };

  const [adventures, total] = await Promise.all([
    Adventure.find(filter)
      .sort({ title: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Adventure.countDocuments(filter),
  ]);

  const ids = adventures.map((adventure) => adventure._id);
  const counts =
    ids.length === 0
      ? []
      : await AdventureStop.aggregate([
          { $match: { adventure: { $in: ids } } },
          { $group: { _id: '$adventure', total: { $sum: 1 } } },
        ]);
  const countsByAdventure = new Map(
    counts.map((entry) => [entry._id.toString(), entry.total]),
  );

  response.json({
    data: adventures.map((adventure) => ({
      ...adventure.toJSON(),
      stopsCount: countsByAdventure.get(adventure._id.toString()) ?? 0,
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function getPublicAdventureBySlug(request, response) {
  const adventure = await Adventure.findOne({
    slug: request.params.slug,
    status: 'published',
    deletedAt: null,
  });

  if (!adventure) {
    throw new HttpError(
      404,
      'ADVENTURE_NOT_FOUND',
      'No se encontró la aventura solicitada',
    );
  }

  const stops = await AdventureStop.find({ adventure: adventure._id })
    .sort({ order: 1 })
    .populate({
      path: 'location',
      select: PUBLIC_LOCATION_FIELDS,
      match: {
        status: 'published',
        deletedAt: null,
        isProvisional: { $ne: true },
        isCatalogVisible: { $ne: false },
      },
    });

  response.json({
    data: {
      ...adventure.toJSON(),
      stops: stops
        .filter((stop) => stop.location)
        .map((stop) => serializeStop(stop)),
    },
  });
}

export async function getAdventureProgress(request, response) {
  const adventure = await Adventure.findOne({
    slug: request.params.slug,
    status: 'published',
    deletedAt: null,
  });

  if (!adventure) {
    throw new HttpError(
      404,
      'ADVENTURE_NOT_FOUND',
      'No se encontró la aventura solicitada',
    );
  }

  const progress = await buildAdventureProgress(adventure, request.user._id);

  response.json({ data: progress });
}
