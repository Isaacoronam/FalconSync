import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { userDisplayName } from '../../../services/utils/user-display';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent {
  protected readonly auth = inject(AuthService);
  protected readonly displayName = computed(() => {
    const user = this.auth.currentUser();
    return user ? userDisplayName(user) : '';
  });

  protected roleLabel(): string {
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
  }
}
