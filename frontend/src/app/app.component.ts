import { Component } from '@angular/core';
import {UploadModule} from './features/upload/upload.module';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [UploadModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Video to GIF Converter';
}
