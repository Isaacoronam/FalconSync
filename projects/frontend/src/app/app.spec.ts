import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the FalconSync brand', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand__name')?.textContent?.toUpperCase()).toContain(
      'FALCONSYNC',
    );
  });

  it('should render the master logo instead of the letter F', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    const mark = compiled.querySelector('.brand__mark') as HTMLImageElement;
    expect(mark).not.toBeNull();
    expect(mark.tagName).toBe('IMG');
    expect(mark.getAttribute('alt')).toBe('');
    expect(mark.getAttribute('src')).toContain('brand/falconsync-logo.png');
    expect(mark.getAttribute('width')).toBe('48');
    expect(mark.getAttribute('height')).toBe('48');
    expect(mark.textContent).toBe('');
    expect(compiled.querySelector('.brand__mark span')).toBeNull();
  });
});
