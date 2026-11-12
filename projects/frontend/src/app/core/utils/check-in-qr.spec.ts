import { parseCheckInQr } from './check-in-qr';

const TOKEN = 'A'.repeat(43);
const LOCATION_ID = 'a'.repeat(24);
const OTHER_TOKEN = 'B'.repeat(43);

describe('parseCheckInQr', () => {
  it('acepta el JSON oficial del QR', () => {
    expect(
      parseCheckInQr(
        JSON.stringify({
          type: 'falconsync-check-in',
          locationId: LOCATION_ID,
          token: TOKEN,
        }),
      ),
    ).toEqual({ locationId: LOCATION_ID, token: TOKEN });
  });

  it('acepta JSON sin tipo y con alias de locationId', () => {
    expect(
      parseCheckInQr(
        JSON.stringify({ location_id: LOCATION_ID, token: TOKEN }),
      ),
    ).toEqual({ locationId: LOCATION_ID, token: TOKEN });
  });

  it('rechaza un JSON con otro tipo o con token inválido', () => {
    expect(
      parseCheckInQr(
        JSON.stringify({
          type: 'otro-sistema',
          locationId: LOCATION_ID,
          token: TOKEN,
        }),
      ),
    ).toBeNull();
    expect(
      parseCheckInQr(
        JSON.stringify({
          type: 'falconsync-check-in',
          locationId: LOCATION_ID,
          token: 'corto',
        }),
      ),
    ).toBeNull();
  });

  it('extrae el token del fragmento de una URL de check-in', () => {
    expect(
      parseCheckInQr(
        `https://falconsync.example/checkin/${LOCATION_ID}#t=${TOKEN}`,
      ),
    ).toEqual({ locationId: LOCATION_ID, token: TOKEN });
  });

  it('extrae el token de la consulta de una URL de check-in', () => {
    expect(
      parseCheckInQr(
        `https://falconsync.example/checkin/${LOCATION_ID}?token=${OTHER_TOKEN}`,
      ),
    ).toEqual({ locationId: LOCATION_ID, token: OTHER_TOKEN });
  });

  it('acepta el esquema falconsync y una ruta relativa', () => {
    expect(
      parseCheckInQr(`falconsync://checkin/${LOCATION_ID}#t=${TOKEN}`),
    ).toEqual({ locationId: LOCATION_ID, token: TOKEN });
    expect(parseCheckInQr(`/checkin/${LOCATION_ID}#${TOKEN}`)).toEqual({
      locationId: LOCATION_ID,
      token: TOKEN,
    });
  });

  it('acepta una cadena de consulta suelta', () => {
    expect(
      parseCheckInQr(`?locationId=${LOCATION_ID}&token=${TOKEN}`),
    ).toEqual({ locationId: LOCATION_ID, token: TOKEN });
    expect(
      parseCheckInQr(`locationId=${LOCATION_ID}&token=${TOKEN}`),
    ).toEqual({ locationId: LOCATION_ID, token: TOKEN });
  });

  it('rechaza URLs de otros esquemas, rutas sin check-in y datos vacíos', () => {
    expect(parseCheckInQr(`javascript:alert(1)`)).toBeNull();
    expect(
      parseCheckInQr(`https://falconsync.example/otra/${LOCATION_ID}?token=${TOKEN}`),
    ).toBeNull();
    expect(parseCheckInQr('')).toBeNull();
    expect(parseCheckInQr('   ')).toBeNull();
  });

  it('rechaza rutas con codificación porcentual inválida sin lanzar', () => {
    expect(() =>
      parseCheckInQr(`https://falconsync.example/checkin/%E0%A4%A#t=${TOKEN}`),
    ).not.toThrow();
    expect(
      parseCheckInQr(`https://falconsync.example/checkin/%E0%A4%A#t=${TOKEN}`),
    ).toBeNull();
  });

  it('rechaza identificadores o tokens con formato incorrecto', () => {
    expect(
      parseCheckInQr(`https://falconsync.example/checkin/abc#t=${TOKEN}`),
    ).toBeNull();
    expect(
      parseCheckInQr(
        `https://falconsync.example/checkin/${LOCATION_ID}#t=demasiado-corto`,
      ),
    ).toBeNull();
  });
});
