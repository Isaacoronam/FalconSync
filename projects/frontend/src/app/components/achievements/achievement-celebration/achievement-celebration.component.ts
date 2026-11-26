import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  UserAchievement,
  achievementBadgeImage,
  achievementCategoryLabel,
} from '../../../models/achievement.model';
import { CHIVITO } from '../../../services/utils/chivito';

let nextCelebrationId = 0;

@Component({
  selector: 'app-achievement-celebration',
  imports: [RouterLink],
  templateUrl: './achievement-celebration.component.html',
  styleUrl: './achievement-celebration.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AchievementCelebrationComponent implements AfterViewInit, OnDestroy {
  readonly achievement = input.required<UserAchievement>();
  readonly locationTitle = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly chivitoCelebration = CHIVITO.celebration;
  protected readonly titleId = `celebration-title-${++nextCelebrationId}`;
  protected readonly descriptionId = `celebration-description-${nextCelebrationId}`;
  protected readonly badgeImage = computed(() => achievementBadgeImage(this.achievement()));
  protected readonly categoryLabel = computed(() => achievementCategoryLabel(this.achievement()));

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private previousFocus: HTMLElement | null = null;

  ngAfterViewInit(): void {
    this.previousFocus = document.activeElement as HTMLElement | null;
    this.host.nativeElement.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }

  ngOnDestroy(): void {
    this.previousFocus?.focus();
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute('aria-hidden'));

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  protected close(): void {
    this.closed.emit();
  }
}
