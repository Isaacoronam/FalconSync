import mongoose from 'mongoose';
import Report, { DAMAGE_CATEGORIES } from '../../databases/models/Report.js';
import TelegramUpdate from '../../databases/models/TelegramUpdate.js';
import { config } from '../../helpers/env.js';
import { HttpError } from '../../helpers/HttpError.js';
import { queryAssistant } from '../assistantService.js';
import {
  redeemLinkCode,
  requireLinkedIdentity,
  requireLinkedUser,
  resolveLinkedUser,
  unlinkExternal,
} from '../channelLinkService.js';
import { createReport } from '../conservationService.js';
import {
  findNearbyPois,
  findPoisByText,
  findPublishedPoiBySlugOrId,
  getPublishedRoute,
  listPublishedRoutes,
} from './data.js';

const CATEGORY_SET = new Set(DAMAGE_CATEGORIES);
const MAX_DESCRIPTION = 2000;
const MIN_DESCRIPTION = 10;
const MAX_IDEMPOTENCY_KEY = 100;

function validation(message) {
  throw new HttpError(400, 'VALIDATION_ERROR', message);
}

function requireText(value, field, { min = 1, max = 2000 } = {}) {
  if (typeof value !== 'string') {
    validation(`${field} es obligatorio.`);
  }

  const text = value.trim();
  if (text.length < min || text.length > max) {
    validation(`${field} debe tener entre ${min} y ${max} caracteres.`);
  }

  return text;
}

function requireCoordinate(value, field, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    validation(`${field} no es una coordenada válida.`);
  }

  return number;
}

function reportSummary(report, location = null) {
  return {
    id: report.id ?? report._id?.toString(),
    category: report.category,
    state: report.state,
    createdAt: report.createdAt,
    sourceChannel: report.sourceChannel ?? 'telegram',
    location: location
      ? { slug: location.slug, title: location.title }
      : null,
  };
}

function nextStepFor(report) {
  return report.state === 'received'
    ? 'Tu reporte quedó en la cola de revisión. Puedes consultarlo con /misreportes.'
    : 'Puedes consultar el estado con /misreportes.';
}

export async function consultarGuia({ pregunta, contextLocationId }) {
  const question = requireText(pregunta, 'La pregunta', { min: 2, max: 2000 });

  return queryAssistant({ question, contextLocationId }, 'tourist');
}

export async function buscarLugar({ texto, limite = 5 }) {
  const text = requireText(texto, 'El texto de búsqueda', { min: 2, max: 120 });
  const safeLimit = Math.min(Math.max(Number(limite) || 5, 1), 5);

  return { lugares: await findPoisByText(text, safeLimit) };
}

export async function buscarLugarCercano({ latitude, longitude, limite = 3 }) {
  const lat = requireCoordinate(latitude, 'latitude', -90, 90);
  const lon = requireCoordinate(longitude, 'longitude', -180, 180);
  const safeLimit = Math.min(Math.max(Number(limite) || 3, 1), 5);

  return {
    lugares: await findNearbyPois({
      latitude: lat,
      longitude: lon,
      limit: safeLimit,
    }),
  };
}

export async function listarRutas() {
  return { rutas: await listPublishedRoutes() };
}

export async function obtenerRuta({ slug }) {
  return getPublishedRoute(requireText(slug, 'El slug de la ruta', { max: 140 }));
}

