import { createHash, randomInt } from 'node:crypto';
import AuditLog from '../databases/models/AuditLog.js';
import ChannelLink from '../databases/models/ChannelLink.js';
import ChannelLinkCode from '../databases/models/ChannelLinkCode.js';
import User from '../databases/models/User.js';
import { config } from '../helpers/env.js';
import { HttpError } from '../helpers/HttpError.js';
import { hasCapability } from './authorizationService.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

function hashCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

function normalizeCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function generateCode() {
  let code = '';

  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }

  return code;
}

function linkSummary(link) {
  return {
    linked: true,
    channel: link.channel,
    linkedAt: link.createdAt ?? link.linkedAt ?? null,
    lastSeenAt: link.lastSeenAt ?? null,
  };
}

async function recordLinkAudit(action, user, link, summary) {
  try {
    await AuditLog.create({
      action,
      actor: user._id,
      actorEmail: user.email,
      entityType: 'ChannelLink',
      entityId: link._id,
      summary,
      metadata: {
        channel: link.channel,
      },
    });
  } catch (error) {
    // El vínculo ya está aplicado; no se revierte por un fallo de auditoría,
    // pero el error queda visible para operación.
    console.error('[channels] No se pudo auditar el vínculo:', error.message);
  }
}

export async function createLinkCode(userId) {
  const expiresAt = new Date(
    Date.now() + config.telegram.linkCodeTtlMinutes * 60_000,
  );
  const code = generateCode();

  // Solo hay un código vigente por cuenta.
  await ChannelLinkCode.deleteMany({ user: userId, usedAt: null });
  await ChannelLinkCode.create({
    user: userId,
    codeHash: hashCode(code),
    expiresAt,
  });

  return {
    code,
    expiresAt,
    ttlMinutes: config.telegram.linkCodeTtlMinutes,
  };
}

export async function getLinkStatus(userId) {
  const link = await ChannelLink.findOne({ user: userId, channel: 'telegram' });

  return link ? linkSummary(link) : { linked: false, channel: 'telegram' };
}

export async function unlinkUser(userId) {
  const link = await ChannelLink.findOneAndDelete({
    user: userId,
    channel: 'telegram',
  });

  if (!link) {
    return { linked: false };
  }

  const user = await User.findById(userId);
  if (user) {
    await recordLinkAudit(
      'channel.unlinked',
      user,
      link,
      'Desvinculó su cuenta de Telegram',
    );
  }

  return { linked: false };
}

export async function unlinkExternal(externalId) {
  const link = await ChannelLink.findOneAndDelete({
    channel: 'telegram',
    externalId,
  });

  if (!link) {
    return { linked: false };
  }

  const user = await User.findById(link.user);
  if (user) {
    await recordLinkAudit(
      'channel.unlinked',
      user,
      link,
      'Desvinculó su cuenta de Telegram desde el bot',
    );
  }

  return { linked: false };
}

export async function redeemLinkCode({
  code,
  externalId,
  chatId,
}) {
  const normalized = normalizeCode(code);

  if (!CODE_PATTERN.test(normalized)) {
    throw new HttpError(
      400,
      'LINK_CODE_INVALID',
      'El código no es válido. Revisa los ocho caracteres e inténtalo de nuevo.',
    );
  }

  const linkCode = await ChannelLinkCode.findOne({
    codeHash: hashCode(normalized),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!linkCode) {
    throw new HttpError(
      400,
      'LINK_CODE_INVALID',
      'El código no es válido o ya venció. Genera uno nuevo desde tu perfil.',
    );
  }

  const user = await User.findById(linkCode.user);
  if (!user || !user.isActive) {
    throw new HttpError(
      403,
      'ACCOUNT_UNAVAILABLE',
      'La cuenta no existe o está desactivada.',
    );
  }
  if (user.mustChangePassword) {
    throw new HttpError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'Debes cambiar tu contraseña antes de vincular Telegram.',
    );
  }

  const sameExternal = await ChannelLink.findOne({
    channel: 'telegram',
    externalId,
  });
  if (sameExternal && sameExternal.user.toString() !== user._id.toString()) {
    throw new HttpError(
      409,
      'TELEGRAM_ALREADY_LINKED',
      'Este Telegram ya está vinculado a otra cuenta. Desvincúlalo primero.',
    );
  }

  const sameUser = await ChannelLink.findOne({
    user: user._id,
    channel: 'telegram',
  });
  if (sameUser && sameUser.externalId !== externalId) {
    throw new HttpError(
      409,
      'USER_ALREADY_LINKED',
      'Tu cuenta ya está vinculada a otro Telegram. Desvincúlala primero.',
    );
  }

  let link = sameExternal;
  if (link) {
    link.chatId = chatId;
    link.lastSeenAt = new Date();
    await link.save();
  } else {
    try {
      link = await ChannelLink.create({
        user: user._id,
        channel: 'telegram',
        externalId,
        chatId,
      });
    } catch (error) {
      if (error?.code === 11000) {
        throw new HttpError(
          409,
          'CHANNEL_LINK_CONFLICT',
          'No se pudo vincular porque la cuenta o el Telegram ya están vinculados.',
        );
      }
      throw error;
    }
  }

  const consumed = await ChannelLinkCode.updateOne(
    { _id: linkCode._id, usedAt: null },
    { $set: { usedAt: new Date() } },
  );
  if (consumed.modifiedCount !== 1) {
    throw new HttpError(
      409,
      'LINK_CODE_USED',
      'El código ya fue utilizado. Genera uno nuevo desde tu perfil.',
    );
  }

  await recordLinkAudit(
    'channel.linked',
    user,
    link,
    'Vinculó su cuenta de Telegram',
  );

  return {
    linked: true,
    user: {
      id: user._id.toString(),
      name: user.name,
      username: user.username ?? null,
    },
  };
}

export async function resolveLinkedUser(externalId, { touch = true } = {}) {
  const link = await ChannelLink.findOne({
    channel: 'telegram',
    externalId,
  });

  if (!link) {
    return null;
  }

  const user = await User.findById(link.user);
  if (!user || !user.isActive) {
    await ChannelLink.deleteOne({ _id: link._id });
    return null;
  }

  if (touch) {
    ChannelLink.updateOne(
      { _id: link._id },
      { $set: { lastSeenAt: new Date() } },
    ).catch((error) => {
      console.error('[channels] No se pudo actualizar lastSeenAt:', error.message);
    });
  }

  return { link, user };
}

export async function requireLinkedUser(externalId) {
  const resolved = await resolveLinkedUser(externalId);
  if (!resolved) {
    throw new HttpError(
      403,
      'NOT_LINKED',
      'Debes vincular tu cuenta de FalconSync desde tu perfil para usar esta función.',
    );
  }

  if (resolved.user.mustChangePassword) {
    throw new HttpError(
      403,
      'PASSWORD_CHANGE_REQUIRED',
      'Debes cambiar tu contraseña antes de usar esta función.',
    );
  }

  if (!hasCapability(resolved.user, 'report.create')) {
    throw new HttpError(
      403,
      'FORBIDDEN',
      'Tu cuenta no tiene permiso para reportar incidencias.',
    );
  }

  return resolved;
}

export async function requireLinkedIdentity(externalId) {
  const resolved = await resolveLinkedUser(externalId);
  if (!resolved) {
    throw new HttpError(
      403,
      'NOT_LINKED',
      'Debes vincular tu cuenta de FalconSync desde tu perfil para usar esta función.',
    );
  }

  return resolved;
}
