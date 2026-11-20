import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { PanoramaHotspot } from '../../../models/panorama.model';
import { PanoramaApiService } from '../../../services/panorama-api.service';
import { HOTSPOT_TYPE_LABELS } from '../../../services/utils/panorama-labels';
import {
  DEFAULT_PANORAMA_CAMERA,
  HotspotProjection,
  PanoramaCamera,
  clampPitch,
  normalizeYaw,
  projectHotspot,
  rotateCamera,
  zoomCamera,
} from '../../../services/utils/panorama-projection';
import { PanoramaRenderer } from '../../../services/utils/panorama-renderer';

type ViewerState = 'idle' | 'loading' | 'active' | 'error';

interface HotspotPosition extends HotspotProjection {
  hotspot: PanoramaHotspot;
}

let nextViewerId = 0;

@Component({
  selector: 'app-panorama-viewer',
  imports: [RouterLink],
  templateUrl: './panorama-viewer.component.html',
  styleUrl: './panorama-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanoramaViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly panoramaApi = inject(PanoramaApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly stage = viewChild<ElementRef<HTMLDivElement>>('stage');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  readonly imageUrl = input.required<string>();
  readonly fallbackUrl = input<string | null>(null);
  readonly fallbackAlt = input.required<string>();
  readonly fallbackDescription = input<string>('');
  readonly hotspots = input<readonly PanoramaHotspot[]>([]);
  readonly credits = input<string>('');
  readonly authenticated = input<boolean>(false);

  protected readonly instructionsId = `panorama-viewer-instructions-${nextViewerId++}`;
  protected readonly hotspotTypeLabels = HOTSPOT_TYPE_LABELS;
  protected readonly viewerState = signal<ViewerState>('idle');
  protected readonly webglSupported = signal(false);
  protected readonly fallbackSrc = signal<string | null>(null);
  protected readonly fallbackFailed = signal(false);
  protected readonly camera = signal<PanoramaCamera>({
    ...DEFAULT_PANORAMA_CAMERA,
  });
  protected readonly hotspotPositions = signal<HotspotPosition[]>([]);
  protected readonly statusMessage = signal('');
  protected readonly errorMessage = signal<string | null>(null);

  private renderer: PanoramaRenderer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private frameHandle: number | null = null;
  private dragging = false;
  private activePointerId: number | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartYaw = 0;
  private dragStartPitch = 0;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private readonly objectUrls: string[] = [];

  ngOnInit(): void {
    this.webglSupported.set(PanoramaRenderer.isSupported());

    const fallback = this.fallbackUrl();

    if (!this.authenticated()) {
      this.fallbackSrc.set(fallback ?? this.imageUrl());
      return;
    }

    if (!fallback) {
      this.fallbackFailed.set(true);
      return;
    }

    this.panoramaApi
      .fetchBlob(fallback)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);

          this.objectUrls.push(objectUrl);
          this.fallbackSrc.set(objectUrl);
        },
        error: () => this.fallbackFailed.set(true),
      });
  }

  ngAfterViewInit(): void {
    const stageElement = this.stage()?.nativeElement;
    const canvasElement = this.canvas()?.nativeElement;

    if (stageElement && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.updateViewport());
      this.resizeObserver.observe(stageElement);
    }

    if (canvasElement) {
      canvasElement.addEventListener('wheel', this.handleWheel, {
        passive: false,
      });
      canvasElement.addEventListener(
        'webglcontextlost',
        this.handleContextLost as EventListener,
      );
    }

    this.updateViewport();
    window.addEventListener('resize', this.updateViewport);
  }

  ngOnDestroy(): void {
    this.cancelFrame();
    this.renderer?.dispose();
    this.renderer = null;
    this.resizeObserver?.disconnect();
    const canvasElement = this.canvas()?.nativeElement;

    if (canvasElement) {
      canvasElement.removeEventListener('wheel', this.handleWheel);
      canvasElement.removeEventListener(
        'webglcontextlost',
        this.handleContextLost as EventListener,
      );
    }

    window.removeEventListener('resize', this.updateViewport);

    for (const url of this.objectUrls) {
      URL.revokeObjectURL(url);
    }

    this.objectUrls.length = 0;
  }

  protected async activate(): Promise<void> {
    if (
      this.viewerState() === 'active' ||
      this.viewerState() === 'loading' ||
      !this.webglSupported()
    ) {
      return;
    }

    const canvasElement = this.canvas()?.nativeElement;

    if (!canvasElement) {
      return;
    }

    this.viewerState.set('loading');
    this.errorMessage.set(null);
    this.statusMessage.set('Cargando la vista interactiva.');

    let temporaryUrl: string | null = null;

    try {
      let source = this.imageUrl();

      if (this.authenticated()) {
        const blob = await firstValueFrom(this.panoramaApi.fetchBlob(source));

        temporaryUrl = URL.createObjectURL(blob);
        source = temporaryUrl;
      }

      const image = await loadImage(source);

      this.renderer ??= new PanoramaRenderer(canvasElement);
      this.renderer.resize(
        this.viewportWidth,
        this.viewportHeight,
        renderPixelRatio(),
      );
      this.renderer.setImage(image);
      this.viewerState.set('active');
      this.statusMessage.set(
        'Vista 360° activada. Arrastra para mirar alrededor o usa las flechas del teclado.',
      );
      this.requestRender();
      canvasElement.focus();
    } catch {
      this.viewerState.set('error');
      this.errorMessage.set(
        'No se pudo activar la vista interactiva. Se mantiene la imagen fija y puedes seguir consultando la información de la escena.',
      );
      this.statusMessage.set('Vista interactiva no disponible.');
    } finally {
      if (temporaryUrl) {
        URL.revokeObjectURL(temporaryUrl);
      }
    }
  }

  protected deactivate(): void {
    this.cancelFrame();
    this.renderer?.dispose();
    this.renderer = null;
    this.viewerState.set('idle');
    this.hotspotPositions.set([]);
    this.camera.set({ ...DEFAULT_PANORAMA_CAMERA });
    this.statusMessage.set('Vista fija restaurada.');
  }

  protected resetView(): void {
    this.camera.set({ ...DEFAULT_PANORAMA_CAMERA });
    this.requestRender();
  }

  protected zoom(delta: number): void {
    this.camera.update((camera) => zoomCamera(camera, delta));
    this.requestRender();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.viewerState() !== 'active') {
      return;
    }

    switch (event.key) {
      case 'ArrowLeft':
        this.camera.update((camera) => rotateCamera(camera, -4));
        break;
      case 'ArrowRight':
        this.camera.update((camera) => rotateCamera(camera, 4));
        break;
      case 'ArrowUp':
        this.camera.update((camera) => rotateCamera(camera, 0, 3));
        break;
      case 'ArrowDown':
        this.camera.update((camera) => rotateCamera(camera, 0, -3));
        break;
      case '+':
      case '=':
        this.zoom(-5);
        return;
      case '-':
      case '_':
        this.zoom(5);
        return;
      case '0':
      case 'Home':
        this.resetView();
        return;
      default:
        return;
    }

    event.preventDefault();
    this.requestRender();
  }

  protected onPointerDown(event: PointerEvent): void {
    if (this.viewerState() !== 'active' || event.button !== 0) {
      return;
    }

    this.dragging = true;
    this.activePointerId = event.pointerId;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragStartYaw = this.camera().yaw;
    this.dragStartPitch = this.camera().pitch;
    (event.currentTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.dragging || event.pointerId !== this.activePointerId) {
      return;
    }

    const yaw = this.dragStartYaw - (event.clientX - this.dragStartX) * 0.18;
    const pitch = this.dragStartPitch + (event.clientY - this.dragStartY) * 0.18;

    this.camera.set({
      yaw: normalizeYaw(yaw),
      pitch: clampPitch(pitch),
      fov: this.camera().fov,
    });
    this.requestRender();
  }

  protected onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    this.dragging = false;
    this.activePointerId = null;
  }

  protected openHotspot(hotspot: PanoramaHotspot): void {
    if (hotspot.type === 'scene' && hotspot.targetPanoramaId) {
      void this.router.navigate(['/panoramas', hotspot.targetPanoramaId]);
      return;
    }

    if (hotspot.type === 'location' && hotspot.targetLocationSlug) {
      void this.router.navigate(['/lugares', hotspot.targetLocationSlug]);
      return;
    }

    if (hotspot.type === 'info' && hotspot.targetUrl) {
      void this.router.navigateByUrl(hotspot.targetUrl);
    }
  }

  protected onFallbackError(): void {
    this.fallbackSrc.set(null);
    this.fallbackFailed.set(true);
  }

  private readonly updateViewport = (): void => {
    const stageElement = this.stage()?.nativeElement;

    if (!stageElement) {
      return;
    }

    const rect = stageElement.getBoundingClientRect();

    this.viewportWidth = rect.width;
    this.viewportHeight = rect.height;

    if (this.renderer) {
      this.renderer.resize(
        this.viewportWidth,
        this.viewportHeight,
        renderPixelRatio(),
      );
      this.requestRender();
    }
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    if (this.viewerState() !== 'active') {
      return;
    }

    event.preventDefault();
    this.zoom(Math.sign(event.deltaY) * 5);
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.cancelFrame();
    this.renderer?.dispose();
    this.renderer = null;
    this.viewerState.set('error');
    this.errorMessage.set(
      'El navegador perdió el contexto gráfico. Recarga la página para volver a intentar la vista interactiva.',
    );
  };

  private requestRender(): void {
    if (this.frameHandle !== null || this.viewerState() !== 'active') {
      return;
    }

    this.frameHandle = requestAnimationFrame(() => {
      this.frameHandle = null;
      this.renderer?.render(this.camera());
      this.updateHotspotPositions();
    });
  }

  private updateHotspotPositions(): void {
    const viewport = {
      width: this.viewportWidth,
      height: this.viewportHeight,
    };
    const camera = this.camera();
    const positions = this.hotspots()
      .map((hotspot) => ({
        hotspot,
        ...projectHotspot(hotspot.yaw, hotspot.pitch, camera, viewport),
      }))
      .filter((position) => position.visible);

    this.hotspotPositions.set(positions);
  }

  private cancelFrame(): void {
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
  }
}

function renderPixelRatio(): number {
  return Math.min(2, Math.max(1, window.devicePixelRatio || 1));
}

async function loadImage(source: string): Promise<HTMLImageElement> {
  const image = new Image();

  image.decoding = 'async';

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('PANORAMA_IMAGE_ERROR'));
    image.src = source;

    if (image.complete && image.naturalWidth > 0) {
      resolve();
    }
  });

  return image;
}
