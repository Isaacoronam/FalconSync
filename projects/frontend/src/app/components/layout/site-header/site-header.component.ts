import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { userDisplayName, userInitials } from '../../../services/utils/user-display';

interface HeaderLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteHeaderComponent {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly mobileNav = viewChild<ElementRef<HTMLDialogElement>>('mobileNav');
  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly mobileClose = viewChild<ElementRef<HTMLButtonElement>>('mobileClose');
  private readonly areasTrigger = viewChild<ElementRef<HTMLButtonElement>>('areasTrigger');
  private readonly accountTrigger = viewChild<ElementRef<HTMLButtonElement>>('accountTrigger');

  protected readonly publicLinks: HeaderLink[] = [
    { label: 'CoroMap', path: '/' },
    { label: 'Explorar lugares', path: '/lugares' },
    { label: 'Guía Chivito', path: '/guia' },
  ];
  protected readonly currentUrl = signal(this.router.url);
  protected readonly mobileOpen = signal(false);
  protected readonly accountOpen = signal(false);
  protected readonly areasOpen = signal(false);
  protected readonly scrolled = signal(false);
  protected readonly loggingOut = signal(false);
  protected readonly displayName = computed(() => {
    const user = this.auth.currentUser();
    return user ? userDisplayName(user) : '';
  });
  protected readonly initials = computed(() => {
    const user = this.auth.currentUser();
    return user ? userInitials(user) : 'FS';
  });
  protected readonly roleLabel = computed(() => {
    switch (this.auth.currentUser()?.role) {
      case 'admin':
        return 'Administrador';
      case 'historian':
        return 'Historiador';
      case 'inspector':
        return 'Inspector';
      case 'moderator':
        return 'Moderador (legacy)';
      default:
        return 'Turista';
    }
  });
  protected readonly areaLinks = computed<HeaderLink[]>(() => {
    const links: HeaderLink[] = [];

    if (this.auth.canCreateReport()) {
      links.push({ label: 'Reportes', path: '/reportes' });
    }

    if (this.auth.canPublishPanoramas()) {
      links.push({ label: 'Curaduría 360°', path: '/curaduria/panoramas' });
    }

    if (this.auth.isInspector()) {
      links.push({ label: 'Inspecciones', path: '/inspecciones' });
    }

    return links;
  });
  protected readonly areasActive = computed(() =>
    this.areaLinks().some((link) => this.currentUrl().startsWith(link.path)),
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        const urlChanged = event.urlAfterRedirects !== this.currentUrl();
        this.currentUrl.set(event.urlAfterRedirects);

        if (urlChanged) {
          this.closeMenus();
          this.closeMobileNav();
        }
      });

    this.destroyRef.onDestroy(() => {
      this.document.body.style.overflow = '';

      const dialog = this.mobileNav()?.nativeElement;
      if (dialog?.open && typeof dialog.close === 'function') {
        dialog.close();
      }
    });
  }

  protected toggleAccount(): void {
    this.areasOpen.set(false);
    this.accountOpen.update((open) => !open);
  }

  protected toggleAreas(): void {
    this.accountOpen.set(false);
    this.areasOpen.update((open) => !open);
  }

  protected closeMenus(): void {
    this.accountOpen.set(false);
    this.areasOpen.set(false);
  }

  protected openMobileNav(): void {
    this.closeMenus();
    this.mobileOpen.set(true);
    this.document.body.style.overflow = 'hidden';

    const dialog = this.mobileNav()?.nativeElement;

    if (dialog) {
      if (typeof dialog.showModal === 'function') {
        try {
          if (!dialog.open) {
            dialog.showModal();
          }
        } catch {
          dialog.setAttribute('open', '');
        }
      } else {
        dialog.setAttribute('open', '');
      }
    }

    setTimeout(() => this.mobileClose()?.nativeElement.focus(), 0);
  }

  protected closeMobileNav(): void {
    const dialog = this.mobileNav()?.nativeElement;

    if (!dialog) {
      this.onMobileClosed();
      return;
    }

    if (typeof dialog.close === 'function' && dialog.open) {
      try {
        dialog.close();
      } catch {
        // jsdom y navegadores antiguos pueden no implementar close().
      }
    }

    dialog.removeAttribute('open');
    this.onMobileClosed();
  }

  protected onMobileClosed(): void {
    this.mobileOpen.set(false);
    this.document.body.style.overflow = '';
    setTimeout(() => this.menuButton()?.nativeElement.focus(), 0);
  }

  protected onMobileBackdrop(event: MouseEvent): void {
    if (event.target === this.mobileNav()?.nativeElement) {
      this.closeMobileNav();
    }
  }

  protected logout(): void {
    if (this.loggingOut()) {
      return;
    }

    this.loggingOut.set(true);
    this.closeMenus();
    this.closeMobileNav();

    this.auth.logout().subscribe({
      complete: () => {
        this.loggingOut.set(false);
        void this.router.navigateByUrl('/');
      },
      error: () => {
        this.loggingOut.set(false);
        void this.router.navigateByUrl('/');
      },
    });
  }

  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    const next = window.scrollY > 8;

    if (next !== this.scrolled()) {
      this.scrolled.set(next);
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;

    if (target && this.host.nativeElement.contains(target)) {
      return;
    }

    this.closeMenus();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.mobileOpen()) {
      this.closeMobileNav();
      return;
    }

    const focusTarget = this.accountOpen()
      ? this.accountTrigger()?.nativeElement
      : this.areasOpen()
        ? this.areasTrigger()?.nativeElement
        : null;

    this.closeMenus();
    focusTarget?.focus();
  }
}
