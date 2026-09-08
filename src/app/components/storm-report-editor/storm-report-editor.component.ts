import {
  Component,
  ElementRef,
  ViewChild
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface StormTableRow {
  Provincia: string;
  Canton: string;
  Nivel: string;
}

interface StormTableResponse {
  table: StormTableRow[];
}

@Component({
  selector: 'app-storm-report-editor',
  standalone: true,
  templateUrl: './storm-report-editor.component.html',
  styleUrls: ['./storm-report-editor.component.scss'],
  imports: [CommonModule, FormsModule],
})
export class StormReportEditorComponent {
  @ViewChild('reportContent', { static: false })
  reportContent!: ElementRef;

  stormImageUrl: string | null = null;
  stormTable: StormTableRow[] = [];

  isExporting = false;

  private imageUrl =
    'https://services.geoglows.org/api/hydromet-report-tool/' +
    'get-hailstorm-plot';

  private tableUrl =
    'https://services.geoglows.org/api/hydromet-report-tool/' +
    'get-hailstorm-table';


  emissionText = '';
  validityText = '';

  private dias = [
    'domingo', 'lunes', 'martes', 'miércoles',
    'jueves', 'viernes', 'sábado'
  ];

  private meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  private pad2(n: number): string {
    return n < 10 ? '0' + n : String(n);
  }

  private formatFechaHoraEmision(d: Date): string {
    const diaSemana = this.dias[d.getDay()];
    const dia = this.pad2(d.getDate());
    const mes = this.meses[d.getMonth()];
    const anio = d.getFullYear();
    const hh = this.pad2(d.getHours());
    const mm = this.pad2(d.getMinutes());
    return `${diaSemana}, ${dia} de ${mes} de ${anio}, ${hh}:${mm} horas`;
  }

  private formatFechaLarga(d: Date): string {
    const diaSemana = this.dias[d.getDay()];
    const dia = this.pad2(d.getDate());
    const mes = this.meses[d.getMonth()];
    const anio = d.getFullYear();
    return `${diaSemana}, ${dia} de ${mes} de ${anio}`;
  }

  private formatHoraH(d: Date): string {
    const hh = this.pad2(d.getHours());
    const mm = "00";//this.pad2(d.getMinutes());
    return `${hh}H${mm}`;
  }

  private updateEmissionAndValidity(): void {
    const emision = new Date();                      // ahora
    const fin = new Date(emision.getTime() + 2 * 60 * 60 * 1000); // +1 hora

    this.emissionText = this.formatFechaHoraEmision(emision);
    this.validityText =
      `desde ${this.formatHoraH(emision)} ` +
      `hasta las ${this.formatHoraH(fin)} ` +
      `del ${this.formatFechaLarga(emision)}`;
  }

  headerSrc = 'assets/img/report-header.png';
  footerSrc = 'assets/img/report-footer.png';

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  }



  constructor(private http: HttpClient) {
    this.refreshData();
  }

  refreshData(): void {
    // Actualizar fecha/hora de emisión y vigencia
    this.updateEmissionAndValidity();

    // Evitar cache del navegador con un parámetro dummy
    this.stormImageUrl = `${this.imageUrl}?t=${Date.now()}`;

    this.http.get<StormTableResponse>(this.tableUrl)
      .subscribe({
        next: (res) => {
          this.stormTable = res.table ?? [];
        },
        error: (err) => {
          console.error('Error cargando tabla de tormenta', err);
          this.stormTable = [];
        }
      });
  }

  exportPdf(): void {
    const element = this.reportContent.nativeElement as HTMLElement;

    // Activar modo exportación (oculta botones/acciones)
    this.isExporting = true;

    // Esperar un ciclo de render
    setTimeout(async () => {
      try {
        // 1) Cargar encabezado y pie de página
        const [headerImg, footerImg] = await Promise.all([
          this.loadImage(this.headerSrc),
          this.loadImage(this.footerSrc)
        ]);

        // 2) Capturar el contenido del reporte
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true
        });

        const pdf = new jsPDF('p', 'mm', 'a4');

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // Alturas del header y footer manteniendo proporción de la imagen
        const headerRatio = headerImg.height / headerImg.width;
        const footerRatio = footerImg.height / footerImg.width;

        const headerHeight = pdfWidth * headerRatio;  // en mm
        const footerHeight = pdfWidth * footerRatio;  // en mm

        // Altura disponible para el contenido en cada página
        const contentPageHeight = pdfHeight - headerHeight - footerHeight;

        // Imagen grande del contenido (canvas -> mm)
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/png');

        let yOffset = 0;           // cuánto del contenido ya se “consumió” (mm)
        let pageIndex = 0;

        while (yOffset < imgHeight) {
          if (pageIndex > 0) {
            pdf.addPage();
          }

          // 1) Dibujar la parte del contenido que corresponde a esta página
          //    Colocamos la imagen completa, desplazada hacia arriba
          //    de forma que el segmento [yOffset, yOffset+contentPageHeight]
          //    quede entre header y footer.
          const imageY = headerHeight - yOffset;
          pdf.addImage(
            imgData,
            'PNG',
            0,
            imageY,
            imgWidth,
            imgHeight
          );

          // 2) Encabezado en la parte superior
          pdf.addImage(
            headerImg,
            'PNG',
            0,
            0,
            pdfWidth,
            headerHeight
          );

          // 3) Pie de página en la parte inferior
          pdf.addImage(
            footerImg,
            'PNG',
            0,
            pdfHeight - footerHeight,
            pdfWidth,
            footerHeight
          );

          // 4) Avanzar al siguiente “segmento” de contenido
          yOffset += contentPageHeight;
          pageIndex++;
        }

        pdf.save('storm-report.pdf');
      } catch (err) {
        console.error('Error generando PDF', err);
      } finally {
        this.isExporting = false;
      }
    }, 0);
  }



  addRow(): void {
    this.stormTable.push({
      Provincia: '',
      Canton: '',
      Nivel: ''
    });
  }

  removeRow(index: number): void {
    this.stormTable.splice(index, 1);
  }

}
