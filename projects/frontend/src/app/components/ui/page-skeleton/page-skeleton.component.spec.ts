import { TestBed } from '@angular/core/testing';
import { PageSkeletonComponent } from './page-skeleton.component';

describe('PageSkeletonComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageSkeletonComponent],
    }).compileComponents();
  });

  it('anuncia la carga y oculta los bloques decorativos', () => {
    const fixture = TestBed.createComponent(PageSkeletonComponent);
    fixture.componentRef.setInput('variant', 'table');
    fixture.componentRef.setInput('label', 'Cargando usuarios…');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Cargando usuarios…');
    expect(element.querySelector('.sk-visual')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('.page-skeleton')?.getAttribute('aria-busy')).toBe('true');
  });

  it('respeta el número de filas solicitado', () => {
    const fixture = TestBed.createComponent(PageSkeletonComponent);
    fixture.componentRef.setInput('variant', 'list');
    fixture.componentRef.setInput('rows', 3);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('.sk-list__row').length).toBe(3);
  });
});
