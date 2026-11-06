import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminApiService } from './admin-api.service';

describe('AdminApiService', () => {
  let service: AdminApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AdminApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('envía filtros, página y límite al listado administrativo', () => {
    service
      .listLocations({
        q: 'catedral',
        status: 'draft',
        category: 'religious',
        page: 2,
        limit: 10,
      })
      .subscribe();

    const request = httpMock.expectOne(
      '/api/admin/locations?q=catedral&status=draft&category=religious&page=2&limit=10',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ data: [], meta: { page: 2, limit: 10, total: 0, totalPages: 0 } });
  });

  it('crea y actualiza POI con los métodos esperados', () => {
    service
      .createLocation({
        title: 'Casa de Prueba',
        category: 'architecture',
        description: 'Descripción de prueba suficientemente larga.',
        conservationStatus: 'unknown',
        status: 'draft',
        isProvisional: false,
        latitude: 11.4075,
        longitude: -69.6778,
      })
      .subscribe();

    const create = httpMock.expectOne('/api/admin/locations');
    expect(create.request.method).toBe('POST');
    create.flush({ data: { id: 'poi-1' } });

    service.updateLocation('poi-1', { title: 'Casa Actualizada' }).subscribe();

    const update = httpMock.expectOne('/api/admin/locations/poi-1');
    expect(update.request.method).toBe('PATCH');
    expect(update.request.body).toEqual({ title: 'Casa Actualizada' });
    update.flush({ data: { id: 'poi-1' } });
  });

  it('archiva y restaura usando las rutas de borrado lógico', () => {
    service.archiveLocation('poi-1').subscribe();
    const archive = httpMock.expectOne('/api/admin/locations/poi-1');
    expect(archive.request.method).toBe('DELETE');
    archive.flush({ data: { id: 'poi-1' } });

    service.restoreLocation('poi-1').subscribe();
    const restore = httpMock.expectOne('/api/admin/locations/poi-1/restore');
    expect(restore.request.method).toBe('POST');
    restore.flush({ data: { id: 'poi-1' } });
  });

  it('sube imágenes como multipart y las elimina con el cuerpo esperado', () => {
    const file = new File(['contenido'], 'foto.png', { type: 'image/png' });

    service.uploadLocationImage('poi-1', file).subscribe();
    const upload = httpMock.expectOne('/api/admin/locations/poi-1/images');
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body instanceof FormData).toBe(true);
    expect((upload.request.body as FormData).get('image')).toBe(file);
    upload.flush({ data: { id: 'poi-1', images: [] } });

    service.removeLocationImage('poi-1', '/api/uploads/locations/foto.png').subscribe();
    const remove = httpMock.expectOne('/api/admin/locations/poi-1/images');
    expect(remove.request.method).toBe('DELETE');
    expect(remove.request.body).toEqual({ url: '/api/uploads/locations/foto.png' });
    remove.flush({ data: { id: 'poi-1', images: [] } });
  });

  it('consulta la auditoría con paginación', () => {
    service.listAudit(2, 20).subscribe();

    const request = httpMock.expectOne('/api/admin/audit?page=2&limit=20');
    expect(request.request.method).toBe('GET');
    request.flush({ data: [], meta: { page: 2, limit: 20, total: 0, totalPages: 0 } });
  });
});
