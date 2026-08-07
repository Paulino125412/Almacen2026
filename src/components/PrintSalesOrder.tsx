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

      {/* Print Document Container - Designed for top half of A4 page */}
      <div className="w-full max-w-4xl bg-white text-black p-4 sm:p-6 print:p-0 rounded-b-xl print:rounded-none shadow-2xl print:shadow-none print:w-full">
        {/* Printable Area with Page Half Height Constraint */}
        <div className="sales-ficha-print-sheet mx-auto bg-white text-black font-sans text-[11px] leading-tight border border-black p-2 max-w-[210mm] print:max-w-none">
          {/* Header Title */}
          <div className="text-center font-bold text-base sm:text-lg mb-2 border-b-2 border-black pb-1 uppercase tracking-wide">
            Ficha de Venta Cliente N° <span className="font-mono tracking-widest font-normal">....................</span>
          </div>

          {/* Seller and Date Bar */}
          <div className="grid grid-cols-12 border border-black mb-1 bg-gray-50 print:bg-transparent">
            <div className="col-span-8 p-1.5 border-r border-black font-semibold flex items-center gap-2">
              <span className="font-bold">Nombre del ejecutor de ventas:</span>
              <span className="font-normal uppercase">{order.sellerName || '-'}</span>
            </div>
            <div className="col-span-4 p-1.5 font-semibold flex items-center justify-between">
              <span className="font-bold">Fecha:</span>
              <span className="font-mono">{order.date || 'DD/MM/AAAA'}</span>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full border-collapse border border-black mb-1 text-[10.5px]">
            <thead>
              <tr className="bg-gray-100 print:bg-gray-100 border-b border-black font-bold uppercase text-[9.5px]">
                <th className="border-r border-black p-1 text-center w-[12%]">Código</th>
                <th className="border-r border-black p-1 text-left w-[42%]">Descripción</th>
                <th className="border-r border-black p-1 text-right w-[11.5%]">Precio Unit.</th>
                <th className="border-r border-black p-1 text-right w-[11.5%]">Cant. Solicitada</th>
                <th className="border-r border-black p-1 text-right w-[11.5%]">Cant. Despachada</th>
                <th className="p-1 text-right w-[11.5%]">Importe Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => (
                <tr key={item.id || idx} className="border-b border-gray-400">
                  <td className="border-r border-black p-1 text-center font-mono font-bold">{item.code || '-'}</td>
                  <td className="border-r border-black p-1 font-medium">{item.description || '-'}</td>
                  <td className="border-r border-black p-1 text-right font-mono">
                    {item.unitPrice ? `S/. ${item.unitPrice.toFixed(2)}` : '-'}
                  </td>
                  <td className="border-r border-black p-1 text-right font-mono">{item.requestedQty || '-'}</td>
                  <td className="border-r border-black p-1 text-right font-mono font-bold">{item.dispatchedQty || '-'}</td>
                  <td className="p-1 text-right font-mono font-bold">
                    {item.totalAmount ? `S/. ${item.totalAmount.toFixed(2)}` : '-'}
                  </td>
                </tr>
              ))}
              
              {/* Padding rows if items are few to maintain structure */}
              {Array.from({ length: Math.max(0, 3 - order.items.length) }).map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-gray-200 text-transparent">
                  <td className="border-r border-black p-1">&nbsp;</td>
                  <td className="border-r border-black p-1">&nbsp;</td>
                  <td className="border-r border-black p-1">&nbsp;</td>
                  <td className="border-r border-black p-1">&nbsp;</td>
                  <td className="border-r border-black p-1">&nbsp;</td>
                  <td className="p-1">&nbsp;</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t border-black bg-gray-50 print:bg-transparent">
                <td colSpan={4} className="border-r border-black p-1 text-right uppercase text-[10px]">
                  CLIENTE: <span className="font-bold normal-case text-black ml-1">{order.clientName || '------------------'}</span>
                </td>
                <td className="border-r border-black p-1 text-right uppercase text-[10px] font-extrabold">
                  TOTAL
                </td>
                <td className="p-1 text-right font-mono text-xs font-black">
                  S/. {formattedTotal}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Client & Dispatch Details Grid */}
          <div className="border border-black mb-1 text-[10px]">
            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-8 p-1 border-r border-black">
                <span className="font-bold uppercase">Dirección fiscal:</span> {order.fiscalAddress || '-'}
              </div>
              <div className="col-span-4 p-1">
                <span className="font-bold uppercase">RUC/DNI:</span> <span className="font-mono font-bold">{order.clientRucDni || '-'}</span>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-3 p-1 font-bold border-r border-black uppercase bg-gray-50 print:bg-transparent">
                Contacto de despacho
              </div>
              <div className="col-span-9 p-1 grid grid-cols-2 gap-2">
                <div><span className="font-bold">Nombre:</span> {order.dispatchContactName || '-'}</div>
                <div><span className="font-bold">Teléfono:</span> <span className="font-mono">{order.dispatchContactPhone || '-'}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-8 p-1 border-r border-black">
                <span className="font-bold uppercase">Lugar de despacho:</span> {order.dispatchAddress || '-'}
              </div>
              <div className="col-span-4 p-1">
                <span className="font-bold uppercase">Número de piso:</span> {order.floorNumber || '-'}
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-6 p-1 border-r border-black">
                <span className="font-bold uppercase">Fecha de despacho:</span> <span className="font-mono">{order.dispatchDate || '-'}</span>
              </div>
              <div className="col-span-6 p-1">
                <span className="font-bold uppercase">Hora de despacho:</span> <span className="font-mono">{order.dispatchTime || '-'}</span>
              </div>
            </div>

            <div className="p-1 bg-gray-50 print:bg-transparent">
              <span className="font-bold uppercase">Forma de pago:</span> <span className="font-semibold ml-2">{order.paymentMethod || '-'}</span>
            </div>
          </div>

          {/* Billing Breakdown Grid */}
          <div className="border border-black mb-1 text-[9.5px]">
            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-5 p-1 border-r border-black">
                <span className="font-bold">Importe facturado:(S/.)</span> <span className="font-mono font-bold ml-1">{order.billedAmount ? `S/. ${formattedBilled}` : ''}</span>
              </div>
              <div className="col-span-7 p-1">
                <span className="font-bold">Importe facturado:(S/.)...................................................</span>
              </div>
            </div>

            <div className="grid grid-cols-12 border-b border-black">
              <div className="col-span-5 p-1 border-r border-black">
                <span className="font-bold">Nombre:</span> {order.billingName || ''}
              </div>
              <div className="col-span-4 p-1 border-r border-black">
                <span className="font-bold">Nombre:...........................................................</span>
              </div>
              <div className="col-span-3 p-1 font-bold">
                Pendiente:<span className="font-mono font-bold ml-1">{order.pendingAmount ? `S/. ${formattedPending}` : '.........................'}</span>
              </div>
            </div>

            <div className="grid grid-cols-12">
              <div className="col-span-5 p-1 border-r border-black">
                <span className="font-bold">RUC/DNI:</span> <span className="font-mono">{order.billingRucDni || ''}</span>
              </div>
              <div className="col-span-7 p-1">
                <span className="font-bold">RUC/DNI:...........................................................</span>
              </div>
            </div>
          </div>

          {/* Observaciones */}
          <div className="border border-black p-1 mb-1 text-[9.5px]">
            <span className="font-bold uppercase">Observaciones:</span>
            <div className="min-h-[18px] text-gray-800 italic mt-0.5">
              {order.observations || '......................................................................................................................................................................................'}
            </div>
          </div>

          {/* Warehouse Footer Section */}
          <div className="border border-black p-1.5 bg-gray-50 print:bg-transparent text-[9px]">
            <div className="font-bold uppercase text-[9.5px] border-b border-black pb-0.5 mb-1 flex items-center justify-between">
              <span>(PARA SER LLENADO POR ALMACÉN)</span>
              <span className="text-[8.5px] font-bold tracking-wider">PENDIENTE POR FACTURAR</span>
            </div>

            <div className="grid grid-cols-12 gap-x-2 gap-y-1">
              <div className="col-span-4">
                <span className="font-bold">DEALER:</span> {order.dealerNote || '..........................................................'}
              </div>
              <div className="col-span-4">
                <span className="font-bold">BOLÍVAR:</span> {order.bolivarNote || '..........................................................'}
              </div>
              <div className="col-span-4">
                <span className="font-bold">DEALER:</span> {order.pendingBillingInfo || '..........................................................'}
              </div>

              <div className="col-span-4">
                <span className="font-bold"># FACTURA:</span> {order.dealerFactura || '......................................................'}
              </div>
              <div className="col-span-4">
                <span className="font-bold"># FACTURA:</span> {order.bolivarFactura || '......................................................'}
              </div>
              <div className="col-span-4">
                <span className="font-bold">BOLÍVAR:</span> {order.bolivarPendingInfo || '..........................................................'}
              </div>
            </div>
          </div>
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
