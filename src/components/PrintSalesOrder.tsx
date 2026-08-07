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
    const text = `📋 *FICHA DE VENTA N° ${order.orderNo || '....................'}*
----------------------------------------
👤 *Cliente:* ${order.clientName}
🆔 *RUC/DNI:* ${order.clientRucDni || 'N/A'}
👨‍💼 *Ejecutor de Ventas:* ${order.sellerName || 'N/A'}
📅 *Fecha:* ${order.date}
📍 *Lugar de Despacho:* ${order.dispatchAddress || 'Almacén'}
🚚 *Fecha/Hora Despacho:* ${order.dispatchDate || '-'} ${order.dispatchTime || ''}
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
          {order.orderNo && (
            <span className="text-xs text-app-text/60 bg-app-bg px-2 py-0.5 rounded font-mono">
              {order.orderNo}
            </span>
          )}
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
          <div className="text-center font-bold text-base sm:text-lg mb-2">
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
              <span className="font-bold font-mono ml-1">{order.date || '........................'}</span>
            </div>
          </div>

          {/* 3. Items & Info Master Table Grid */}
          <table className="w-full border-collapse border border-black text-[10.5px] mb-2">
            <thead>
              <tr className="border-b border-black font-normal text-[10px]">
                <th className="border-r border-black p-1 text-center font-bold w-[10%]">Código</th>
                <th className="border-r border-black p-1 text-center font-bold w-[42%]">Descripción</th>
                <th className="border-r border-black p-1 text-center font-bold w-[12%] leading-tight">
                  Precio<br />Unitario
                </th>
                <th className="border-r border-black p-1 text-center font-bold w-[12%] leading-tight">
                  Cantidad<br />solicitada
                </th>
                <th className="border-r border-black p-1 text-center font-bold w-[12%] leading-tight">
                  Cantidad<br />despachada
                </th>
                <th className="p-1 text-center font-bold w-[12%] leading-tight">
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
                    {item.unitPrice ? item.unitPrice.toFixed(2) : ''}
                  </td>
                  <td className="border-r border-black p-1 text-right font-mono font-bold">{item.requestedQty || ''}</td>
                  <td className="border-r border-black p-1 text-right font-mono font-bold">{item.dispatchedQty || ''}</td>
                  <td className="p-1 text-right font-mono font-bold">
                    {item.totalAmount ? item.totalAmount.toFixed(2) : ''}
                  </td>
                </tr>
              ))}

              {/* Empty padding rows to guarantee height matching original form */}
              {Array.from({ length: Math.max(0, 4 - order.items.length) }).map((_, i) => (
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
                <td colSpan={4} className="border-r border-black p-1">
                  CLIENTE: <span className="font-bold uppercase ml-1">{order.clientName || ''}</span>
                </td>
                <td colSpan={2} className="p-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold">TOTAL</span>
                    <span className="font-mono font-bold text-xs">{formattedTotal ? `S/. ${formattedTotal}` : ''}</span>
                  </div>
                </td>
              </tr>

              {/* Dirección fiscal & RUC/DNI Row */}
              <tr className="border-b border-black">
                <td colSpan={4} className="border-r border-black p-1">
                  <div className="flex items-start gap-1">
                    <span className="whitespace-nowrap">Dirección fiscal</span>
                    <span className="font-bold uppercase ml-1">{order.fiscalAddress || ''}</span>
                  </div>
                </td>
                <td colSpan={2} className="p-1">
                  <span>RUC/DNI: </span>
                  <span className="font-mono font-bold">{order.clientRucDni || ''}</span>
                </td>
              </tr>

              {/* Contacto de despacho Row */}
              <tr className="border-b border-black">
                <td colSpan={1} className="border-r border-black p-1 leading-tight">
                  Contacto de<br />despacho
                </td>
                <td colSpan={5} className="p-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span>Nombre: </span><span className="font-bold uppercase">{order.dispatchContactName || ''}</span></div>
                    <div><span>Teléfono: </span><span className="font-mono font-bold">{order.dispatchContactPhone || ''}</span></div>
                  </div>
                </td>
              </tr>

              {/* Lugar de despacho Row */}
              <tr className="border-b border-black">
                <td colSpan={4} className="border-r border-black p-1">
                  <span>Lugar de despacho</span>
                  <span className="font-bold uppercase ml-1">{order.dispatchAddress || ''}</span>
                </td>
                <td colSpan={2} className="p-1">
                  <span>Número de piso</span>
                  <span className="font-bold font-mono ml-1">{order.floorNumber || ''}</span>
                </td>
              </tr>

              {/* Fecha de despacho & Hora de despacho Row */}
              <tr className="border-b border-black">
                <td colSpan={2} className="border-r border-black p-1">
                  <span>Fecha de despacho</span>
                  <span className="font-mono font-bold ml-1">{order.dispatchDate || ''}</span>
                </td>
                <td colSpan={2} className="border-r border-black p-1">
                  <span>Hora de despacho</span>
                  <span className="font-mono font-bold ml-1">{order.dispatchTime || ''}</span>
                </td>
                <td colSpan={2} className="p-1 font-bold text-center uppercase">
                  DURANTE EL DIA
                </td>
              </tr>

              {/* Forma de pago Row */}
              <tr className="border-b border-black">
                <td colSpan={6} className="p-1">
                  <span>Forma de pago</span>
                  <span className="font-bold uppercase ml-2">{order.paymentMethod || ''}</span>
                </td>
              </tr>

              {/* Billing Split Row */}
              <tr>
                <td colSpan={3} className="border-r border-black p-1.5 align-top">
                  <div className="space-y-1">
                    <div>
                      <span>Importe facturado:(S/.)</span>{' '}
                      <span className="font-mono font-bold ml-1">{order.billedAmount ? `S/. ${formattedBilled}` : ''}</span>
                    </div>
                    <div>
                      <span>Nombre:</span>{' '}
                      <span className="font-bold uppercase ml-1">{order.billingName || ''}</span>
                    </div>
                    <div>
                      <span>RUC/DNI:</span>{' '}
                      <span className="font-mono font-bold ml-1">{order.billingRucDni || ''}</span>
                    </div>
                  </div>
                </td>
                <td colSpan={3} className="p-1.5 align-top">
                  <div className="space-y-1">
                    <div>
                      <span>Importe facturado:(S/.)</span>...........................................................
                    </div>
                    <div>
                      <span>Nombre:</span>....................................................................................
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <span>RUC/DNI:</span>..................................................................................
                      </div>
                      <div>
                        <span>Pendiente:</span>
                        <span className="font-mono font-bold ml-1">{order.pendingAmount ? `S/. ${formattedPending}` : '.................................'}</span>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* 4. Observaciones & Prestamo de Prendas */}
          <div className="mb-3 px-1 space-y-1 text-[10.5px]">
            <div>
              <span>Observaciones: </span>
              <span className="font-bold uppercase">{order.observations || ''}</span>
            </div>
            <div className="font-bold uppercase tracking-wider text-[11px]">
              PRESTAMO DE PRENDAS
            </div>
          </div>

          {/* 5. (PARA SER LLENADO POR ALMACÉN) Section */}
          <div className="px-1 text-[10px]">
            <div className="font-bold uppercase text-[10.5px] mb-1">
              (PARA SER LLENADO POR ALMACÉN)
            </div>

            <div className="grid grid-cols-12 gap-2 items-start">
              {/* Dealer & Factura Lines */}
              <div className="col-span-4 space-y-1.5">
                <div>
                  <span className="font-bold">DEALER:</span>................................................................................
                </div>
                <div>
                  <span className="font-bold"># FACTURA:</span>...........................................................................
                </div>
              </div>

              {/* Bolívar & Factura Lines */}
              <div className="col-span-4 space-y-1.5">
                <div>
                  <span className="font-bold">BOLÍVAR:</span>.....................................................................
                </div>
                <div>
                  <span className="font-bold"># FACTURA:</span>................................................................
                </div>
              </div>

              {/* Boxed Pendiente Por Facturar */}
              <div className="col-span-4 border border-black p-1.5 space-y-1 bg-white">
                <div className="font-bold text-center text-[10px] uppercase border-b border-gray-300 pb-0.5">
                  PENDIENTE POR FACTURAR
                </div>
                <div>
                  <span className="font-bold">DEALER:</span>.................................................
                </div>
                <div>
                  <span className="font-bold">BOLÍVAR:</span>...............................................
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
