import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-forbidden',
  imports: [RouterLink],
  templateUrl: './forbidden.component.html',
  styleUrl: './forbidden.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenComponent {
  protected readonly auth = inject(AuthService);
}
