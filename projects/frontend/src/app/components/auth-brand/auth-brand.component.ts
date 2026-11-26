import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-auth-brand',
  imports: [RouterLink],
  templateUrl: './auth-brand.component.html',
  styleUrl: './auth-brand.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthBrandComponent {}