export async function reclamarActualizacion({ updateId, chatId }) {
  const id = Number(updateId);
  if (!Number.isInteger(id) || id <= 0) {
    validation('updateId no es válido.');
  }

  try {
    await TelegramUpdate.create({
      updateId: id,
      chatId: typeof chatId === 'string' ? chatId.slice(0, 64) : '',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    return { duplicate: false };
  } catch (error) {
    if (error?.code === 11000) {
      return { duplicate: true };
    }
    throw error;
  }
}

export async function liberarActualizacion({ updateId }) {
  const id = Number(updateId);
  if (Number.isInteger(id) && id > 0) {
    await TelegramUpdate.deleteOne({ updateId: id });
  }
  return { released: true };
}

export async function estadoVinculo({ telegramUserId }) {
  const externalId = requireText(telegramUserId, 'telegramUserId', {
    min: 1,
    max: 64,
  });
  const resolved = await resolveLinkedUser(externalId);

  if (!resolved) {
    return { linked: false };
  }

  return {
    linked: true,
    user: {
      name: resolved.user.name,
      username: resolved.user.username ?? null,
    },
  };
}

export async function vincularTelegram({
  codigo,
  telegramUserId,
  chatId,
}) {
  return redeemLinkCode({
    code: codigo,
    externalId: requireText(telegramUserId, 'telegramUserId', {
      min: 1,
      max: 64,
    }),
    chatId: requireText(chatId, 'chatId', { min: 1, max: 64 }),
  });
}

export async function desvincularTelegram({ telegramUserId }) {
  return unlinkExternal(
    requireText(telegramUserId, 'telegramUserId', { min: 1, max: 64 }),
  );
}

export async function crearIncidencia({
  telegramUserId,
  locationSlug,
  locationId,
  category,
  description,
  latitude,
  longitude,
  accuracyMeters,
  confirm,
  idempotencyKey,
}) {
  if (confirm !== true) {
    throw new HttpError(
      400,
      'CONFIRMATION_REQUIRED',
      'La incidencia requiere confirmación explícita antes de crearse.',
    );
  }

  const externalId = requireText(telegramUserId, 'telegramUserId', {
    min: 1,
    max: 64,
  });
  const key = requireText(idempotencyKey, 'idempotencyKey', {
    min: 1,
    max: MAX_IDEMPOTENCY_KEY,
  });
  const sourceActionKey = `telegram:${externalId}:${key}`;

  // Primero se comprueba el vínculo: una clave de idempotencia no debe
  // permitir leer el resumen de un reporte ajeno.
  const { user } = await requireLinkedUser(externalId);

  const duplicate = await Report.findOne({ sourceActionKey }).lean();
  if (duplicate) {
    return {
      report: reportSummary(duplicate),
      nextStep: nextStepFor(duplicate),
    };
  }

  if (!CATEGORY_SET.has(category)) {
    validation(`La categoría no es válida. Valores: ${DAMAGE_CATEGORIES.join(', ')}.`);
  }

  const text = requireText(description, 'La descripción', {
    min: MIN_DESCRIPTION,
    max: MAX_DESCRIPTION,
  });

  if (!locationSlug && !locationId) {
    validation('Debes indicar locationSlug o locationId.');
  }

  const location = await findPublishedPoiBySlugOrId({
    slug: locationSlug,
    id: locationId,
  });

  let gps;
  let accuracy;
  const hasLatitude = latitude !== undefined && latitude !== null;
  const hasLongitude = longitude !== undefined && longitude !== null;

  if (hasLatitude !== hasLongitude) {
    validation('Debes enviar latitude y longitude juntas.');
  }
  if (hasLatitude && hasLongitude) {
    gps = {
      type: 'Point',
      coordinates: [
        requireCoordinate(longitude, 'longitude', -180, 180),
        requireCoordinate(latitude, 'latitude', -90, 90),
      ],
    };
    if (accuracyMeters !== undefined && accuracyMeters !== null) {
      accuracy = Number(accuracyMeters);
      if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 10000) {
        validation('accuracyMeters está fuera del rango permitido.');
      }
    }
  }

  const recentReports = await Report.countDocuments({
    reporterId: user._id,
    sourceChannel: 'telegram',
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });
  if (recentReports >= config.telegram.maxReportsPerDay) {
    throw new HttpError(
      429,
      'RATE_LIMITED',
      'Has enviado demasiados reportes desde Telegram en las últimas 24 horas.',
    );
  }

  const report = await createReport(
    {
      locationId: location._id.toString(),
      category,
      description: text,
      capturedAt: new Date(),
      gps,
      accuracyMeters: accuracy,
      sourceChannel: 'telegram',
      sourceActionKey,
    },
    user._id,
    `telegram:${externalId}`,
  );

  return {
    report: reportSummary(report, location),
    nextStep: nextStepFor(report),
  };
}

export async function consultarMisIncidencias({
  telegramUserId,
  page = 1,
  limit = 5,
}) {
  const externalId = requireText(telegramUserId, 'telegramUserId', {
    min: 1,
    max: 64,
  });
  const { user } = await requireLinkedIdentity(externalId);
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 10);

  const [reports, total] = await Promise.all([
    Report.find({ reporterId: user._id })
      .sort({ createdAt: -1, _id: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate({ path: 'locationId', select: 'title slug' })
      .lean(),
    Report.countDocuments({ reporterId: user._id }),
  ]);

  return {
    reportes: reports.map((report) => ({
      id: report._id.toString(),
      category: report.category,
      state: report.state,
      createdAt: report.createdAt,
      location: report.locationId
        ? {
            slug: report.locationId.slug,
            title: report.locationId.title,
          }
        : null,
    })),
    meta: {
      page: safePage,
      limit: safeLimit,
      total,
      hasMore: safePage * safeLimit < total,
    },
  };
}

export async function consultarIncidencia({ telegramUserId, reportId }) {
  const externalId = requireText(telegramUserId, 'telegramUserId', {
    min: 1,
    max: 64,
  });
  const id = requireText(reportId, 'reportId', { min: 1, max: 64 });

  if (!mongoose.isValidObjectId(id)) {
    throw new HttpError(
      404,
      'REPORT_NOT_FOUND',
      'No se encontró la incidencia indicada.',
    );
  }

  const { user } = await requireLinkedIdentity(externalId);
  const report = await Report.findOne({
    _id: id,
    reporterId: user._id,
  })
    .populate({ path: 'locationId', select: 'title slug' })
    .lean();

  if (!report) {
    throw new HttpError(
      404,
      'REPORT_NOT_FOUND',
      'No se encontró la incidencia indicada entre las de tu cuenta.',
    );
  }

  return {
    report: {
      id: report._id.toString(),
      category: report.category,
      state: report.state,
      description: report.description,
      capturedAt: report.capturedAt,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      version: report.version,
      rejectionReason: report.rejectionReason ?? null,
      gps: report.gps ?? null,
      location: report.locationId
        ? {
            slug: report.locationId.slug,
            title: report.locationId.title,
          }
        : null,
    },
  };
}
