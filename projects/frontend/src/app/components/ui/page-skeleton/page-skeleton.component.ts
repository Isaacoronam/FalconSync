import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type PageSkeletonVariant =
  'cards' | 'table' | 'detail' | 'dashboard' | 'profile' | 'form' | 'list' | 'map' | 'viewer';

@Component({
  selector: 'app-page-skeleton',
  templateUrl: './page-skeleton.component.html',
  styleUrl: './page-skeleton.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageSkeletonComponent {
  readonly variant = input<PageSkeletonVariant>('cards');
  readonly label = input('Cargando contenido…');
  readonly rows = input(6);
  protected readonly items = computed(() =>
    Array.from({ length: Math.max(1, this.rows()) }, (_, index) => index),
  );
  protected readonly tableColumns = [24, 20, 14, 16, 12, 14];
}
