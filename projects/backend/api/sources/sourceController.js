import SourceDocument from '../../databases/models/SourceDocument.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const SOURCE_STATUSES = ['draft', 'active', 'superseded', 'retracted'];
const SOURCE_LEVELS = ['A', 'B', 'C', 'D', 'E'];
const USAGE_POLICIES = ['final', 'pointer', 'context'];
const ACCESS_LEVELS = ['public', 'internal', 'restricted'];

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function serializeSource(source) {
  return {
    id: source._id.toString(),
    sourceId: source.sourceId,
    title: source.title,
    institution: source.institution,
    version: source.version,
    publicationDate: source.publicationDate,
    retrievedAt: source.retrievedAt,
    verifiedAt: source.verifiedAt,
    url: source.url,
    level: source.level,
    sourceLabel: source.sourceLabel,
    usagePolicy: source.usagePolicy,
    indexingPolicy: source.indexingPolicy,
    credibilityNotes: source.credibilityNotes,
    license: source.license,
    rights: source.rights,
    rightsVerified: source.rightsVerified,
    accessLevel: source.accessLevel,
    language: source.language,
    topics: source.topics,
    poiSlugs: source.poiSlugs,
    status: source.status,
    statusReason: source.statusReason,
    supersedes: source.supersedes?.toString() ?? null,
  };
}

export async function listSources(request, response) {
  const page = parsePositiveInteger(request.query.page, 1);
  const limit = Math.min(
    parsePositiveInteger(request.query.limit, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const filter = {
    accessLevel:
      request.user.role === 'admin'
        ? { $in: ACCESS_LEVELS }
        : { $in: ['public', 'internal'] },
  };

  const filters = [
    ['status', SOURCE_STATUSES],
    ['level', SOURCE_LEVELS],
    ['usagePolicy', USAGE_POLICIES],
    ['accessLevel', ACCESS_LEVELS],
  ];
  for (const [field, allowedValues] of filters) {
    const value = request.query[field];
    if (value === undefined) {
      continue;
    }
    if (!allowedValues.includes(value)) {
      return response.status(400).json({
        error: {
          code: `INVALID_SOURCE_${field.replace(/[A-Z]/gu, (letter) => `_${letter}`).toUpperCase()}`,
          message: `El filtro ${field} no tiene un valor permitido`,
        },
      });
    }
    if (field === 'accessLevel' && request.user.role !== 'admin' && value === 'restricted') {
      return response.status(403).json({
        error: {
          code: 'SOURCE_ACCESS_FORBIDDEN',
          message: 'No tienes acceso a fuentes restringidas',
        },
      });
    }
    filter[field] = value;
  }

  const [sources, total] = await Promise.all([
    SourceDocument.find(filter)
      .sort({ sourceId: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        'sourceId title institution version publicationDate retrievedAt verifiedAt url level sourceLabel usagePolicy indexingPolicy credibilityNotes license rights rightsVerified accessLevel language topics poiSlugs status statusReason supersedes',
      )
      .lean(),
    SourceDocument.countDocuments(filter),
  ]);

  response.json({
    data: sources.map(serializeSource),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
