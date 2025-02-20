import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppComponent } from './app.component';
import {UploadModule} from './features/upload/upload.module';

@NgModule({
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    UploadModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
