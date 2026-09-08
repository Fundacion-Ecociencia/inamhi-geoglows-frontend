import { Component, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


interface RegionStats {
  region: string;      // "C", "S", "A"
  min_value: number;
  max_value: number;
}

interface ApiResponse {
  data: RegionStats[];
}


@Component({
  selector: 'app-hotspot-report-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './hotspot-report-editor.component.html',
  styleUrl: './hotspot-report-editor.component.css'
})
export class HotspotReportEditorComponent {
  @ViewChild('reportContent', { static: false })
  public reportContent!: ElementRef;
  public isExporting:boolean = false;
  public emissionText:string = '';
  public validityText:string = '';
  public yearText:string = '';
  public dayText:string = '';

  public humidityImageUrl =
    'https://services.geoglows.org/api/hydromet-report-tool/' +
    'get-humidity-plot';
  public temperatureImageUrl =
    'https://services.geoglows.org/api/hydromet-report-tool/' +
    'get-temperature-plot';
  public windImageUrl =
    'https://services.geoglows.org/api/hydromet-report-tool/' +
    'get-wind-plot';
  public hainesImageUrl =
    'https://services.geoglows.org/api/hydromet-report-tool/' +
    'get-haines-plot';

  public soilMoistureImageUrl =
    'https://services.geoglows.org/api/hydromet-report-tool/' +
    'get-soil-moisture-plot';
  public noPrecImageUrl =
    'https://services.geoglows.org/api/hydromet-report-tool/' +
    'get-noprec-plot';
  public pacum24ImageUrl =
    'https://services.geoglows.org/api/hydromet-report-tool/' +
    'get-pacum24-plot';
  public pacum72ImageUrl =
    'https://services.geoglows.org/api/hydromet-report-tool/' +
    'get-pacum72-plot';

  public headerSrc:string = 'assets/img/report-header.png';
  public footerSrc:string = 'assets/img/report-footer.png';

  public soil_moisture_c_min: number | null = null;
  public soil_moisture_c_max: number | null = null;
  public soil_moisture_s_min: number | null = null;
  public soil_moisture_s_max: number | null = null;
  public soil_moisture_a_min: number | null = null;
  public soil_moisture_a_max: number | null = null;

  public pacum24_c_min: number | null = null;
  public pacum24_c_max: number | null = null;
  public pacum24_s_min: number | null = null;
  public pacum24_s_max: number | null = null;
  public pacum24_a_min: number | null = null;
  public pacum24_a_max: number | null = null;

  public pacum72_c_min: number | null = null;
  public pacum72_c_max: number | null = null;
  public pacum72_s_min: number | null = null;
  public pacum72_s_max: number | null = null;
  public pacum72_a_min: number | null = null;
  public pacum72_a_max: number | null = null;

  public noprec_c_min: number | null = null;
  public noprec_c_max: number | null = null;
  public noprec_s_min: number | null = null;
  public noprec_s_max: number | null = null;
  public noprec_a_min: number | null = null;
  public noprec_a_max: number | null = null;

  public haines_c_min: number | null = null;
  public haines_c_max: number | null = null;
  public haines_s_min: number | null = null;
  public haines_s_max: number | null = null;
  public haines_a_min: number | null = null;
  public haines_a_max: number | null = null;

  public temperature_c_min: number | null = null;
  public temperature_c_max: number | null = null;
  public temperature_s_min: number | null = null;
  public temperature_s_max: number | null = null;
  public temperature_a_min: number | null = null;
  public temperature_a_max: number | null = null;

  public humidity_c_min: number | null = null;
  public humidity_c_max: number | null = null;
  public humidity_s_min: number | null = null;
  public humidity_s_max: number | null = null;
  public humidity_a_min: number | null = null;
  public humidity_a_max: number | null = null;



  private days = [
    'domingo', 'lunes', 'martes', 'miércoles',
    'jueves', 'viernes', 'sábado'
  ];

  private months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  private pad2(n: number): string {
    return n < 10 ? '0' + n : String(n);
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  }


  constructor(){
    const emision = new Date();
    const weekDay = this.days[emision.getDay()];
    const day = this.pad2(emision.getDate());
    const month = this.months[emision.getMonth()];
    const year = emision.getFullYear();
    const hh = this.pad2(emision.getHours());
    const mm = this.pad2(emision.getMinutes());
    this.emissionText = `${weekDay}, ${day} de ${month} de ${year}, ${hh}:${mm} horas`;
    this.validityText = `${weekDay}, ${day} de ${month} de ${year}`;
    this.yearText = `${year}`;
    this.dayText = `${this.getDayOfYear(emision)}`;
    this.loadStats();
  }


  public loadStats(){
    const url = "https://services.geoglows.org/api/hydromet-report-tool";

    fetch(`${url}/get-soil-moisture-table`)
      .then((resp) => {
        return resp.json() as Promise<ApiResponse>;
      })
      .then((json) => {
        for (const item of json.data) {
          switch (item.region) {
            case 'C':
              this.soil_moisture_c_min = item.min_value;
              this.soil_moisture_c_max = item.max_value;
              break;
            case 'S':
              this.soil_moisture_s_min = item.min_value;
              this.soil_moisture_s_max = item.max_value;
              break;
            case 'A':
              this.soil_moisture_a_min = item.min_value;
              this.soil_moisture_a_max = item.max_value;
              break;
          }
        }
      });

    fetch(`${url}/get-pacum24-table`)
      .then((resp) => {
        return resp.json() as Promise<ApiResponse>;
      })
      .then((json) => {
        for (const item of json.data) {
          switch (item.region) {
            case 'C':
              this.pacum24_c_min = item.min_value;
              this.pacum24_c_max = item.max_value;
              break;
            case 'S':
              this.pacum24_s_min = item.min_value;
              this.pacum24_s_max = item.max_value;
              break;
            case 'A':
              this.pacum24_a_min = item.min_value;
              this.pacum24_a_max = item.max_value;
              break;
          }
        }
      });

    fetch(`${url}/get-pacum72-table`)
      .then((resp) => {
        return resp.json() as Promise<ApiResponse>;
      })
      .then((json) => {
        for (const item of json.data) {
          switch (item.region) {
            case 'C':
              this.pacum72_c_min = item.min_value;
              this.pacum72_c_max = item.max_value;
              break;
            case 'S':
              this.pacum72_s_min = item.min_value;
              this.pacum72_s_max = item.max_value;
              break;
            case 'A':
              this.pacum72_a_min = item.min_value;
              this.pacum72_a_max = item.max_value;
              break;
          }
        }
      });

    fetch(`${url}/get-noprec-table`)
      .then((resp) => {
        return resp.json() as Promise<ApiResponse>;
      })
      .then((json) => {
        for (const item of json.data) {
          switch (item.region) {
            case 'C':
              this.noprec_c_min = item.min_value;
              this.noprec_c_max = item.max_value;
              break;
            case 'S':
              this.noprec_s_min = item.min_value;
              this.noprec_s_max = item.max_value;
              break;
            case 'A':
              this.noprec_a_min = item.min_value;
              this.noprec_a_max = item.max_value;
              break;
          }
        }
      });

    fetch(`${url}/get-haines-table`)
      .then((resp) => {
        return resp.json() as Promise<ApiResponse>;
      })
      .then((json) => {
        for (const item of json.data) {
          switch (item.region) {
            case 'C':
              this.haines_c_min = item.min_value;
              this.haines_c_max = item.max_value;
              break;
            case 'S':
              this.haines_s_min = item.min_value;
              this.haines_s_max = item.max_value;
              break;
            case 'A':
              this.haines_a_min = item.min_value;
              this.haines_a_max = item.max_value;
              break;
          }
        }
      });

    fetch(`${url}/get-temperature-table`)
      .then((resp) => {
        return resp.json() as Promise<ApiResponse>;
      })
      .then((json) => {
        for (const item of json.data) {
          switch (item.region) {
            case 'C':
              this.temperature_c_min = item.min_value;
              this.temperature_c_max = item.max_value;
              break;
            case 'S':
              this.temperature_s_min = item.min_value;
              this.temperature_s_max = item.max_value;
              break;
            case 'A':
              this.temperature_a_min = item.min_value;
              this.temperature_a_max = item.max_value;
              break;
          }
        }
      });

    fetch(`${url}/get-humidity-table`)
      .then((resp) => {
        return resp.json() as Promise<ApiResponse>;
      })
      .then((json) => {
        for (const item of json.data) {
          switch (item.region) {
            case 'C':
              this.humidity_c_min = item.min_value;
              this.humidity_c_max = item.max_value;
              break;
            case 'S':
              this.humidity_s_min = item.min_value;
              this.humidity_s_max = item.max_value;
              break;
            case 'A':
              this.humidity_a_min = item.min_value;
              this.humidity_a_max = item.max_value;
              break;
          }
        }
      });

  }


  public exportPdf(): void {
    const element = this.reportContent.nativeElement as HTMLElement;
    this.isExporting = true;
    setTimeout(async () => {
      try {
        const [headerImg, footerImg] = await Promise.all([
          this.loadImage(this.headerSrc),
          this.loadImage(this.footerSrc)
        ]);
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true
        });
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const headerRatio = headerImg.height / headerImg.width;
        const footerRatio = footerImg.height / footerImg.width;
        const headerHeight = pdfWidth * headerRatio;  // en mm
        const footerHeight = pdfWidth * footerRatio;  // en mm
        const contentPageHeight = pdfHeight - headerHeight - footerHeight;
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/png');
        let yOffset = 0;
        let pageIndex = 0;
        while (yOffset < imgHeight) {
          if (pageIndex > 0) {
            pdf.addPage();
          }
          const imageY = headerHeight - yOffset;
          pdf.addImage(imgData, 'PNG', 0, imageY, imgWidth, imgHeight);
          pdf.addImage(headerImg, 'PNG', 0, 0, pdfWidth, headerHeight);
          pdf.addImage(footerImg, 'PNG', 0, pdfHeight - footerHeight, pdfWidth, footerHeight);
          yOffset += contentPageHeight;
          pageIndex++;
        }
        pdf.save('report.pdf');
      } catch (err) {
        console.error('Error generando PDF', err);
      } finally {
        this.isExporting = false;
      }
    }, 0);
  }

}
