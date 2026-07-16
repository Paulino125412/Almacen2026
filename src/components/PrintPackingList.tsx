import React, { useMemo } from 'react';
import { PackingList, PackingListItem, Client, Seller, Provider, Article } from '../types';
import { FileText, Printer, X, AlertTriangle } from 'lucide-react';

interface PrintPackingListProps {
  packingList: PackingList;
  clients: Client[];
  sellers: Seller[];
  providers: Provider[];
  articles: Article[];
  onClose: () => void;
}

export default function PrintPackingList({
  packingList,
  clients,
  sellers,
  providers,
  articles,
  onClose
}: PrintPackingListProps) {
  
  const client = clients.find(c => c.id === packingList.clientId);
  const seller = sellers.find(s => s.id === packingList.sellerId);

  const getArticleName = (id: string) => articles.find(a => a.id === id)?.name || 'Artículo Desconocido';

  const totalMeters = packingList.items.reduce((acc, item) => acc + Number(item.meters || 0), 0);
  const totalRolls = packingList.items.length;

  React.useEffect(() => {
    const originalTitle = document.title;
    const handleBeforePrint = () => {
      document.title = " ";
    };
    const handleAfterPrint = () => {
      document.title = originalTitle;
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = " ";
    window.focus();
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 500);
  };

  // Group packing list items by Article ID for professional grouped layout
  const groupedItems = useMemo(() => {
    const groups: Record<string, PackingListItem[]> = {};
    packingList.items.forEach(item => {
      if (!groups[item.articleId]) {
        groups[item.articleId] = [];
      }
      groups[item.articleId].push(item);
    });
    return groups;
  }, [packingList.items]);

  return (
    <div id="print-section" className="fixed inset-0 bg-app-bg/75 backdrop-blur-xs z-50 overflow-y-auto p-4 md:p-6 flex justify-center items-start print-overlay-container">
      {/* CSS rules for pure A4 printing of two clean pages */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-overlay-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            z-index: auto !important;
            display: block !important;
          }
          .print-modal-reset {
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            width: 100% !important;
            overflow: visible !important;
          }
          .print-scroll-container {
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            max-height: none !important;
            background: transparent !important;
          }
          .print-page {
            page-break-after: always !important;
            break-after: page !important;
            min-height: 297mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            border: none !important;
            box-shadow: none !important;
            padding: 12mm 15mm !important;
            margin: 0 !important;
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            background-color: white !important;
            color: black !important;
          }
          .print-page * {
            color: black !important;
            border-color: black !important;
          }
          .print-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .ticket-perforated::before,
          .ticket-perforated::after {
            display: none !important;
          }
          .warehouse-tag {
            border: 1px solid black !important;
            box-shadow: none !important;
            color: black !important;
            background-color: transparent !important;
          }
          @page {
            size: A4;
            margin: 0 !important;
          }
        }
      `}</style>

      <div translate="no" className="notranslate bg-app-surface border border-app-border rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden print-modal-reset">
        {/* Header Modal Actions */}
        <div className="bg-app-surface px-6 py-4 border-b border-app-border flex flex-wrap justify-between items-center gap-4 no-print">
          <div className="flex items-center gap-3">
            <FileText className="text-app-primary" size={22} />
            <div>
              <h2 className="text-md font-bold text-app-text">
                Vista de Impresión: {packingList.packingListNo}
              </h2>
              <p className="text-[11px] text-app-text/60">
                {(packingList.type === 'corte' || packingList.type === 'antiguo')
                  ? 'Imprime un documento en una sola hoja A4 con dos mitades (Original con Cargo en parte superior y Copia para el receptor en parte inferior).'
                  : 'Imprime un documento de 2 hojas: Hoja 1 y Hoja 2, ambas con el Aviso Importante.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-app-primary hover:bg-app-primary/95 text-white rounded font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs uppercase tracking-wider"
              id="btn-print-action"
            >
              <Printer size={13} />
              Imprimir Packing List
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-app-surface border border-app-border hover:bg-app-bg text-app-text rounded font-bold text-xs transition cursor-pointer uppercase tracking-wider"
              id="btn-close-print"
            >
              <X size={13} className="inline mr-1" />
              Cerrar Vista
            </button>
          </div>
        </div>

        {/* Scrollable Container for On-Screen Visualizing */}
        <div className="p-4 overflow-y-auto max-h-[80vh] bg-app-bg/90 space-y-4 print-scroll-container">
          {window.self !== window.top && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg p-4 text-xs text-red-800 dark:text-red-300 flex flex-col gap-2 no-print shadow-xs animate-pulse">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0" size={18} />
                <p className="font-bold text-sm">
                  ¡Atención! Bloqueo de impresión detectado (Vista Previa de AI Studio)
                </p>
              </div>
              <p className="leading-relaxed">
                Los navegadores modernos <strong>bloquean</strong> las ventanas de impresión (<code className="font-mono bg-red-100 dark:bg-red-950/40 px-1 rounded text-red-950 dark:text-red-300">window.print()</code>) cuando la aplicación se ejecuta dentro de un marco o <strong>iFrame</strong> por razones de seguridad.
              </p>
              <p className="font-medium">
                👉 <strong>Solución:</strong> Haga clic en el botón con el icono de la flecha inclinada <strong>"Open in new tab"</strong> (Abrir en pestaña nueva) ubicado en la esquina superior derecha del panel de vista previa de AI Studio, o acceda directamente usando los enlaces de desarrollo compartidos. Una vez abierto en su propia pestaña, el botón de impresión funcionará a la perfección.
              </p>
            </div>
          )}

          <div className="bg-app-primary/5 border border-app-primary/20 rounded-lg p-3 text-xs text-app-primary flex items-center gap-2 no-print">
            <AlertTriangle className="text-app-primary shrink-0" size={16} />
            <p>
              <strong>Sugerencia de Impresión:</strong> Para un acabado perfecto, asegúrese de activar <strong>"Gráficos de fondo"</strong> en la configuración de su navegador.
            </p>
          </div>

          {(packingList.type === 'corte' || packingList.type === 'antiguo') ? (
            <CortePrintSheet
              packingList={packingList}
              client={client}
              seller={seller}
              groupedItems={groupedItems}
              getArticleName={getArticleName}
              totalRolls={totalRolls}
              totalMeters={totalMeters}
              providers={providers}
            />
          ) : (
            <>
              {/* PAGE 1: ORIGINAL (With exact requested Aviso Importante text) */}
              <SinglePrintPage
                title="PACKING LIST"
                packingList={packingList}
                client={client}
                seller={seller}
                groupedItems={groupedItems}
                getArticleName={getArticleName}
                totalRolls={totalRolls}
                totalMeters={totalMeters}
                providers={providers}
                bottomContent={
                  <div className="mt-4 border border-app-border rounded-lg p-2.5 bg-app-surface text-app-text print:text-black print:border-black">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-app-primary mb-1.5 text-center border-b border-app-border pb-0.5 py-0.5 rounded print:text-black print:border-black">
                      AVISO IMPORTANTE
                    </h3>
                    <div className="text-[8px] font-medium leading-normal uppercase">
                      <p className="mb-1">
                        1. EL CLIENTE DEBERÁ <strong className="font-extrabold">FOLIAR O NUMERAR</strong> LAS CAPAS TENDIDAS DE TELA, INDEPENDIENTEMENTE DE QUE SEA O NO DEL MISMO LOTE. ELLO, PARA CONSTATAR EL COLOR Y ENCOGIMIENTO DE LA MERCANCÍA.
                      </p>
                      <p className="mb-1">
                        2. <strong className="font-extrabold">NO CORTE</strong> EL ROLLO ANTES DE COMPROBAR: CALIDAD, CANTIDAD DE METRAJE, SOLIDEZ DE COLOR, ETC.
                      </p>
                      <p className="font-black text-center pt-1 border-t border-app-border print:border-black">
                        DE NO CUMPLIR EL CLIENTE CON LOS 2 PUNTOS SEÑALADOS ANTERIORMENTE, ABSTENERSE DE RECLAMOS. GRACIAS POR SU COOPERACIÓN.
                      </p>
                    </div>
                  </div>
                }
              />

              {/* PAGE 2: COPIA CARGO (Temporarily replaced with Aviso Importante) */}
              <SinglePrintPage
                title="PACKING LIST"
                packingList={packingList}
                client={client}
                seller={seller}
                groupedItems={groupedItems}
                getArticleName={getArticleName}
                totalRolls={totalRolls}
                totalMeters={totalMeters}
                providers={providers}
                bottomContent={
                  <div className="mt-4 border border-app-border rounded-lg p-2.5 bg-app-surface text-app-text print:text-black print:border-black">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-app-primary mb-1.5 text-center border-b border-app-border pb-0.5 py-0.5 rounded print:text-black print:border-black">
                      AVISO IMPORTANTE
                    </h3>
                    <div className="text-[8px] font-medium leading-normal uppercase">
                      <p className="mb-1">
                        1. EL CLIENTE DEBERÁ <strong className="font-extrabold">FOLIAR O NUMERAR</strong> LAS CAPAS TENDIDAS DE TELA, INDEPENDIENTEMENTE DE QUE SEA O NO DEL MISMO LOTE. ELLO, PARA CONSTATAR EL COLOR Y ENCOGIMIENTO DE LA MERCANCÍA.
                      </p>
                      <p className="mb-1">
                        2. <strong className="font-extrabold">NO CORTE</strong> EL ROLLO ANTES DE COMPROBAR: CALIDAD, CANTIDAD DE METRAJE, SOLIDEZ DE COLOR, ETC.
                      </p>
                      <p className="font-black text-center pt-1 border-t border-app-border print:border-black">
                        DE NO CUMPLIR EL CLIENTE CON LOS 2 PUNTOS SEÑALADOS ANTERIORMENTE, ABSTENERSE DE RECLAMOS. GRACIAS POR SU COOPERACIÓN.
                      </p>
                    </div>
                  </div>
                }
              />
            </>
          )}

        </div>
      </div>
    </div>
  );
}

interface SinglePrintPageProps {
  title: string;
  packingList: PackingList;
  client: Client | undefined;
  seller: Seller | undefined;
  groupedItems: Record<string, PackingListItem[]>;
  getArticleName: (id: string) => string;
  totalRolls: number;
  totalMeters: number;
  bottomContent: React.ReactNode;
  providers: Provider[];
}

function SinglePrintPage({
  title,
  packingList,
  client,
  seller,
  groupedItems,
  getArticleName,
  totalRolls,
  totalMeters,
  bottomContent,
  providers
}: SinglePrintPageProps) {
  const firstItemProviderId = packingList.items[0]?.providerId;
  const activeProvider = providers.find(p => p.id === firstItemProviderId) || null;

  const showLot = activeProvider ? activeProvider.hasLot : true;
  const showPartida = activeProvider ? activeProvider.hasPartida : true;
  const hasRollNo = activeProvider ? activeProvider.hasRollNo : false;
  const hasTono = activeProvider ? !!activeProvider.hasTono : false;
  const hasWidth = activeProvider ? !!activeProvider.hasWidth : false;
  const hasWeight = activeProvider ? !!activeProvider.hasWeight : false;

  return (
    <div translate="no" className="notranslate ticket-perforated bg-app-surface text-app-text p-8 border border-app-border rounded-xl shadow-lg font-sans max-w-3xl mx-auto my-2 min-h-[296mm] flex flex-col justify-between print-page print:border-none print:shadow-none print:p-0 print:my-0">
      <div>
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <h1 className="text-2xl font-display text-app-primary">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="warehouse-tag">
              GUÍA N°: {packingList.guideNumber || '___________'}
            </span>
            <span className="text-md font-display text-app-secondary">GRUPO JUDITEX</span>
          </div>
        </div>

        {/* Client and Sales Representative at the same height */}
        <div className="flex justify-between items-start text-xs border-b border-app-border pb-3 mb-6">
          <div className="space-y-1">
            <p className="font-bold">
              CLIENTE: <span className="font-normal uppercase text-app-text/90">{client?.name || 'Cliente de Registro'}</span>
            </p>
            {packingList.dispatchAddress && (
              <p className="font-bold mt-1">
                DESTINO: <span className="font-normal uppercase text-app-text/90">{packingList.dispatchAddress}</span>
              </p>
            )}
          </div>
          <div className="text-right space-y-1">
            <p className="font-bold">
              VENDEDOR: <span className="font-normal uppercase text-app-text/90">{seller?.name || 'Vendedor Autorizado'}</span>
            </p>
            <p className="font-bold">
              FECHA: <span className="font-normal font-mono text-app-text/80">{packingList.date}</span>
            </p>
          </div>
        </div>

        {/* Elegant Grouped Articles Table */}
        <div className="mb-6">
          <table className="w-full text-left border-collapse border-b border-app-border text-xs">
            <thead>
              <tr className="border-b-2 border-app-border text-[10px] text-app-text uppercase font-bold tracking-wider">
                <th className="py-1.5 px-1 w-2/5">
                  {hasRollNo ? 'Nº ROLLO' : 'ITEM'}
                </th>
                {showLot && <th className="py-1.5 px-1 text-center w-24">LOTE</th>}
                {showPartida && <th className="py-1.5 px-1 text-center w-28">PARTIDA</th>}
                {hasTono && <th className="py-1.5 px-1 text-center w-20">TONO</th>}
                {hasWidth && <th className="py-1.5 px-1 text-center w-20">ANCHO</th>}
                {hasWeight && <th className="py-1.5 px-1 text-center w-20">PESO</th>}
                <th className="py-1.5 px-1 text-right w-32">METRAJE</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(groupedItems).map(articleId => {
                const groupItems = groupedItems[articleId];
                const articleName = getArticleName(articleId);
                const articleTotalMeters = groupItems.reduce((acc, item) => acc + Number(item.meters || 0), 0);
                
                const colSpanHeader = 2 
                  + (showLot ? 1 : 0) 
                  + (showPartida ? 1 : 0) 
                  + (hasTono ? 1 : 0)
                  + (hasWidth ? 1 : 0)
                  + (hasWeight ? 1 : 0);

                const colSpanSummary = 1 
                  + (showLot ? 1 : 0) 
                  + (showPartida ? 1 : 0) 
                  + (hasTono ? 1 : 0)
                  + (hasWidth ? 1 : 0)
                  + (hasWeight ? 1 : 0);

                return (
                  <React.Fragment key={articleId}>
                    {/* Article Name Header Row */}
                    <tr className="border-b border-app-border font-bold bg-app-bg/25">
                      <td colSpan={colSpanHeader} className="py-1.5 px-1 text-app-primary uppercase text-[11px] tracking-tight">
                        {articleName}
                      </td>
                    </tr>
                    
                    {/* Individual Roll/Cut metraje entries */}
                    {groupItems.map((item, idx) => (
                      <tr key={item.id || idx} className="border-b border-app-border/40 hover:bg-app-bg/10">
                        <td className="py-1 px-1 font-mono text-[10.5px] pl-4 font-bold">
                          {hasRollNo ? (item.rollNumber || '-') : (idx + 1)}
                        </td>
                        {showLot && <td className="py-1 px-1 text-center font-mono text-[11px]">{item.lot || '-'}</td>}
                        {showPartida && <td className="py-1 px-1 text-center font-mono text-[11px]">{item.partida || '-'}</td>}
                        {hasTono && <td className="py-1 px-1 text-center font-mono text-[11px] font-bold text-app-primary uppercase">{item.tono || '-'}</td>}
                        {hasWidth && <td className="py-1 px-1 text-center font-mono text-[11px]">{item.width ? `${item.width} m` : '-'}</td>}
                        {hasWeight && <td className="py-1 px-1 text-center font-mono text-[11px]">{item.weight ? `${item.weight} kg` : '-'}</td>}
                        <td className="py-1 px-1 text-right font-mono font-bold text-[11px]">{Number(item.meters).toFixed(2)} m</td>
                      </tr>
                    ))}
                    
                    {/* Article Group Summary Row */}
                    <tr className="border-b-2 border-app-border font-bold text-[11px] bg-app-bg/10">
                      <td colSpan={colSpanSummary} className="py-2 px-1 uppercase text-right tracking-tight font-bold text-app-text/75">
                        {articleName} -- Cantidad: {groupItems.length} | Total:
                      </td>
                      <td className="py-2 px-1 text-right font-mono text-app-primary font-black">
                        {articleTotalMeters.toFixed(2)} m
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Grand Totals Section */}
          <div className="flex flex-col items-end justify-end mt-3 text-xs font-bold space-y-1">
            <p className="uppercase tracking-tight">TOTAL ROLLOS: <span className="font-mono font-black text-sm text-app-secondary">{totalRolls}</span></p>
            <p className="uppercase tracking-tight font-display text-app-primary">TOTAL METROS: <span className="font-mono font-black text-md">{totalMeters.toFixed(2)} m</span></p>
          </div>
        </div>
      </div>

      {bottomContent}
    </div>
  );
}

interface CortePrintSheetProps {
  packingList: PackingList;
  client: Client | undefined;
  seller: Seller | undefined;
  groupedItems: Record<string, PackingListItem[]>;
  getArticleName: (id: string) => string;
  totalRolls: number;
  totalMeters: number;
  providers: Provider[];
}

function CortePrintSheet({
  packingList,
  client,
  seller,
  groupedItems,
  getArticleName,
  totalRolls,
  totalMeters,
  providers
}: CortePrintSheetProps) {
  const firstItemProviderId = packingList.items[0]?.providerId;
  const activeProvider = providers.find(p => p.id === firstItemProviderId) || null;

  const showLot = activeProvider ? activeProvider.hasLot : true;
  const showPartida = activeProvider ? activeProvider.hasPartida : true;

  return (
    <div translate="no" className="notranslate ticket-perforated bg-app-surface text-app-text px-6 py-4 border border-app-border rounded-xl shadow-lg font-sans max-w-3xl mx-auto my-2 h-[296mm] max-h-[296mm] flex flex-col justify-between print-page print:border-none print:shadow-none print:p-0 print:my-0 box-border">
      
      {/* TOP HALF - EXACTLY 50% */}
      <div className="h-[50%] flex flex-col justify-between pb-4 border-b border-dashed border-app-border relative box-border overflow-hidden">
        <div>
          {/* Header */}
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-display text-app-primary">PACKING LIST</h2>
              <span className="warehouse-tag text-[9px] px-1.5 py-0.5 font-bold uppercase">
                GUÍA N°: {packingList.guideNumber || '___________'}
              </span>
            </div>
            <span className="text-xs font-display text-app-secondary">
              GRUPO JUDITEX
            </span>
          </div>

          {/* Client / Seller / Date details - Identical layout on both halves */}
          <div className="grid grid-cols-2 gap-4 text-[9.5px] py-1 mb-1.5 border-b border-app-border">
            <div>
              <p className="font-bold">
                CLIENTE: <span className="font-normal uppercase text-app-text/90">{client?.name || 'Cliente de Registro'}</span>
              </p>
              {packingList.dispatchAddress && (
                <p className="font-bold mt-0.5">
                  DESTINO: <span className="font-normal uppercase text-app-text/90">{packingList.dispatchAddress}</span>
                </p>
              )}
              <p className="font-bold mt-0.5">
                FECHA: <span className="font-normal font-mono text-app-text/80">{packingList.date}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold">
                VENDEDOR: <span className="font-normal uppercase text-app-text/90">{seller?.name || 'Vendedor Autorizado'}</span>
              </p>
            </div>
          </div>

          {/* Side-by-Side: Metrajes on the Left, CARGO on the Right */}
          <div className="grid grid-cols-12 gap-4 items-stretch">
            
            {/* LEFT COLUMN: Packing list details and metrajes grid (col-span-7) */}
            <div className="col-span-7 flex flex-col justify-between">
              <div className="space-y-2">
                {Object.keys(groupedItems).map(articleId => {
                  const groupItems = groupedItems[articleId];
                  const articleName = getArticleName(articleId);
                  const articleTotalMeters = groupItems.reduce((acc, item) => acc + Number(item.meters || 0), 0);
                  
                  const uniqueLots = Array.from(new Set(groupItems.map(item => item.lot).filter(Boolean)));
                  const uniquePartidas = Array.from(new Set(groupItems.map(item => item.partida).filter(Boolean)));
                  const lotText = showLot && uniqueLots.length > 0 ? `LOTE: ${uniqueLots.join(', ')}` : '';
                  const partidaText = showPartida && uniquePartidas.length > 0 ? `PARTIDA: ${uniquePartidas.join(', ')}` : '';
                  const attributesText = [lotText, partidaText].filter(Boolean).join(' | ');

                  return (
                    <div key={articleId} className="text-[9px]">
                      <div className="font-extrabold text-app-primary uppercase tracking-tight text-[9.5px] mb-0.5">
                        {articleName} {attributesText ? `(${attributesText})` : ''}
                      </div>
                      
                      {/* Grid of metrajes (clean, aligned columns) */}
                      <div className="grid grid-cols-6 gap-x-2 gap-y-0.5 py-0.5 font-mono text-[9px] text-left">
                        {groupItems.map((item, idx) => {
                          const hasTonoValue = activeProvider?.hasTono && item.tono;
                          return (
                            <div key={item.id || idx} className="py-0.2">
                              <span className="font-bold">{Number(item.meters).toFixed(2)}</span>
                              {hasTonoValue && (
                                <span className="text-[7.5px] font-extrabold bg-app-primary text-white px-0.5 rounded ml-1">
                                  {item.tono}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="text-right font-bold text-app-secondary text-[9px] mt-0.5 pr-2">
                        Subtotal: {articleTotalMeters.toFixed(2)} m
                      </div>
                    </div>
                  );
                })}
                {packingList.type === 'corte' && packingList.notes && (
                  <div className="mt-2 border border-app-border rounded p-1.5 bg-app-bg/20 text-[8px] leading-snug">
                    <span className="font-bold text-app-primary">NOTA:</span> {packingList.notes}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: CARGO Box (col-span-5) - Larger size & matches original style perfectly, but in black and white */}
            <div className="col-span-5 self-stretch flex flex-col">
              <div className="border-2 border-app-primary rounded-xl p-3 text-app-text flex flex-col justify-between bg-app-bg/10 h-full min-h-[140px]">
                <h3 className="text-sm font-display text-center tracking-widest uppercase mb-3 text-app-primary">
                  CARGO DE RECEPCIÓN
                </h3>
                <div className="space-y-3 text-[9px] font-extrabold flex-1 flex flex-col justify-between">
                  <div className="space-y-0.5">
                    <span className="uppercase tracking-wider text-[8px] text-app-text/60">Nombre:</span>
                    <div className="border-b border-app-border h-4 w-full"></div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="uppercase tracking-wider text-[8px] text-app-text/60">DNI:</span>
                    <div className="border-b border-app-border h-4 w-full"></div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="uppercase tracking-wider text-[8px] text-app-text/60">Fecha de Recepción:</span>
                    <div className="border-b border-app-border h-4 w-full"></div>
                  </div>
                  <div className="space-y-0.5">
                    <span className="uppercase tracking-wider text-[8px] text-app-text/60">Firma:</span>
                    <div className="border-b border-app-border h-5 w-full mt-1"></div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Inline Summary for Top Half (Only Metrics to prevent Client/Seller repetition) */}
        <div className="border-t border-app-border pt-1.5 mt-2 text-[10px] font-black uppercase">
          <div className="flex justify-between items-center px-2">
            <p className="font-display text-app-primary">TOTAL METROS: <span className="font-mono text-xs">{totalMeters.toFixed(2)} m</span></p>
            <p className="font-display text-app-secondary">CANTIDAD DE ROLLOS: <span className="font-mono text-xs">{totalRolls}</span></p>
          </div>
        </div>
      </div>

      {/* BOTTOM HALF - EXACTLY 50% */}
      <div className="h-[50%] flex flex-col justify-between pt-4 box-border overflow-hidden">
        <div>
          {/* Header */}
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-display text-app-primary">PACKING LIST</h2>
              <span className="warehouse-tag text-[9px] px-1.5 py-0.5 font-bold uppercase">
                GUÍA N°: {packingList.guideNumber || '___________'}
              </span>
            </div>
            <span className="text-xs font-display text-app-secondary">
              GRUPO JUDITEX
            </span>
          </div>

          {/* Client / Seller / Date details - Identical layout on both halves */}
          <div className="grid grid-cols-2 gap-4 text-[9.5px] py-1 mb-1.5 border-b border-app-border">
            <div>
              <p className="font-bold">
                CLIENTE: <span className="font-normal uppercase text-app-text/90">{client?.name || 'Cliente de Registro'}</span>
              </p>
              {packingList.dispatchAddress && (
                <p className="font-bold mt-0.5">
                  DESTINO: <span className="font-normal uppercase text-app-text/90">{packingList.dispatchAddress}</span>
                </p>
              )}
              <p className="font-bold mt-0.5">
                FECHA: <span className="font-normal font-mono text-app-text/80">{packingList.date}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold">
                VENDEDOR: <span className="font-normal uppercase text-app-text/90">{seller?.name || 'Vendedor Autorizado'}</span>
              </p>
            </div>
          </div>

          {/* Detailed Metrajes Grid for Bottom Half (Full width representation) */}
          <div className="space-y-2">
            {Object.keys(groupedItems).map(articleId => {
              const groupItems = groupedItems[articleId];
              const articleName = getArticleName(articleId);
              const articleTotalMeters = groupItems.reduce((acc, item) => acc + Number(item.meters || 0), 0);
              
              const uniqueLots = Array.from(new Set(groupItems.map(item => item.lot).filter(Boolean)));
              const uniquePartidas = Array.from(new Set(groupItems.map(item => item.partida).filter(Boolean)));
              const lotText = showLot && uniqueLots.length > 0 ? `LOTE: ${uniqueLots.join(', ')}` : '';
              const partidaText = showPartida && uniquePartidas.length > 0 ? `PARTIDA: ${uniquePartidas.join(', ')}` : '';
              const attributesText = [lotText, partidaText].filter(Boolean).join(' | ');

              return (
                <div key={articleId} className="text-[9px]">
                  <div className="font-extrabold text-app-primary uppercase tracking-tight text-[9.5px] mb-0.5">
                    {articleName} {attributesText ? `(${attributesText})` : ''}
                  </div>
                  
                  {/* Grid of metrajes (clean, aligned columns - full 8 columns wide for bottom part) */}
                  <div className="grid grid-cols-8 gap-x-2 gap-y-0.5 py-0.5 font-mono text-[9px] text-left">
                    {groupItems.map((item, idx) => {
                      const hasTonoValue = activeProvider?.hasTono && item.tono;
                      return (
                        <div key={item.id || idx} className="py-0.2">
                          <span className="font-bold">{Number(item.meters).toFixed(2)}</span>
                          {hasTonoValue && (
                            <span className="text-[7.5px] font-extrabold bg-app-primary text-white px-0.5 rounded ml-1">
                              {item.tono}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-right font-bold text-app-secondary text-[9px] mt-0.5 pr-2">
                    Subtotal: {articleTotalMeters.toFixed(2)} m
                  </div>
                </div>
              );
            })}
            {packingList.type === 'corte' && packingList.notes && (
              <div className="mt-2 border border-app-border rounded p-1.5 bg-app-bg/20 text-[8px] leading-snug">
                <span className="font-bold text-app-primary">NOTA:</span> {packingList.notes}
              </div>
            )}
          </div>
        </div>

        <div>
          {/* Inline Summary for Bottom Half (Only Metrics to prevent Client/Seller repetition) */}
          <div className="border-t border-app-border pt-1.5 text-[10px] font-black uppercase">
            <div className="flex justify-between items-center px-2">
              <p className="font-display text-app-primary">TOTAL METROS: <span className="font-mono text-xs">{totalMeters.toFixed(2)} m</span></p>
              <p className="font-display text-app-secondary">CANTIDAD DE ROLLOS: <span className="font-mono text-xs">{totalRolls}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
