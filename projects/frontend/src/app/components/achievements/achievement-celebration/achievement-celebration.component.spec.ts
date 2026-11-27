import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UserAchievement } from '../../../models/achievement.model';
import { AchievementCelebrationComponent } from './achievement-celebration.component';

const achievement: UserAchievement = {
  id: 'achievement-1',
  type: 'location',
  sourceId: 'location-1',
  sourceSlug: 'catedral-de-coro',
  name: 'Catedral de Coro',
  description: 'Sello de visita al patrimonio de Santa Ana de Coro.',
  image: null,
  category: 'religious',
  awardedAt: '2026-11-25T12:00:00.000Z',
  sourceActive: true,
};

describe('AchievementCelebrationComponent', () => {
  let fixture: ComponentFixture<AchievementCelebrationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AchievementCelebrationComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AchievementCelebrationComponent);
    fixture.componentRef.setInput('achievement', achievement);
    fixture.componentRef.setInput('locationTitle', 'Catedral de Coro');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('celebra con Chivito, la insignia real y el lugar visitado', () => {
    const text = root().textContent ?? '';

    expect(text).toContain('¡Felicidades! ¡Lo lograste!');
    expect(text).toContain('Catedral de Coro');
    expect(text).toContain('Sello de visita al patrimonio de Santa Ana de Coro.');
    expect(root().querySelector('.celebration__chivito')).not.toBeNull();
    expect(root().querySelector('.celebration__badge-image')?.getAttribute('src')).toContain(
      'images/badges/religious.svg',
    );
    expect(root().querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true');
  });

  it('cierra con el botón de continuar y emite el evento', () => {
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    const button = Array.from(root().querySelectorAll('button')).find((item) =>
      item.textContent?.includes('Seguir explorando'),
    );
    button?.click();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('cierra con Escape y devuelve el foco al elemento anterior', () => {
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('cierra al pulsar el fondo, pero no al pulsar el contenido', () => {
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    const backdrop = root().querySelector('.celebration-backdrop') as HTMLElement;
    const content = root().querySelector('.celebration') as HTMLElement;
    const event = new MouseEvent('click', { bubbles: true });

    content.dispatchEvent(event);
    expect(closed).not.toHaveBeenCalled();

    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('enfoca una acción segura al abrir el diálogo', () => {
    const focused = document.activeElement as HTMLElement | null;
    expect(focused?.textContent).toContain('Seguir explorando');
  });
});
