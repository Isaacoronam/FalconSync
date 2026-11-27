import { CheckInSessionService } from './check-in-session.service';

const LOCATION_ID = 'location-1';
const TOKEN = 'token-opaco';

describe('CheckInSessionService', () => {
  let service: CheckInSessionService;

  beforeEach(() => {
    service = new CheckInSessionService();
  });

  it('guarda y recupera el token solo para su parada', () => {
    service.set(LOCATION_ID, TOKEN);

    expect(service.get(LOCATION_ID)).toBe(TOKEN);
    expect(service.has(LOCATION_ID)).toBe(true);
    expect(service.get('otra-parada')).toBeNull();
  });

  it('consume el token una sola vez', () => {
    service.set(LOCATION_ID, TOKEN);

    expect(service.consume(LOCATION_ID)).toBe(TOKEN);
    expect(service.get(LOCATION_ID)).toBeNull();
    expect(service.consume(LOCATION_ID)).toBeNull();
  });

  it('descarta tokens caducados', () => {
    service.set(LOCATION_ID, TOKEN, -1);

    expect(service.get(LOCATION_ID)).toBeNull();
    expect(service.has(LOCATION_ID)).toBe(false);
  });

  it('limpia una parada o toda la sesión', () => {
    service.set(LOCATION_ID, TOKEN);
    service.set('otra-parada', 'otro-token');

    service.clear(LOCATION_ID);
    expect(service.get(LOCATION_ID)).toBeNull();
    expect(service.get('otra-parada')).toBe('otro-token');

    service.clear();
    expect(service.get('otra-parada')).toBeNull();
  });

  it('ignora valores vacíos', () => {
    service.set('', TOKEN);
    service.set(LOCATION_ID, '');

    expect(service.get('')).toBeNull();
    expect(service.get(LOCATION_ID)).toBeNull();
  });
});
