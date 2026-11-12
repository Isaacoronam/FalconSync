import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CheckInSessionService } from '../services/check-in-session.service';
import { parseCheckInQr } from '../utils/check-in-qr';

/**
 * Extrae un token heredado de la URL, lo guarda en memoria y limpia la barra
 * de direcciones antes de que el usuario llegue al login o al check-in.
 */
export const checkInTokenGuard: CanActivateFn = (route) => {
  const session = inject(CheckInSessionService);
  const router = inject(Router);
  const locationId = route.paramMap.get('locationId');

  if (!locationId) {
    return true;
  }

  const queryToken = route.queryParamMap.get('token');
  let token = queryToken;

  if (!token && route.fragment) {
    const parsed = parseCheckInQr(
      `https://falconsync.local/checkin/${locationId}#${route.fragment}`,
    );
    token = parsed?.token ?? null;
  }

  if (!token) {
    return true;
  }

  session.set(locationId, token);

  const cleanUrl = `/checkin/${locationId}`;

  if (typeof window !== 'undefined') {
    window.history.replaceState(window.history.state, '', cleanUrl);
  }

  return router.parseUrl(cleanUrl);
};
