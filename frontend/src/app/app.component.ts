import { Component } from '@angular/core';
import { UploadModule } from './features/upload/upload.module';

@Component({
  selector: 'app-root',
  imports: [UploadModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly title = 'Video to GIF Converter';
}
