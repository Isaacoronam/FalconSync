const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;

const GPS_LATITUDE_REF = 0x0001;
const GPS_LATITUDE = 0x0002;
const GPS_LONGITUDE_REF = 0x0003;
const GPS_LONGITUDE = 0x0004;
const GPS_ALTITUDE_REF = 0x0005;
const GPS_ALTITUDE = 0x0006;

const TYPE_SIZES = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
  7: 1, // UNDEFINED
  9: 4, // SLONG
  10: 8, // SRATIONAL
};

function toDate(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value
    .trim()
    .match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function toDegrees(values, ref) {
  if (!Array.isArray(values) || values.length < 3) {
    return null;
  }

  const [degrees, minutes, seconds] = values;
  const decimal = degrees + minutes / 60 + seconds / 3600;

  if (!Number.isFinite(decimal)) {
    return null;
  }

  return ref === 'S' || ref === 'W' ? -decimal : decimal;
}

/**
 * Extrae únicamente fecha de captura y coordenadas de un bloque EXIF.
 * Devuelve null si el bloque no es válido; nunca lanza por metadatos corruptos.
 */
export function readExifHints(exif) {
  if (!Buffer.isBuffer(exif) || exif.length < 8) {
    return null;
  }

  let buffer = exif;

  if (
    buffer.length > 6 &&
    buffer.toString('ascii', 0, 4) === 'Exif' &&
    buffer[4] === 0 &&
    buffer[5] === 0
  ) {
    buffer = buffer.subarray(6);
  }

  if (buffer.length < 8) {
    return null;
  }

  const order = buffer.toString('ascii', 0, 2);
  const littleEndian = order === 'II';

  if (!littleEndian && order !== 'MM') {
    return null;
  }

  const read16 = (offset) =>
    littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
  const read32 = (offset) =>
    littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);

  if (read16(2) !== 42) {
    return null;
  }

  const readIfd = (offset) => {
    if (!Number.isInteger(offset) || offset < 8 || offset + 2 > buffer.length) {
      return new Map();
    }

    const count = read16(offset);
    const entries = new Map();

    if (count > 500) {
      return entries;
    }

    for (let index = 0; index < count; index += 1) {
      const entryOffset = offset + 2 + index * 12;

      if (entryOffset + 12 > buffer.length) {
        return entries;
      }

      const tag = read16(entryOffset);
      const type = read16(entryOffset + 2);
      const itemCount = read32(entryOffset + 4);
      const valueSize = (TYPE_SIZES[type] ?? 0) * itemCount;

      if (valueSize <= 0) {
        continue;
      }

      const valueOffset =
        valueSize <= 4 ? entryOffset + 8 : read32(entryOffset + 8);

      if (valueOffset < 0 || valueOffset + valueSize > buffer.length) {
        continue;
      }

      entries.set(tag, {
        type,
        count: itemCount,
        offset: valueOffset,
        size: valueSize,
      });
    }

    return entries;
  };

  const readAscii = (entry) => {
    if (!entry) {
      return null;
    }

    const terminator = buffer[entry.offset + entry.size - 1] === 0 ? 1 : 0;
    return buffer
      .toString('ascii', entry.offset, entry.offset + entry.size - terminator)
      .replace(/\0+$/g, '')
      .trim();
  };

  const readRationals = (entry) => {
    if (!entry || entry.type !== 5 || entry.size % 8 !== 0) {
      return null;
    }

    const values = [];
    for (let offset = entry.offset; offset < entry.offset + entry.size; offset += 8) {
      const numerator = read32(offset);
      const denominator = read32(offset + 4);
      values.push(denominator === 0 ? 0 : numerator / denominator);
    }
    return values;
  };

  const readByte = (entry) => {
    if (!entry || entry.size < 1) {
      return null;
    }
    return buffer[entry.offset];
  };

  try {
    const ifd0 = readIfd(read32(4));
    const exifIfdEntry = ifd0.get(TAG_EXIF_IFD);
    const exifIfd = exifIfdEntry
      ? readIfd(read32(exifIfdEntry.offset))
      : new Map();
    const gpsIfdEntry = ifd0.get(TAG_GPS_IFD);
    const gpsIfd = gpsIfdEntry ? readIfd(read32(gpsIfdEntry.offset)) : new Map();

    const capturedAt = toDate(
      readAscii(exifIfd.get(TAG_DATETIME_ORIGINAL)) ??
        readAscii(ifd0.get(TAG_DATETIME)),
    );

    const latitude = toDegrees(
      readRationals(gpsIfd.get(GPS_LATITUDE)),
      readAscii(gpsIfd.get(GPS_LATITUDE_REF)),
    );
    const longitude = toDegrees(
      readRationals(gpsIfd.get(GPS_LONGITUDE)),
      readAscii(gpsIfd.get(GPS_LONGITUDE_REF)),
    );
    const altitudeValues = readRationals(gpsIfd.get(GPS_ALTITUDE));
    const altitudeRef = readByte(gpsIfd.get(GPS_ALTITUDE_REF));

    const hints = {
      capturedAt,
      gps:
        Number.isFinite(latitude) && Number.isFinite(longitude)
          ? { latitude, longitude }
          : null,
      altitudeMeters:
        Array.isArray(altitudeValues) && altitudeValues.length > 0
          ? (altitudeRef === 1 ? -1 : 1) * altitudeValues[0]
          : null,
    };

    if (!hints.capturedAt && !hints.gps && hints.altitudeMeters === null) {
      return null;
    }

    return hints;
  } catch {
    return null;
  }
}
