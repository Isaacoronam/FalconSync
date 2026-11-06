import mongoose from 'mongoose';
import CheckIn from '../models/CheckIn.js';
import Location from '../models/Location.js';
import { verifyCheckInToken } from '../services/checkInTokenService.js';
import { HttpError } from '../utils/HttpError.js';
import { haversineDistanceMeters } from '../utils/geo.js';

function validationError(details) {
  return new HttpError(
    400,
    'VALIDATION_ERROR',
    'Los datos enviados no son válidos',
    details,
  );
}

function readCheckInBody(body) {
  const issues = [];

  if (typeof body.locationId !== 'string' || !mongoose.isValidObjectId(body.locationId)) {
    issues.push('locationId debe ser un identificador válido');
  }

  if (typeof body.token !== 'string' || body.token.length === 0) {
    issues.push('El token del QR es obligatorio');
  }

  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    issues.push('La latitud debe ser un número entre -90 y 90');
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    issues.push('La longitud debe ser un número entre -180 y 180');
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  return {
    locationId: body.locationId,
    token: body.token,
    latitude,
    longitude,
  };
}

export async function createCheckIn(request, response) {
  const { locationId, token, latitude, longitude } = readCheckInBody(
    request.body ?? {},
  );

  const location = await Location.findById(locationId).select(
    '+checkInTokenHash',
  );

  if (!location) {
    throw new HttpError(
      404,
      'LOCATION_NOT_FOUND',
      'No se encontró el punto de interés',
    );
  }

  if (location.status !== 'published' || location.deletedAt) {
    throw new HttpError(
      409,
      'LOCATION_NOT_AVAILABLE',
      'El punto de interés no está disponible para check-in',
    );
  }

  if (!verifyCheckInToken(token, location.checkInTokenHash)) {
    throw new HttpError(
      400,
      'INVALID_CHECK_IN_TOKEN',
      'El token del QR no es válido',
    );
  }

  const [locationLongitude, locationLatitude] = location.location.coordinates;
  const distanceMeters = haversineDistanceMeters(
    latitude,
    longitude,
    locationLatitude,
    locationLongitude,
  );
  const radiusMeters = location.checkInRadiusMeters ?? 50;

  if (distanceMeters > radiusMeters) {
    throw new HttpError(
      400,
      'CHECK_IN_OUTSIDE_GEOFENCE',
      'Debes estar dentro del radio permitido del punto de interés para registrarlo',
      {
        distanceMeters: Math.round(distanceMeters),
        radiusMeters,
      },
    );
  }

  try {
    const checkIn = await CheckIn.create({
      user: request.user._id,
      location: location._id,
      coordinates: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
      distanceMeters,
      tokenVersion: location.checkInTokenVersion ?? 0,
    });

    response.status(201).json({ data: checkIn });
  } catch (error) {
    if (error?.code === 11000) {
      throw new HttpError(
        409,
        'CHECK_IN_ALREADY_EXISTS',
        'Ya registraste un check-in en este punto de interés',
      );
    }

    throw error;
  }
}
