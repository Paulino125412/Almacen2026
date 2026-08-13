import React, { useState } from 'react';
import { SalesOrder, Client, Seller, Article } from '../types';
import { Printer, X, MessageCircle, FileDown } from 'lucide-react';

interface PrintSalesOrderProps {
  order: SalesOrder;
  clients: Client[];
  sellers: Seller[];
  articles: Article[];
  onClose: () => void;
}

function convertOklchToRgb(cssText: string): string {
  if (!cssText || !cssText.includes('oklch')) return cssText;

  return cssText.replace(/oklch\(\s*([\w.%]+)\s+([\w.]+)\s+([\w.]+)(?:\s*\/\s*([\w.%]+))?\s*\)/gi, (match, lStr, cStr, hStr, aStr) => {
    const parseVal = (str: string | undefined, defaultVal: number) => {
      if (!str || str === 'none') return defaultVal;
      if (str.endsWith('%')) return parseFloat(str) / 100;
      const num = parseFloat(str);
      return isNaN(num) ? defaultVal : num;
    };

    const l = parseVal(lStr, 0);
    const c = parseVal(cStr, 0);
    const h = parseVal(hStr, 0);
    const a = aStr !== undefined ? parseVal(aStr, 1) : 1;

    // Convert OKLCH to OKLAB
    const hRad = (h * Math.PI) / 180;
    const aLab = c * Math.cos(hRad);
    const bLab = c * Math.sin(hRad);

    // Convert OKLAB to Linear RGB
    const l_ = l + 0.3963377774 * aLab + 0.2158037573 * bLab;
    const m_ = l - 0.1055613458 * aLab - 0.0638541728 * bLab;
    const s_ = l - 0.0894841775 * aLab - 1.2914855480 * bLab;

    const lRgb = l_ * l_ * l_;
    const mRgb = m_ * m_ * m_;
    const sRgb = s_ * s_ * s_;

    const rLin = +4.0767416621 * lRgb - 3.3077115913 * mRgb + 0.2309699292 * sRgb;
    const gLin = -1.2684380046 * lRgb + 2.6097574011 * mRgb - 0.3413193965 * sRgb;
    const bLin = -0.0041960863 * lRgb - 0.7034186147 * mRgb + 1.7076147010 * sRgb;

    const toSrgb = (x: number) => {
      x = Math.max(0, Math.min(1, x));
      return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
    };

    const r = Math.round(toSrgb(rLin) * 255);
    const g = Math.round(toSrgb(gLin) * 255);
    const b = Math.round(toSrgb(bLin) * 255);

    if (a < 1) {
      return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
  });
}

export default function PrintSalesOrder({
  order,
  clients,
  sellers,
  articles,
  onClose
}: PrintSalesOrderProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const trimmed = dateStr.trim();
    if (!trimmed) return '';

    if (/^\d{2}[\/-]\d{2}[\/-]\d{4}$/.test(trimmed)) {
      return trimmed.replace(/-/g, '/');
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-');
      return `${d}/${m}/${y}`;
    }

    try {
      const dateObj = new Date(trimmed);
      if (!isNaN(dateObj.getTime())) {
        const d = String(dateObj.getDate()).padStart(2, '0');
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const y = dateObj.getFullYear();
        return `${d}/${m}/${y}`;
      }
    } catch {
      // fallback
    }

    return trimmed;
  };

  const formattedTotal = (order.totalAmount || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const formattedBilled = (order.billedAmount || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const formattedPending = (order.pendingAmount || 0).toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const handleShareWhatsApp = () => {
    const phone = (order.dispatchContactPhone || '').replace(/\D/g, '');
    const clientNameUpper = (order.clientName || '').toUpperCase();
    const itemsList = order.items
      .map(i => `- ${i.description || 'Producto'} x${i.requestedQty || 1} (S/. ${(i.totalAmount || 0).toFixed(2)})`)
      .join('\n');

    const messageText = `📋 *FICHA DE VENTA - ${clientNameUpper}*\n` +
      `*N° Orden:* ${order.orderNo || '-'}\n` +
      `*Fecha:* ${formatDate(order.date)}\n` +
      `*Total:* S/. ${formattedTotal}\n\n` +
      `*Productos:*\n${itemsList}`;

    const encodedText = encodeURIComponent(messageText);

    let waUrl = '';
    if (phone && phone.length >= 7) {
      waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;
    } else {
      waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    }

    window.open(waUrl, '_blank');
  };

  const handleGeneratePDF = async () => {
    const element = document.querySelector('.sales-ficha-print-sheet') as HTMLElement;
    if (!element) return;

    try {
      setIsGeneratingPDF(true);
      if (document.fonts) {
        await document.fonts.ready;
      }

      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = (html2pdfModule.default || html2pdfModule) as any;

      const clientNameClean = (order.clientName || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Ficha_Venta_${clientNameClean}_${order.orderNo || ''}.pdf`;

      const opt = {
        margin: 5,
        filename: filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 1024,
          onclone: (clonedDoc: Document) => {
            // Convert oklch() color functions in style tags to exact rgb/rgba
            const styleTags = Array.from(clonedDoc.querySelectorAll('style'));
            styleTags.forEach((style) => {
              if (style.textContent && style.textContent.includes('oklch')) {
                style.textContent = convertOklchToRgb(style.textContent);
              }
            });

            // Convert inline styles
            const elements = Array.from(clonedDoc.querySelectorAll('*'));
            elements.forEach((el) => {
              const styleAttr = el.getAttribute('style');
              if (styleAttr && styleAttr.includes('oklch')) {
                el.setAttribute('style', convertOklchToRgb(styleAttr));
              }
            });

            // Inject custom CSS into clonedDoc to guarantee a strict mirror of @media print
            const pdfStyle = clonedDoc.createElement('style');
            pdfStyle.textContent = `
              #print-section {
                background: #ffffff !important;
                background-color: #ffffff !important;
                background-image: none !important;
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
                border: none !important;
              }
              #print-section > div {
                background: #ffffff !important;
                background-color: #ffffff !important;
                box-shadow: none !important;
                border: none !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .sales-ficha-print-sheet {
                width: 200mm !important;
                max-width: 200mm !important;
                min-width: 200mm !important;
                height: auto !important;
                margin: 0 auto !important;
                background-color: #ffffff !important;
                color: #000000 !important;
                font-family: Arial, Helvetica, sans-serif !important;
                box-sizing: border-box !important;
                box-shadow: none !important;
                border: none !important;
              }
              .sales-ficha-print-sheet * {
                box-sizing: border-box !important;
                color: #000000 !important;
              }
              .sales-ficha-print-sheet .leading-tight {
                line-height: 1.35 !important;
              }
              .sales-ficha-print-sheet br {
                display: block !important;
                content: "" !important;
                margin-top: 1px !important;
              }
            `;
            clonedDoc.head.appendChild(pdfStyle);
          }
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
      };

      // html2pdf worker
      const worker = html2pdf().set(opt).from(element);
      const pdfBlob = await worker.output('blob');

      // Download file to user device
      const blobUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      // If mobile supports Web Share API with files, trigger native share menu
      if (navigator.canShare && navigator.share) {
        try {
          const file = new File([pdfBlob], filename, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `Ficha de Venta - ${order.clientName || ''}`,
              text: `Adjunto Ficha de Venta N° ${order.orderNo || ''}`
            });
          }
        } catch (shareErr) {
          // User cancelled share or non-critical error
        }
      }
    } catch (err) {
      console.error('Error al generar el PDF:', err);
      alert('No se pudo generar el PDF. Por favor reintente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div id="print-section" className="fixed inset-0 bg-black/75 z-50 flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 print:p-0 print:bg-white print:overflow-visible">
      {/* Screen Control Bar */}
      <div className="w-full max-w-4xl bg-app-surface text-app-text border border-app-border rounded-t-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg no-print print:hidden">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-app-primary">Vista Previa - Ficha de Venta</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleGeneratePDF}
            disabled={isGeneratingPDF}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Descargar Ficha de Venta en PDF"
          >
            <FileDown size={14} />
            {isGeneratingPDF ? 'Generando PDF...' : 'Descargar PDF'}
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded flex items-center gap-1.5 transition cursor-pointer"
            title="Enviar resumen por WhatsApp"
          >
            <MessageCircle size={14} />
            Enviar WhatsApp
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-1.5 bg-app-primary hover:bg-app-primary/90 text-white font-bold text-xs rounded flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Printer size={14} />
            Imprimir (1/2 Hoja A4)
          </button>

          <button
            onClick={onClose}
            className="p-1.5 text-app-text/60 hover:text-app-text hover:bg-app-bg rounded transition cursor-pointer"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Print Document Container - Designed for A4 page half */}
      <div className="w-full max-w-4xl bg-white text-black p-4 sm:p-6 print:p-0 rounded-b-xl print:rounded-none shadow-2xl print:shadow-none print:w-full">
        {/* Printable Area matching exact design */}
        <div className="sales-ficha-print-sheet mx-auto bg-white text-black font-sans text-[11px] leading-normal p-3 max-w-[210mm] print:max-w-none">
          
          {/* 1. Title */}
          <div className="text-center font-bold text-base sm:text-lg text-black mb-1">
            Ficha de Venta Cliente N°..........................
          </div>

          {/* 2. Top Sub-header */}
          <div className="flex justify-between items-center text-[11px] mb-1.5 px-0.5 font-normal text-black">
            <div>
              <span className="font-normal">Nombre del ejecutor de ventas: </span>
              <span className="font-bold uppercase ml-1">{order.sellerName || '-'}</span>
            </div>
            <div>
              <span className="font-normal">Fecha: </span>
              <span className="font-mono font-bold ml-1">{formatDate(order.date) || '0/01/1900'}</span>
            </div>
          </div>

          {/* 3. Items & Info Master Table Grid */}
          <table className="w-full table-fixed border-collapse border border-black text-[10.5px] mb-2 text-black">
            <thead>
              <tr className="border-b border-black font-bold text-[10px]" style={{ backgroundColor: '#e5e7eb' }}>
                <th className="border-r border-black py-0 px-1 text-center font-bold w-[10%] align-middle">Código</th>
                <th className="border-r border-black py-0 px-1 text-center font-bold w-[40%] align-middle">Descripción</th>
                <th className="border-r border-black py-0 px-1 text-center font-bold w-[11%] leading-tight align-middle">
                  Precio<br />Unitario
                </th>
                <th className="border-r border-black py-0 px-1 text-center font-bold w-[11%] leading-tight align-middle">
                  Cantidad<br />solicitada
                </th>
                <th className="border-r border-black py-0 px-1 text-center font-bold w-[11%] leading-tight align-middle">
                  Cantidad<br />despachada
                </th>
                <th className="py-0 px-1 text-center font-bold w-[17%] leading-tight align-middle">
                  Importe<br />total
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Product Rows */}
              {order.items.map((item, idx) => (
                <tr key={item.id || idx} className="border-b border-black">
                  <td className="border-r border-black p-1.5 text-center font-mono font-bold align-middle">{item.code || ''}</td>
                  <td className="border-r border-black p-1.5 font-bold align-middle">{item.description || ''}</td>
                  <td className="border-r border-black p-1.5 text-right font-mono font-bold align-middle">
                    {item.unitPrice && Number(item.unitPrice) > 0 ? item.unitPrice.toFixed(2) : ''}
                  </td>
                  <td className="border-r border-black p-1.5 text-right font-mono font-bold align-middle">
                    {item.requestedQty && Number(item.requestedQty) > 0 ? item.requestedQty : ''}
                  </td>
                  <td className="border-r border-black p-1.5 text-right font-mono font-bold align-middle">
                    {item.dispatchedQty && Number(item.dispatchedQty) > 0 ? item.dispatchedQty : ''}
                  </td>
                  <td className="p-1.5 text-right font-mono font-bold align-middle">
                    {item.totalAmount && Number(item.totalAmount) > 0 ? item.totalAmount.toFixed(2) : '-'}
                  </td>
                </tr>
              ))}

              {/* Empty padding rows to guarantee vertical height matching form */}
              {Array.from({ length: Math.max(0, 3 - order.items.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-black h-6">
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1"></td>
                  <td className="border-r border-black p-1"></td>
                  <td className="p-1 text-right font-mono font-bold text-black align-middle">{i === 0 && order.items.length === 0 ? '-' : ''}</td>
                </tr>
              ))}

              {/* CLIENTE & TOTAL Row */}
              <tr className="border-b border-black">
                <td colSpan={4} className="border-r border-black p-1 font-normal align-middle">
                  CLIENTE: <span className="font-bold uppercase ml-1">{order.clientName || ''}</span>
                </td>
                <td colSpan={1} className="border-r border-black p-1 text-left font-normal align-middle">
                  TOTAL
                </td>
                <td colSpan={1} className="p-1 text-right font-mono font-bold align-middle">
                  {order.totalAmount && Number(order.totalAmount) > 0 ? `S/. ${formattedTotal}` : ''}
                </td>
              </tr>

              {/* Dirección fiscal & RUC/DNI Row */}
              <tr className="border-b border-black">
                <td colSpan={1} className="border-r border-black py-0 px-1 font-normal text-left leading-tight align-middle">
                  Dirección fiscal
                </td>
                <td colSpan={3} className="border-r border-black py-0 px-1 font-bold uppercase align-middle">
                  {order.fiscalAddress || ''}
                </td>
                <td colSpan={2} className="py-0 px-1 font-normal align-middle">
                  RUC/DNI: <span className="font-mono font-bold ml-1">{order.clientRucDni || ''}</span>
                </td>
              </tr>

              {/* Contacto de despacho Row */}
              <tr className="border-b border-black">
                <td colSpan={1} className="border-r border-black py-0.5 px-1 text-left font-normal leading-tight align-middle">
                  Contacto de<br />despacho
                </td>
                <td colSpan={5} className="p-0 align-middle">
                  <table className="w-full border-collapse text-[10.5px]">
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="w-16 border-r border-black py-0.5 px-1 font-normal">Nombre:</td>
                        <td className="py-0.5 px-1 font-bold uppercase">{order.dispatchContactName || ''}</td>
                      </tr>
                      <tr>
                        <td className="w-16 border-r border-black py-0.5 px-1 font-normal">Teléfono:</td>
                        <td className="py-0.5 px-1 font-mono font-bold">{order.dispatchContactPhone || ''}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              {/* Lugar de despacho Row */}
              <tr className="border-b border-black">
                <td colSpan={1} className="border-r border-black py-0 px-1 text-left font-normal leading-tight align-middle">
                  Lugar de despacho
                </td>
                <td colSpan={3} className="border-r border-black py-0 px-1 text-left font-bold uppercase align-middle">
                  {order.dispatchAddress || ''}
                </td>
                <td colSpan={1} className="border-r border-black py-0 px-1 text-center font-normal align-middle">
                  Número de piso
                </td>
                <td colSpan={1} className="py-0 px-1 text-center font-bold font-mono align-middle">
                  {order.floorNumber || ''}
                </td>
              </tr>

              {/* Fecha de despacho & Hora de despacho Row */}
              <tr className="border-b border-black">
                <td colSpan={1} className="border-r border-black py-0 px-1 text-left font-normal leading-tight align-middle">
                  Fecha de despacho
                </td>
                <td colSpan={1} className="border-r border-black py-0 px-1 text-center font-mono font-bold align-middle">
                  {formatDate(order.dispatchDate) || ''}
                </td>
                <td colSpan={1} className="border-r border-black py-0 px-1 text-center font-normal leading-tight align-middle">
                  Hora de despacho
                </td>
                <td colSpan={3} className="py-0 px-1 text-center font-bold uppercase align-middle">
                  {order.dispatchTime || ''}
                </td>
              </tr>

              {/* Forma de pago Row */}
              <tr className="border-b border-black">
                <td colSpan={1} className="border-r border-black py-0 px-1 text-left font-normal leading-tight align-middle">
                  Forma de pago
                </td>
                <td colSpan={5} className="py-0 px-1 text-left font-bold uppercase align-middle">
                  {order.paymentMethod || ''}
                </td>
              </tr>

              {/* Billing Split Row (Independent layout spanning all 6 columns) */}
              <tr>
                <td colSpan={6} className="p-0 align-top">
                  <div className="flex w-full">
                    <div className="w-[36%] border-r border-black p-1.5 align-top">
                      <div className="space-y-0.5 text-[10.5px]">
                        <div>
                          <span className="font-normal">Importe facturado:(S/.)</span>
                          <span className="font-mono font-bold ml-1">{order.billedAmount ? formattedBilled : ''}</span>
                        </div>
                        <div>
                          <span className="font-normal">Nombre:</span>
                          <span className="font-bold uppercase ml-1">{order.billingName || ''}</span>
                        </div>
                        <div>
                          <span className="font-normal">RUC/DNI:</span>
                          <span className="font-mono font-bold ml-1">{order.billingRucDni || ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-[64%] p-1.5 align-top">
                      <div className="space-y-1 text-[10.5px]">
                        <div className="flex items-baseline overflow-hidden w-[58%] min-w-0">
                          <span className="font-normal whitespace-nowrap">Importe facturado:(S/.)</span>
                          <span className="flex-1 border-b border-dotted border-black ml-1 min-w-[10px]" />
                        </div>
                        <div className="flex justify-between items-baseline gap-2 overflow-hidden">
                          <div className="flex items-baseline w-[58%] min-w-0">
                            <span className="font-normal whitespace-nowrap">Nombre:</span>
                            <span className="flex-1 border-b border-dotted border-black ml-1 min-w-[10px]" />
                          </div>
                          <div className="flex items-baseline w-[42%] min-w-0">
                            <span className="font-normal whitespace-nowrap">Pendiente:</span>
                            <span className="flex-1 border-b border-dotted border-black ml-1 min-w-[10px]" />
                          </div>
                        </div>
                        <div className="flex items-baseline overflow-hidden w-[58%] min-w-0">
                          <span className="font-normal whitespace-nowrap">RUC/DNI:</span>
                          <span className="flex-1 border-b border-dotted border-black ml-1 min-w-[10px]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 4. Observaciones */}
          <div className="mt-1 px-0.5 text-[10.5px] text-black">
            <div className="font-normal">
              Observaciones:
            </div>
            <div className="min-h-[16px] overflow-hidden whitespace-nowrap">
              {order.observations ? (
                <span className="font-bold uppercase whitespace-pre-wrap">{order.observations}</span>
              ) : (
                <div className="border-b border-dotted border-black w-full h-3" />
              )}
            </div>
          </div>

          {/* 5. (PARA SER LLENADO POR ALMACÉN) Section & PENDIENTE POR FACTURAR Box */}
          <div className="px-0.5 text-[10px] mt-1 text-black">
            <div className="flex w-full items-stretch justify-between gap-3">
              {/* Left Column: ALMACÉN section + Bottom dashed line */}
              <div className="flex-1 flex flex-col justify-between">
                {/* Header */}
                <div className="font-normal uppercase text-[10px] mb-1">
                  (PARA SER LLENADO POR ALMACÉN)
                </div>

                {/* Dealer & Bolívar Grid */}
                <div className="grid grid-cols-2 gap-3 my-1">
                  <div className="space-y-2">
                    <div className="flex items-baseline overflow-hidden">
                      <span className="font-normal whitespace-nowrap">DEALER:</span>
                      <span className="flex-1 border-b border-dotted border-black ml-1" />
                    </div>
                    <div className="flex items-baseline overflow-hidden pt-1.5">
                      <span className="font-normal whitespace-nowrap"># FACTURA:</span>
                      <span className="flex-1 border-b border-dotted border-black ml-1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-baseline overflow-hidden">
                      <span className="font-normal whitespace-nowrap">BOLÍVAR:</span>
                      <span className="flex-1 border-b border-dotted border-black ml-1" />
                    </div>
                    <div className="flex items-baseline overflow-hidden pt-1.5">
                      <span className="font-normal whitespace-nowrap"># FACTURA:</span>
                      <span className="flex-1 border-b border-dotted border-black ml-1" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: PENDIENTE POR FACTURAR Box */}
              <div className="border border-black p-2 space-y-2 bg-white w-[30%] min-w-[200px] flex-shrink-0 flex flex-col justify-between">
                <div className="font-normal text-[10px] uppercase text-left">
                  PENDIENTE POR FACTURAR
                </div>
                <div className="flex items-baseline overflow-hidden">
                  <span className="font-normal whitespace-nowrap">DEALER:</span>
                  <span className="flex-1 border-b border-dotted border-black ml-1" />
                </div>
                <div className="flex items-baseline overflow-hidden">
                  <span className="font-normal whitespace-nowrap">BOLÍVAR:</span>
                  <span className="flex-1 border-b border-dotted border-black ml-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Cut Line */}
          <div className="mt-3 border-b border-dashed border-gray-500 w-full"></div>
        </div>
      </div>

      {/* Print Specific CSS for 1/2 A4 Sheet */}
      <style>{`
        .sales-ficha-print-sheet {
          font-family: Arial, Helvetica, sans-serif !important;
          color: #000000 !important;
          background-color: #ffffff !important;
          line-height: 1.35 !important;
        }
        .sales-ficha-print-sheet * {
          box-sizing: border-box !important;
        }
        .sales-ficha-print-sheet td,
        .sales-ficha-print-sheet th {
          line-height: 1.35 !important;
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm;
          }
          html, body {
            background: white !important;
            background-color: white !important;
            color: black !important;
            height: 100% !important;
            max-height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          #print-section {
            background: white !important;
            background-color: white !important;
            background-image: none !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
            box-shadow: none !important;
            border: none !important;
          }
          #print-section > div {
            background: white !important;
            background-color: white !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .sales-ficha-print-sheet {
            max-height: 138mm !important;
            height: auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            box-sizing: border-box !important;
            background: white !important;
            background-color: white !important;
          }
        }
      `}</style>
    </div>
  );
}

