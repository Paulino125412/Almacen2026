import React from 'react';
import { SalesOrder, Client, Seller, Article } from '../types';
import { Printer, X, MessageCircle, Mail } from 'lucide-react';

interface PrintSalesOrderProps {
  order: SalesOrder;
  clients: Client[];
  sellers: Seller[];
  articles: Article[];
  onClose: () => void;
}

export default function PrintSalesOrder({
  order,
  clients,
  sellers,
  articles,
  onClose
}: PrintSalesOrderProps) {
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
    const text = `📋 *FICHA DE VENTA CLIENTE*
----------------------------------------
👤 *Cliente:* ${order.clientName}
🆔 *RUC/DNI:* ${order.clientRucDni || 'N/A'}
👨‍💼 *Ejecutor de Ventas:* ${order.sellerName || 'N/A'}
📅 *Fecha:* ${formatDate(order.date)}
📍 *Lugar de Despacho:* ${order.dispatchAddress || 'Almacén'}
🚚 *Fecha/Hora Despacho:* ${formatDate(order.dispatchDate) || '-'} ${order.dispatchTime || ''}
💳 *Forma de Pago:* ${order.paymentMethod || '-'}

📦 *ITEMS:*
${order.items.map(i => `• [${i.code || '-'}] ${i.description}: ${i.dispatchedQty} pz/m @ S/. ${i.unitPrice.toFixed(2)} = S/. ${i.totalAmount.toFixed(2)}`).join('\n')}

💰 *TOTAL:* S/. ${formattedTotal}
_Generado desde TexFlow Almacén_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div id="print-section" className="fixed inset-0 bg-black/75 z-50 flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 print:p-0 print:static print:bg-white print:overflow-visible">
      {/* Screen Control Bar */}
      <div className="w-full max-w-4xl bg-app-surface text-app-text border border-app-border rounded-t-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-lg no-print print:hidden">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-app-primary">Vista Previa - Ficha de Venta</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShareWhatsApp}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded flex items-center gap-1.5 transition cursor-pointer"
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
        {/* Printable Area matching exact PDF design */}
        <div className="sales-ficha-print-sheet mx-auto bg-white text-black font-sans text-[11px] leading-tight p-2 max-w-[210mm] print:max-w-none">
          
          {/* 1. Header Title */}
          <div className="text-center font-normal text-base sm:text-lg mb-2">
            Ficha de Venta Cliente N°..........................
          </div>

          {/* 2. Top Sub-header */}
          <div className="flex justify-between items-center text-[11px] mb-2 px-1">
            <div>
              <span className="font-normal">Nombre del ejecutor de ventas: </span>
              <span className="font-bold uppercase ml-1">{order.sellerName || '................................................................'}</span>
            </div>
            <div>
              <span className="font-normal">Fecha: </span>
              <span className="font-bold font-mono ml-1">{formatDate(order.date) || '........................'}</span>
            </div>
          </div>

          {/* 3. Items & Info Master Table Grid */}
          <table className="w-full border-collapse border border-black text-[10.5px] mb-2">
            <thead>
              <tr className="border-b border-black font-normal text-[10px] bg-gray-200" style={{ backgroundColor: '#e5e7eb', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <th className="border-r border-black p-1 text-center font-normal w-[10%]">Código</th>
                <th className="border-r border-black p-1 text-center font-normal w-[40%]">Descripción</th>
                <th className="border-r border-black p-1 text-center font-normal w-[12.5%] leading-tight">
                  Precio<br />Unitario
                </th>
                <th className="border-r border-black p-1 text-center font-normal w-[12.5%] leading-tight">
                  Cantidad<br />solicitada
                </th>
                <th className="border-r border-black p-1 text-center font-normal w-[12.5%] leading-tight">
                  Cantidad<br />despachada
                </th>
                <th className="p-1 text-center font-normal w-[12.5%] leading-tight">
                  Importe<br />total
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Product Rows */}
              {order.items.map((item, idx) => (
                <tr key={item.id || idx} className="border-b border-black">
                  <td className="border-r border-black p-1 text-center font-mono font-bold">{item.code || ''}</td>
                  <td className="border-r border-black p-1 font-bold">{item.description || ''}</td>
                  <td className="border-r border-black p-1 text-right font-mono font-bold">
                    {item.unitPrice && Number(item.unitPrice) > 0 ? item.unitPrice.toFixed(2) : ''}
                  </td>
                  <td className="border-r border-black p-1 text-right font-mono font-bold">
                    {item.requestedQty && Number(item.requestedQty) > 0 ? item.requestedQty : ''}
                  </td>
                  <td className="border-r border-black p-1 text-right font-mono font-bold">
                    {item.dispatchedQty && Number(item.dispatchedQty) > 0 ? item.dispatchedQty : ''}
                  </td>
                  <td className="p-1 text-right font-mono font-bold">
                    {item.totalAmount && Number(item.totalAmount) > 0 ? item.totalAmount.toFixed(2) : ''}
                  </td>
                </tr>
              ))}

              {/* Empty padding rows to guarantee height matching original form */}
              {Array.from({ length: Math.max(0, 3 - order.items.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-black h-6">
                  <td className="border-r border-black p-1">&nbsp;</td>
                  <td className="border-r border-black p-1">&nbsp;</td>
                  <td className="border-r border-black p-1">&nbsp;</td>
                  <td className="border-r border-black p-1">&nbsp;</td>
                  <td className="border-r border-black p-1">&nbsp;</td>
                  <td className="p-1">&nbsp;</td>
                </tr>
              ))}

              {/* CLIENTE & TOTAL Row */}
              <tr className="border-b border-black">
                <td colSpan={4} className="border-r border-black p-1 font-normal">
                  CLIENTE: <span className="font-bold uppercase ml-1">{order.clientName || ''}</span>
                </td>
                <td colSpan={2} className="p-1">
                  <div className="flex justify-between items-center">
                    <span className="font-normal">TOTAL</span>
                    <span className="font-mono font-bold text-xs">{order.totalAmount && Number(order.totalAmount) > 0 ? `S/. ${formattedTotal}` : ''}</span>
                  </div>
                </td>
              </tr>

              {/* Dirección fiscal & RUC/DNI Row */}
              <tr className="border-b border-black">
                <td colSpan={4} className="border-r border-black p-1">
                  <div className="flex items-start gap-1">
                    <span className="font-normal whitespace-nowrap">Dirección fiscal</span>
                    <span className="font-bold uppercase ml-1">{order.fiscalAddress || ''}</span>
                  </div>
                </td>
                <td colSpan={2} className="p-1">
                  <span className="font-normal">RUC/DNI: </span>
                  <span className="font-mono font-bold">{order.clientRucDni || ''}</span>
                </td>
              </tr>

              {/* Contacto de despacho Row */}
              <tr className="border-b border-black">
                <td colSpan={1} className="border-r border-black p-1 leading-tight text-left font-normal">
                  Contacto de<br />despacho
                </td>
                <td colSpan={5} className="p-0">
                  <table className="w-full border-collapse text-[10.5px]">
                    <tbody>
                      <tr className="border-b border-black">
                        <td className="w-20 border-r border-black p-1 font-normal">Nombre:</td>
                        <td className="p-1 font-bold uppercase">{order.dispatchContactName || ''}</td>
                      </tr>
                      <tr>
                        <td className="w-20 border-r border-black p-1 font-normal">Teléfono:</td>
                        <td className="p-1 font-mono font-bold">{order.dispatchContactPhone || ''}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>

              {/* Lugar de despacho Row */}
              <tr className="border-b border-black">
                <td colSpan={1} className="border-r border-black py-0.5 px-1 leading-none text-left font-normal">
                  Lugar de<br />despacho
                </td>
                <td colSpan={3} className="border-r border-black py-0.5 px-1 text-left font-bold uppercase">
                  {order.dispatchAddress || ''}
                </td>
                <td colSpan={1} className="border-r border-black py-0.5 px-1 text-center font-normal">
                  Número de piso
                </td>
                <td colSpan={1} className="py-0.5 px-1 text-center font-bold font-mono">
                  {order.floorNumber || ''}
                </td>
              </tr>

              {/* Fecha de despacho & Hora de despacho Row */}
              <tr className="border-b border-black">
                <td colSpan={1} className="border-r border-black py-0.5 px-1 leading-none text-left font-normal">
                  Fecha de<br />despacho
                </td>
                <td colSpan={1} className="border-r border-black py-0.5 px-1 text-center font-mono font-bold">
                  {formatDate(order.dispatchDate) || ''}
                </td>
                <td colSpan={1} className="border-r border-black py-0.5 px-1 leading-none text-center font-normal">
                  Hora de<br />despacho
                </td>
                <td colSpan={3} className="py-0.5 px-1 text-center font-bold uppercase">
                  {order.dispatchTime || ''}
                </td>
              </tr>

              {/* Forma de pago Row */}
              <tr className="border-b border-black">
                <td colSpan={1} className="border-r border-black py-0.5 px-1 leading-none text-left font-normal">
                  Forma de<br />pago
                </td>
                <td colSpan={5} className="py-0.5 px-1 text-left font-bold uppercase">
                  {order.paymentMethod || ''}
                </td>
              </tr>

              {/* Billing Split Row */}
              <tr>
                <td colSpan={2} className="border-r border-black p-1.5 align-top w-1/2">
                  <div className="space-y-1">
                    <div className="flex items-center overflow-hidden whitespace-nowrap">
                      <span className="font-normal mr-1">Importe facturado:(S/.)</span>
                      <span className="font-mono font-bold">{order.billedAmount ? formattedBilled : ''}</span>
                    </div>
                    <div className="overflow-hidden whitespace-nowrap">
                      <span className="font-normal">Nombre:</span>{' '}
                      <span className="font-bold uppercase ml-1">{order.billingName || ''}</span>
                    </div>
                    <div className="overflow-hidden whitespace-nowrap">
                      <span className="font-normal">RUC/DNI:</span>{' '}
                      <span className="font-mono font-bold ml-1">{order.billingRucDni || ''}</span>
                    </div>
                  </div>
                </td>
                <td colSpan={4} className="p-1.5 align-top w-1/2">
                  <div className="space-y-1">
                    <div className="overflow-hidden whitespace-nowrap">
                      <span className="font-normal">Importe facturado:(S/.)</span>....................................
                    </div>
                    <div className="overflow-hidden whitespace-nowrap">
                      <span className="font-normal">Nombre:</span>....................................................
                    </div>
                    <div className="flex justify-between items-center overflow-hidden whitespace-nowrap">
                      <div>
                        <span className="font-normal">RUC/DNI:</span>................
                      </div>
                      <div>
                        <span className="font-normal">Pendiente:</span>
                        <span className="font-mono font-bold ml-1">{order.pendingAmount ? formattedPending : '...............'}</span>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 4. Observaciones */}
          <div className="mb-3 px-1 space-y-1 text-[10.5px]">
            <div className="font-normal">
              Observaciones:
            </div>
            <div>
              {order.observations ? (
                <span className="font-bold uppercase whitespace-pre-wrap">{order.observations}</span>
              ) : (
                <div className="overflow-hidden whitespace-nowrap font-mono">
                  ........................................................................................................................................................................
                </div>
              )}
            </div>
          </div>

          {/* 5. (PARA SER LLENADO POR ALMACÉN) Section */}
          <div className="px-1 text-[10px]">
            <div className="grid grid-cols-12 gap-3 items-start">
              {/* Column 1: Title + Dealer + # Factura */}
              <div className="col-span-4 space-y-1">
                <div className="font-bold uppercase text-[10px] mb-1">
                  (PARA SER LLENADO POR ALMACÉN)
                </div>
                <div className="overflow-hidden whitespace-nowrap">
                  <span className="font-bold">DEALER:</span>...................................................
                </div>
                <div className="overflow-hidden whitespace-nowrap pt-2">
                  <span className="font-bold"># FACTURA:</span>..............................................
                </div>
              </div>

              {/* Column 2: Bolívar + # Factura (aligned with Column 1 fields) */}
              <div className="col-span-4 space-y-1 pt-[15px]">
                <div className="overflow-hidden whitespace-nowrap">
                  <span className="font-bold">BOLÍVAR:</span>..................................................
                </div>
                <div className="overflow-hidden whitespace-nowrap pt-2">
                  <span className="font-bold"># FACTURA:</span>..............................................
                </div>
              </div>

              {/* Column 3: Boxed Pendiente Por Facturar */}
              <div className="col-span-4 border border-black p-1.5 space-y-1 bg-white">
                <div className="font-bold text-[10px] uppercase">
                  PENDIENTE POR FACTURAR
                </div>
                <div className="overflow-hidden whitespace-nowrap">
                  <span className="font-bold">DEALER:</span>............................................
                </div>
                <div className="overflow-hidden whitespace-nowrap">
                  <span className="font-bold">BOLÍVAR:</span>..........................................
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Cut Line */}
          <div className="mt-4 border-b border-dashed border-gray-500 w-full"></div>
        </div>
      </div>

      {/* Print Specific CSS for 1/2 A4 Sheet */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .sales-ficha-print-sheet {
            max-height: 138mm !important;
            height: auto !important;
            page-break-inside: avoid !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
    </div>
  );
}
