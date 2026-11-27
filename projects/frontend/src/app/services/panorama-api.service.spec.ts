import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminPanoramaDetail, PanoramaDetail } from '../models/panorama.model';
import { PanoramaApiService } from './panorama-api.service';

const panorama: PanoramaDetail = {
  id: 'pano-1',
  title: 'Plaza Mayor',
  locationId: 'loc-1',
  assetId: null,
  thumbnailUrl: '/api/panoramas/pano-1/thumbnail',
  projection: 'equirectangular',
  capturedAt: '2026-11-01T00:00:00.000Z',
  credits: 'Autoría · CC BY-SA 4.0',
  width: 8000,
  height: 4000,
  location: { id: 'loc-1', title: 'Plaza Mayor', slug: 'plaza-mayor', status: 'published' },
  asset: null,
  description: 'Vista de la plaza.',
  imageUrl: '/api/panoramas/pano-1/image',
  hotspots: [],
  fallback: {
    imageUrl: '/api/panoramas/pano-1/thumbnail',
    alt: 'Vista panorámica de la plaza',
    description: 'Vista de la plaza.',
    transcript: null,
  },
  license: 'CC BY-SA 4.0',
  licenseUrl: null,
  author: 'Equipo',
  status: 'published',
  visibility: 'public',
};

const adminPanorama = {
  ...panorama,
  status: 'draft',
  visibility: 'inspection',
  version: 3,
  hasDerivative: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
  imageUrl: '/api/admin/panoramas/pano-1/image',
  hotspots: [],
  fallbackAlt: 'Vista panorámica de la plaza',
  fallbackDescription: 'Vista de la plaza.',
  transcript: null,
  credit: 'Autoría · CC BY-SA 4.0',
  rightsDocumented: true,
  permitDocumented: true,
  rightsNotes: null,
  peopleBlurred: true,
  consentDocumented: false,
  consentNotes: null,
  checksum: 'a'.repeat(64),
  derivativeChecksum: 'b'.repeat(64),
  thumbnailChecksum: 'c'.repeat(64),
  bytes: 1024,
  derivativeBytes: 512,
  approvedAt: null,
  publishedAt: null,
  archivedAt: null,
  createdBy: 'user-1',
  updatedBy: 'user-1',
} satisfies AdminPanoramaDetail;

describe('PanoramaApiService', () => {
  let service: PanoramaApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(PanoramaApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lista las visitas públicas con filtros de lugar y paginación', () => {
    service.list({ locationId: 'loc-1', page: 2, limit: 10 }).subscribe();

    const request = httpMock.expectOne('/api/panoramas?locationId=loc-1&page=2&limit=10');
    expect(request.request.method).toBe('GET');
    request.flush({
      data: [panorama],
      meta: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });
  });

  it('consulta el detalle público y el listado administrativo con sus filtros', () => {
    service.get('pano-1').subscribe((response) => {
      expect(response.data.hotspots).toEqual([]);
    });

    const detail = httpMock.expectOne('/api/panoramas/pano-1');
    expect(detail.request.method).toBe('GET');
    detail.flush({ data: panorama });

    service
      .listAdmin({
        q: 'plaza',
        status: 'draft',
        visibility: 'inspection',
        locationId: 'loc-1',
        page: 1,
        limit: 20,
      })
      .subscribe();

    const admin = httpMock.expectOne(
      '/api/admin/panoramas?q=plaza&status=draft&visibility=inspection&locationId=loc-1&page=1&limit=20',
    );
    expect(admin.request.method).toBe('GET');
    admin.flush({
      data: [adminPanorama],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('crea el panorama con multipart y los campos esperados', () => {
    const image = new File(['pixels'], 'plaza.jpg', { type: 'image/jpeg' });

    service
      .create(
        {
          title: 'Plaza Mayor',
          description: 'Vista de la plaza.',
          locationId: 'loc-1',
          visibility: 'inspection',
          capturedAt: null,
          author: 'Equipo',
          license: 'CC BY-SA 4.0',
          licenseUrl: null,
          credit: 'Autoría · CC BY-SA 4.0',
          rightsDocumented: true,
          permitDocumented: false,
          rightsNotes: 'Permiso del cabildo.',
          peopleBlurred: true,
          consentDocumented: false,
          consentNotes: null,
          fallbackAlt: 'Vista panorámica de la plaza',
          fallbackDescription: 'Vista de la plaza.',
          transcript: null,
          hotspots: [],
        },
        image,
      )
      .subscribe();

    const request = httpMock.expectOne('/api/admin/panoramas');
    const body = request.request.body as FormData;

    expect(request.request.method).toBe('POST');
    expect(body.get('title')).toBe('Plaza Mayor');
    expect(body.get('visibility')).toBe('inspection');
    expect(body.get('rightsDocumented')).toBe('true');
    expect(body.get('rightsNotes')).toBe('Permiso del cabildo.');
    expect(body.get('capturedAt')).toBeNull();
    expect(body.get('image')).toBeInstanceOf(File);
    request.flush({ data: adminPanorama });
  });

  it('actualiza con If-Match y ejecuta las transiciones editoriales', () => {
    service.update('pano-1', 3, { title: 'Plaza Mayor al atardecer' }).subscribe();

    const update = httpMock.expectOne('/api/admin/panoramas/pano-1');
    expect(update.request.method).toBe('PATCH');
    expect(update.request.headers.get('If-Match')).toBe('"3"');
    update.flush({ data: adminPanorama });

    service.approve('pano-1', 3).subscribe();
    const approve = httpMock.expectOne('/api/admin/panoramas/pano-1/approve');
    expect(approve.request.method).toBe('POST');
    expect(approve.request.headers.get('If-Match')).toBe('"3"');
    approve.flush({ data: adminPanorama });

    service.publish('pano-1', 4).subscribe();
    const publish = httpMock.expectOne('/api/admin/panoramas/pano-1/publish');
    expect(publish.request.headers.get('If-Match')).toBe('"4"');
    publish.flush({ data: adminPanorama });

    service.archive('pano-1', 5).subscribe();
    const archive = httpMock.expectOne('/api/admin/panoramas/pano-1/archive');
    expect(archive.request.headers.get('If-Match')).toBe('"5"');
    archive.flush({ data: adminPanorama });
  });

  it('descarga la imagen autenticada como blob', () => {
    service.fetchBlob('/api/admin/panoramas/pano-1/image').subscribe((blob) => {
      expect(blob.size).toBe(6);
    });

    const request = httpMock.expectOne('/api/admin/panoramas/pano-1/image');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['pixels']));
  });
});
